import type { HierarchyCircularNode, HierarchyNode, HierarchyRectangularNode } from "d3-hierarchy"
import { hierarchy, pack, treemap, treemapResquarify } from "d3-hierarchy"
import type { MouseEventHandler } from "react"
import { useDeferredValue, memo, useEffect, useMemo } from "react"
import type { GitBlobObject, GitObject, GitTreeObject } from "~/analyzer/model"
import { useClickedObject } from "~/contexts/ClickedContext"
import { useComponentSize } from "~/hooks"
import {
  bubblePadding,
  estimatedLetterHeightForDirText,
  estimatedLetterWidth,
  circleTreeTextOffsetY,
  treemapBlobTextOffsetX,
  treemapBlobTextOffsetY,
  treemapNodeBorderRadius,
  treemapPaddingTop,
  treemapTreeTextOffsetX,
  circleBlobTextOffsetY,
  treemapTreeTextOffsetY,
  missingInMapColor
} from "../const"
import { useData } from "../contexts/DataContext"
import { useMetrics } from "../contexts/MetricContext"
import type { ChartType } from "../contexts/OptionsContext"
import { useOptions } from "../contexts/OptionsContext"
import { usePath } from "../contexts/PathContext"
import { getTextColorFromBackground, isBlob, isTree } from "~/util"
import clsx from "clsx"
import type { SizeMetricType } from "~/metrics/sizeMetric"
import { Grouping, GroupingType } from "~/metrics/grouping"
import { useSearch } from "~/contexts/SearchContext"
import type { DatabaseInfo } from "~/routes/$repo.$"
import ignore, { type Ignore } from "ignore"
import { cn, usePrefersLightMode } from "~/styling"
import { isChrome, isChromium, isEdgeChromium } from "react-device-detect"
import { createHash } from "crypto"
import fileTypeRulesJSON from "./fileTypeRules.json"
import { getCoAuthors } from "~/analyzer/coauthors.server"

type CircleOrRectHiearchyNode = HierarchyCircularNode<GitObject> | HierarchyRectangularNode<GitObject>

export const Chart = memo(function Chart({ setHoveredObject }: { setHoveredObject: (obj: GitObject | null) => void }) {
  const [ref, rawSize] = useComponentSize()
  const { searchResults } = useSearch()
  const size = useDeferredValue(rawSize)
  const { databaseInfo } = useData()
  const { chartType, sizeMetric, groupingType, depthType, hierarchyType, labelsVisible, renderCutoff } = useOptions()
  const { path } = usePath()
  const { clickedObject, setClickedObject } = useClickedObject()
  const { setPath } = usePath()
  const { showFilesWithoutChanges, showFilesWithNoJSONRules } = useOptions()

  let numberOfDepthLevels: number | undefined = undefined
  switch (depthType) {
    case "One":
      numberOfDepthLevels = 1
      break
    case "Two":
      numberOfDepthLevels = 2
      break
    case "Three":
      numberOfDepthLevels = 3
      break
    case "Four":
      numberOfDepthLevels = 4
      break
    case "Five":
      numberOfDepthLevels = 5
      break
    case "Full":
    default:
      numberOfDepthLevels = undefined
  }

  const filetree = useMemo(() => {
    // TODO: make filtering faster, e.g. by not having to refetch everything every time
    const ig = ignore()
    ig.add(databaseInfo.hiddenFiles)
    const filtered = filterGitTree(databaseInfo.fileTree, databaseInfo.commitCounts, showFilesWithoutChanges, ig)
    if (hierarchyType === "NESTED") return filtered
    return {
      ...filtered,
      children: flatten(filtered)
    } as GitTreeObject
  }, [
    databaseInfo.fileTree,
    hierarchyType,
    databaseInfo.hiddenFiles,
    databaseInfo.commitCounts,
    showFilesWithoutChanges
  ])

  const nodes = useMemo(() => {
    console.time("nodes")
    if (size.width === 0 || size.height === 0) return []
    const res = createPartitionedHiearchy(
      databaseInfo,
      filetree,
      size,
      chartType,
      sizeMetric,
      groupingType,
      path,
      renderCutoff,
      showFilesWithNoJSONRules
    ).descendants()
    console.timeEnd("nodes")
    return res
  }, [size, chartType, sizeMetric, path, renderCutoff, databaseInfo, filetree])

  useEffect(() => {
    setHoveredObject(null)
  }, [chartType, size, setHoveredObject])

  const createGroupHandlers: (
    d: CircleOrRectHiearchyNode,
    isRoot: boolean
  ) => Record<"onClick" | "onMouseOver" | "onMouseOut", MouseEventHandler<SVGGElement>> = (d, isRoot) => {
    return isBlob(d.data)
      ? {
          onClick: (evt) => {
            evt.stopPropagation()
            return setClickedObject(d.data)
          },
          onMouseOver: () => setHoveredObject(d.data as GitObject),
          onMouseOut: () => setHoveredObject(null)
        }
      : {
          onClick: (evt) => {
            evt.stopPropagation()
            setClickedObject(d.data)
            setPath(d.data.path)
          },
          onMouseOver: (evt) => {
            evt.stopPropagation()
            if (!isRoot) setHoveredObject(d.data as GitObject)
            else setHoveredObject(null)
          },
          onMouseOut: () => setHoveredObject(null)
        }
  }

  const now = isChrome || isChromium || isEdgeChromium ? Date.now() : 0 // Necessary in chrome to update text positions
  return (
    <div className="relative grid place-items-center overflow-hidden" ref={ref}>
      <svg
        key={`svg|${size.width}|${size.height}`}
        className={clsx("grid h-full w-full place-items-center stroke-gray-300 dark:stroke-gray-700", {
          "cursor-zoom-out": path.includes("/")
        })}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${size.width} ${size.height}`}
        onClick={() => {
          const parentPath = path.split("/").slice(0, -1).join("/")
          if (parentPath === "") setPath("/")
          else setPath(parentPath)
        }}
      >
        {/* Draw relationship lines for AUTHOR_GRAPH */}
        {chartType === "AUTHOR_GRAPH" && (() => {
          // Build node position map
          const nodePositions: Record<string, { x: number; y: number; r: number }> = {};
          nodes.forEach((d) => {
            if (d.data.path && d.data.path.includes("/@")) {
              const node = d as HierarchyCircularNode<GitObject>;
              nodePositions[d.data.name] = { x: node.x, y: node.y, r: node.r };
            }
          });

          // Get relationships map
          const relationshipsMap = getAuthorsRelationships(databaseInfo);
          // Get author colors
          const [, authorColors] = useMetrics();

          const offsetAmount = 8; // pixels

          return Object.entries(relationshipsMap).flatMap(([author1, relObj]) =>
            Object.entries(relObj.Relationships).flatMap(([author2, relData]) => {
              const pos1 = nodePositions[author1];
              const pos2 = nodePositions[author2];
              if (!pos1 || !pos2) return [];
              console.log(`Drawing relationship between ${author1} and ${author2}`);
              console.log("Rel Data: ", relData)
              const searched_Stat = sizeMetric === "MOST_CONTRIBS" ? "nb_line_change" : "nb_commits";
              const author1Value = relData.author1Contribs[searched_Stat];
              const author2Value = relData.author2Contribs[searched_Stat];
              const totalValue = author1Value + author2Value;

              // Avoid division by zero
              const author1Percent = totalValue > 0 ? author1Value / totalValue : 0;
              const author2Percent = totalValue > 0 ? author2Value / totalValue : 0;

              // Scale thickness (adjust base and scaling as needed)
              const baseWidth = Math.max(2, Math.log(totalValue + 1));
              const strokeWidth1 = baseWidth * author1Percent*1.5;
              const strokeWidth2 = baseWidth * author2Percent*1.5;
              const color1 = authorColors.get(author1) || "#888";
              const color2 = authorColors.get(author2) || "#888";

              // Offset each line by half the other line's width
              const offsetA = (strokeWidth2 / 2);
              const offsetB = (strokeWidth1 / 2);

              // Perpendicular vector (normalized)
              const dx = pos2.x - pos1.x;
              const dy = pos2.y - pos1.y;
              const length = Math.sqrt(dx * dx + dy * dy) || 1;
              const perpX = -dy / length;
              const perpY = dx / length;

              // Author 1's line (offset by half of author2's width)
              const x1a = pos1.x + perpX * offsetA;
              const y1a = pos1.y + perpY * offsetA;
              const x2a = pos2.x + perpX * offsetA;
              const y2a = pos2.y + perpY * offsetA;

              // Author 2's line (offset by half of author1's width)
              const x1b = pos1.x - perpX * offsetB;
              const y1b = pos1.y - perpY * offsetB;
              const x2b = pos2.x - perpX * offsetB;
              const y2b = pos2.y - perpY * offsetB;

              return [
                <line
                  key={`rel-${author1}-${author2}-1`}
                  x1={x1a}
                  y1={y1a}
                  x2={x2a}
                  y2={y2a}
                  stroke={color1}
                  strokeWidth={strokeWidth1}
                  opacity={0.7}
                />,
                <line
                  key={`rel-${author1}-${author2}-2`}
                  x1={x1b}
                  y1={y1b}
                  x2={x2b}
                  y2={y2b}
                  stroke={color2}
                  strokeWidth={strokeWidth2}
                  opacity={0.7}
                />
              ];
            })
          );
        })()}

        {/* Draw author nodes and other nodes */}
        {nodes.map((d, i) => (
          <g
            key={d.data.path}
            className={clsx("transition-opacity hover:opacity-60", {
              "cursor-pointer": i === 0,
              "cursor-zoom-in": i > 0 && isTree(d.data),
              "animate-blink": clickedObject?.path === d.data.path
            })}
            {...createGroupHandlers(d, i === 0)}
          >
            {(numberOfDepthLevels === undefined || d.depth <= numberOfDepthLevels) && (
              <>
                <Node key={d.data.path} d={d} isSearchMatch={Boolean(searchResults[d.data.path])} />
                {labelsVisible && (
                  <NodeText key={`text|${path}|${d.data.path}|${chartType}|${sizeMetric}|${now}`} d={d}>
                    {collapseText({ d, isRoot: i === 0, path, displayText: d.data.name, chartType })}
                  </NodeText>
                )}
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
})

function filterGitTree(
  tree: GitTreeObject,
  commitCounts: Record<string, number>,
  showFilesWithoutChanges: boolean,
  ig: Ignore
): GitTreeObject {
  function filterNode(node: GitTreeObject | GitBlobObject): GitObject | null {
    if (ig.ignores(node.path)) {
      return null
    }
    if (node.type === "blob") {
      if (!showFilesWithoutChanges && !commitCounts[node.path]) return null
      return node
    } else {
      // It's a tree
      const children: GitObject[] = []
      for (const child of node.children) {
        const filteredChild = filterNode(child)
        if (filteredChild !== null) {
          children.push(filteredChild)
        }
      }
      if (children.length === 0) return null
      return { type: "tree", name: node.name, path: node.path, children } as GitTreeObject
    }
  }

  let filteredTree = filterNode(tree)
  if (filteredTree === null) filteredTree = { ...tree, children: [] }
  if (filteredTree.type !== "tree") {
    throw new Error("Filtered tree must be a tree structure")
  }

  return filteredTree
}

function Node({ d, isSearchMatch }: { d: CircleOrRectHiearchyNode; isSearchMatch: boolean }) {
  const [metricsData, authorColors] = useMetrics()
  const { chartType, metricType, transitionsEnabled } = useOptions()
  const [, size] = useComponentSize()
  
  const commonProps = useMemo(() => {
    let fillColor: string
    
    if (chartType === "AUTHOR_GRAPH" && d.data.path.includes("/@")) {
      // For author graph, use the authorColor property
      const authorName = d.data.name
      fillColor = authorColors.get(authorName) || "#cccccc"
    } else {
      // For other chart types, use the existing logic
      fillColor = isBlob(d.data)
        ? (metricsData.get(metricType)?.colormap.get(d.data.path) ?? missingInMapColor)
        : "transparent"
    }
    
    let props: JSX.IntrinsicElements["rect"] = {
      strokeWidth: "1px",
      fill: fillColor
    }

    if (chartType === "BUBBLE_CHART") {
      const circleDatum = d as HierarchyCircularNode<GitObject>
      props = {
        ...props,
        x: circleDatum.x - circleDatum.r,
        y: circleDatum.y - circleDatum.r + estimatedLetterHeightForDirText - 1,
        width: circleDatum.r * 2,
        height: circleDatum.r * 2,
        rx: circleDatum.r,
        ry: circleDatum.r
      }
    } else if (chartType === "TREE_MAP") {
      const datum = d as HierarchyRectangularNode<GitObject>
      props = {
        ...props,
        x: datum.x0,
        y: datum.y0,
        width: datum.x1 - datum.x0,
        height: datum.y1 - datum.y0,
        rx: treemapNodeBorderRadius,
        ry: treemapNodeBorderRadius
      }
    } else if (chartType === "AUTHOR_GRAPH") {
      const datum = d as HierarchyCircularNode<GitObject>
      
      // Check if this is the outer container (author-network) or an individual author
      if (d.data.name === "author-network") {
        // Outer container: rounded rectangle filling the whole space
        props = {
          ...props,
          x: 0,
          y: 0,
          width: size.width,
          height: size.height,
          rx: 20, // Rounded corners
          ry: 20,
          fill: "black", // Make container transparent
          stroke: "black" // Optional border
        }
      } else {
        // Individual authors: circular bubbles
        props = {
          ...props,
          x: datum.x - datum.r,
          y: datum.y - datum.r + estimatedLetterHeightForDirText - 1,
          width: datum.r * 2,
          height: datum.r * 2,
          rx: datum.r,
          ry: datum.r
        }
      }
    }
    return props
  }, [d, metricsData, metricType, chartType])

  return (
    <rect
      {...commonProps}
      className={cn(isSearchMatch ? "stroke-red-500" : isBlob(d.data) ? "stroke-transparent" : "", {
        "cursor-pointer": isBlob(d.data),
        "transition-all duration-500 ease-in-out": transitionsEnabled,
        "animate-stroke-pulse": isSearchMatch
      })}
    />
  )
}

function collapseText({
  d,
  isRoot,
  path,
  displayText,
  chartType
}: {
  d: CircleOrRectHiearchyNode
  isRoot: boolean
  path: string
  displayText: string
  chartType: ChartType
}): string | null {
  let textIsTooLong: (text: string) => boolean
  let textIsTooTall: (text: string) => boolean
  if (chartType === "BUBBLE_CHART") {
    const circleDatum = d as HierarchyCircularNode<GitObject>
    textIsTooLong = (text: string) => circleDatum.r < 50 || circleDatum.r * Math.PI < text.length * estimatedLetterWidth
    textIsTooTall = () => false
  } else {
    const datum = d as HierarchyRectangularNode<GitObject>
    textIsTooLong = (text: string) => datum.x1 - datum.x0 < text.length * estimatedLetterWidth
    textIsTooTall = () => {
      const heightAvailable = datum.y1 - datum.y0 - (isBlob(d.data) ? treemapBlobTextOffsetY : treemapTreeTextOffsetY)
      return heightAvailable < estimatedLetterHeightForDirText
    }
  }

  if (isRoot) {
    const pathSteps = path.split("/")
    const dispSteps = displayText.split("/")
    let ps = 0
    let ds = 0
    while (ps < pathSteps.length && ds < dispSteps.length) {
      if (pathSteps[ps] !== dispSteps[ds]) ps++
      else {
        ps++
        ds++
      }
    }

    displayText = dispSteps.slice(ds - 1).join("/")
  }

  if (textIsTooLong(displayText)) {
    displayText = displayText.replace(/\/.+\//gm, "/.../")
    if (textIsTooLong(displayText)) {
      return null
    }
  }

  if (textIsTooTall && textIsTooTall(displayText)) {
    displayText = displayText.replace(/\/.+\//gm, "/.../")

    if (textIsTooTall(displayText)) {
      return null
    }
  }

  return displayText
}

function NodeText({ d, children = null }: { d: CircleOrRectHiearchyNode; children?: React.ReactNode }) {
  const [metricsData] = useMetrics()
  const { metricType } = useOptions()
  const prefersLightMode = usePrefersLightMode()
  const isBubbleChart = isCircularNode(d)

  if (children === null) return null

  let textPathData: string

  if (isBubbleChart) {
    const yOffset = isTree(d.data) ? circleTreeTextOffsetY : circleBlobTextOffsetY
    const circleDatum = d as HierarchyCircularNode<GitObject>
    textPathData = circlePathFromCircle(circleDatum.x, circleDatum.y + yOffset, circleDatum.r)
  } else {
    const datum = d as HierarchyRectangularNode<GitObject>
    textPathData = roundedRectPathFromRect(
      datum.x0 + (isTree(d.data) ? treemapTreeTextOffsetX : treemapBlobTextOffsetX),
      datum.y0 + (isTree(d.data) ? treemapTreeTextOffsetY : treemapBlobTextOffsetY),
      datum.x1 - datum.x0,
      datum.y1 - datum.y0,
      0
    )
  }

  const fillColor = isBlob(d.data)
    ? getTextColorFromBackground(metricsData.get(metricType)?.colormap.get(d.data.path) ?? "#333")
    : prefersLightMode
      ? "#333"
      : "#fff"

  const textPathBaseProps = {
    startOffset: isBubbleChart ? "50%" : undefined,
    dominantBaseline: isBubbleChart ? (isTree(d.data) ? "central" : "hanging") : "hanging",
    textAnchor: isBubbleChart ? "middle" : "start",
    href: `#path-${d.data.path}`
  }

  return (
    <>
      <path d={textPathData} id={`path-${d.data.path}`} className="hidden" />
      {isTree(d.data) && isBubbleChart ? (
        <text
          className="pointer-events-none fill-none stroke-gray-100 stroke-[7px] font-mono text-sm font-bold dark:stroke-gray-800"
          strokeLinecap="round"
        >
          <textPath {...textPathBaseProps}>{children}</textPath>
        </text>
      ) : null}
      <text fill={fillColor} className="pointer-events-none stroke-none">
        <textPath
          {...textPathBaseProps}
          className={clsx("stroke-none font-mono", {
            "text-sm font-bold": isTree(d.data),
            "text-xs": !isTree(d.data)
          })}
        >
          {children}
        </textPath>
      </text>
    </>
  )
}

function isCircularNode(d: CircleOrRectHiearchyNode) {
  return typeof (d as HierarchyCircularNode<GitObject>).r === "number"
}

function createPartitionedHiearchy(
  databaseInfo: DatabaseInfo,
  tree: GitTreeObject,
  size: { height: number; width: number },
  chartType: ChartType,
  sizeMetricType: SizeMetricType,
  groupingType: GroupingType,
  path: string,
  renderCutoff: number,
  showFilesWithNoJSONRules: boolean
) {
  let currentTree = tree
  const steps = path.substring(tree.name.length + 1).split("/")

  for (let i = 0; i < steps.length; i++) {
    for (const child of currentTree.children) {
      if (child.type === "tree") {
        const childSteps = child.name.split("/")
        if (childSteps[0] === steps[i]) {
          currentTree = child
          i += childSteps.length - 1
          break
        }
      }
    }
  }

  if (groupingType === "FILE_TYPE") {
    const file = steps[steps.length - 1]
    const extension = file.split(".").pop() || ""
    currentTree = fileTypesGrouping(currentTree, extension)
  }

  if (groupingType === "JSON_RULES") {
    const file = steps[steps.length - 1]
    const zoomFilter = file.startsWith("#") ? file.substring(1) : ""
    currentTree = fileJSONRulesGrouping(currentTree, zoomFilter, showFilesWithNoJSONRules)
  }

  let castedTree = currentTree as GitObject

  const hiearchy = hierarchy(castedTree)
    .sum((d) => {
      const blob = d as GitBlobObject
      switch (sizeMetricType) {
        case "FILE_SIZE":
          return blob.sizeInBytes ?? 1
        case "MOST_COMMITS":
          return databaseInfo.commitCounts[blob.path] ?? 1
        case "EQUAL_SIZE":
          return 1
        case "LAST_CHANGED":
          return (
            (databaseInfo.lastChanged[blob.path] ?? databaseInfo.oldestChangeDate + 1) - databaseInfo.oldestChangeDate
          )
        case "MOST_CONTRIBS":
          return databaseInfo.contribSumPerFile[blob.path] ?? 1
      }
    })
    .sort((a, b) => (b.value ?? 1) - (a.value ?? 1))

  const cutOff = Number.isNaN(renderCutoff) ? 2 : renderCutoff

  if (chartType === "TREE_MAP") {
    const treeMapPartition = treemap<GitObject>()
      .tile(treemapResquarify)
      .size([size.width, size.height])
      .paddingInner(2)
      .paddingOuter(4)
      .paddingTop(treemapPaddingTop)

    const tmPartition = treeMapPartition(hiearchy)

    filterTree(tmPartition, (child) => {
      const cast = child as HierarchyRectangularNode<GitObject>
      return cast.x1 - cast.x0 >= cutOff && cast.y1 - cast.y0 >= cutOff
    })

    return tmPartition
  }
  if (chartType === "BUBBLE_CHART") {
    const bubbleChartPartition = pack<GitObject>()
      .size([size.width, size.height - estimatedLetterHeightForDirText])
      .padding(bubblePadding)
    const bPartition = bubbleChartPartition(hiearchy)
    filterTree(bPartition, (child) => {
      const cast = child as HierarchyCircularNode<GitObject>
      return cast.r >= cutOff
    })
    return bPartition
  }
  else if (chartType === "AUTHOR_GRAPH") {
    // Create a network/graph layout for author relationships
    console.log("lol:", sizeMetricType)

    const authorNetwork = createAuthorNetworkHierarchy(databaseInfo, currentTree, sizeMetricType)
    
    // Apply a custom sum function that gives each author a fixed size
    const authorHierarchy = authorNetwork.sum((d) => {
      // For author nodes, return the calculated size
      if (d.name && d.path.includes("/@")) {
        const authorData = d as any
        return authorData.size || 1 // Use the size property
      }
      return 1 // Default for root node
    })
    // Use pack layout to position author circles
    const authorGraphPartition = pack<GitObject>()
      .size([size.width, size.height - estimatedLetterHeightForDirText])
      .padding(50)
    
    const agPartition = authorGraphPartition(authorHierarchy)

    const nodePositions: Record<string, { x: number; y: number; r: number }> = {};
      agPartition.descendants().forEach(node => {
        if (node.data.path.includes("/@")) {
          nodePositions[node.data.name] = { x: node.x, y: node.y, r: node.r };
        }
    });
    
    // Filter out circles that are too small
    filterTree(agPartition, (child) => {
      const cast = child as HierarchyCircularNode<GitObject>
      return cast.r >= cutOff
    })
    
    return agPartition
  }
  else {
    throw new Error("Unknown chart type: " + chartType)
  }
}

function filterTree(node: HierarchyNode<GitObject>, filter: (child: HierarchyNode<GitObject>) => boolean) {
  node.children = node.children?.filter((c) => filter(c))
  for (const child of node.children ?? []) {
    if ((child.children?.length ?? 0) > 0) filterTree(child, filter)
  }
}

// a rx ry angle large-arc-flag sweep-flag dx dy
// rx and ry are the two radii of the ellipse
// angle represents a rotation (in degrees) of the ellipse relative to the x-axis;
// large-arc-flag and sweep-flag allows to chose which arc must be drawn as 4 possible arcs can be drawn out of the other parameters.
/**
 * This function generates a path for a circle with a given radius and center
 * @param x x-coordinate of circle center
 * @param y y-coordinate of circle center
 * @param r radius of circle
 * @returns A string meant to be passed as the d attribute to a path element
 */
function circlePathFromCircle(x: number, y: number, r: number) {
  return `M${x},${y}
          m0,${r}
          a${r},${r} 0 1,1 0,${-r * 2}
          a${r},${r} 0 1,1 0,${r * 2}`
}

function roundedRectPathFromRect(x: number, y: number, width: number, height: number, radius: number) {
  radius = Math.min(radius, Math.floor(width / 3), Math.floor(height / 3))
  return `M${x + radius},${y}
          h${width - radius * 2}
          a${radius},${radius} 0 0 1 ${radius},${radius}
          v${height - radius * 2}
          a${radius},${radius} 0 0 1 ${-radius},${radius}
          h${-width + radius * 2}
          a${radius},${radius} 0 0 1 ${-radius},${-radius}
          v${-height + radius * 2}
          a${radius},${radius} 0 0 1 ${radius},${-radius}
          z`
}

// Helper to flatten the tree to blobs
function flatten(tree: GitTreeObject): GitBlobObject[] {
  let files: GitBlobObject[] = []
  for (const child of tree.children) {
    if (child.type === "tree") {
      files = files.concat(flatten(child))
    } else if (child.type === "blob") {
      files.push(child)
    }
  }
  return files
}

// Helper to hash a string
function hashString(str: string): string {
  return createHash("sha1").update(str).digest("hex")
}

export function fileTypesGrouping(tree: GitTreeObject, zoomFilter: string): GitTreeObject {
  const blobs = flatten(tree)
  const fileTypeGroups: Record<string, GitBlobObject[]> = {}

  for (const file of blobs) {
    if (zoomFilter !== "" && file.path.split(".").pop() !== zoomFilter) continue
    let ext = file.name.split(".").pop()

    if (ext === undefined) ext = "no-extension"
    if (file.name.startsWith(".") && file.name.split(".").length < 3) ext = "dot-files"

    if (!fileTypeGroups[ext]) fileTypeGroups[ext] = []
    fileTypeGroups[ext].push(file)
  }

  const children: GitTreeObject[] = Object.entries(fileTypeGroups).map(([ext, files]) => {
    // Create a GitTreeObject for each extension
    return {
      type: "tree",
      name: "." + ext,
      path: tree.path + `/.${ext}`,
      children: files,
      hash: hashString(files.map((f) => f.hash).join(","))
    }
  })

  return {
    type: "tree",
    name: "root-by-filetype",
    path: tree.path,
    children: children,
    hash: hashString("root-by-filetype" + children.map((c) => c.hash).join(","))
  }
}

const fileTypeRules = fileTypeRulesJSON.map((rule) => ({
  ...rule,
  regex: new RegExp(rule.pattern, "i")
}))

export function fileJSONRulesGrouping(
  tree: GitTreeObject,
  zoomFilter: string,
  showFilesWithNoJSONRules: boolean
): GitTreeObject {
  const blobs = flatten(tree)

  // Return early when zoomed on a group (no need to check all rules)
  if (zoomFilter !== "" && zoomFilter !== "ungrouped") {
    const filteredFiles = blobs.filter((b) => b.path.includes(zoomFilter))
    return {
      type: "tree",
      name: "root-by-json-rules",
      path: tree.path,
      children: [
        {
          type: "tree",
          name: zoomFilter,
          path: tree.path + `/${zoomFilter}`,
          children: filteredFiles,
          hash: hashString(filteredFiles.map((f) => f.hash).join(","))
        }
      ],
      hash: hashString("root-by-json-rules" + hashString(filteredFiles.map((f) => f.hash).join(",")))
    }
  }

  const jsonGroups: Record<string, GitBlobObject[]> = {}
  const unmatchedFiles: GitBlobObject[] = []

  // Group blobs by file type rules - optimized with pre-compiled regexes
  for (const blob of blobs) {
    let matched = false
    for (const rule of fileTypeRules) {
      if (rule.regex.test(blob.path)) {
        if (zoomFilter !== "ungrouped") {
          if (!jsonGroups[rule.name]) jsonGroups[rule.name] = []
          jsonGroups[rule.name].push(blob)
        }
        matched = true
        break
      }
    }
    if (!matched) {
      unmatchedFiles.push(blob)
    }
  }

  // Create the tree
  const children: GitTreeObject[] = Object.entries(jsonGroups).map(([group, files]) => ({
    type: "tree",
    name: "#" + group,
    path: tree.path + `/#${group}`,
    children: files,
    hash: hashString(files.map((f) => f.hash).join(","))
  }))

  // Add unmatched files as a separate group if requested
  if (showFilesWithNoJSONRules && unmatchedFiles.length > 0) {
    children.push({
      type: "tree",
      name: "#ungrouped",
      path: tree.path + "/#ungrouped",
      children: unmatchedFiles,
      hash: hashString(unmatchedFiles.map((f) => f.hash).join(","))
    })
  }

  return {
    type: "tree",
    name: "root-by-json-rules",
    path: tree.path,
    children,
    hash: hashString("root-by-json-rules" + children.map((c) => c.hash).join(","))
  }
}

function createAuthorNetworkHierarchy(
  databaseInfo: DatabaseInfo,
  tree: GitTreeObject,
  context: string
): HierarchyNode<GitObject> {
  const fixedAuthorSize = 1000

  // Choose stat type
  const searched_Stat = context === "MOST_CONTRIBS" ? "nb_line_change" : "nb_commits"

  // Get all authors and their total stats
  const authorEntries = Object.entries(databaseInfo.authorsTotalStats)

  // Get all values for scaling
  const allValues = authorEntries.map(([author, stats]) => stats[searched_Stat] ?? 1)
  const totalValue = allValues.reduce((sum, count) => sum + count, 0)

  // Get relationships map
  const relationshipsMap = getAuthorsRelationships(databaseInfo);

  const authorNodes: GitBlobObject[] = authorEntries.map(([author, stats], index) => {
    const value = stats[searched_Stat] ?? 1

    // Calculate normalized size
    const normalizedSize = value / totalValue
    const minSize = 0.1
    const maxSize = 2.0
    const scaledSize = minSize + (maxSize - minSize) * Math.sqrt(normalizedSize)

    return {
      type: "blob",
      name: author,
      path: tree.path + `/@${author}`,
      hash: hashString(`author-${author}-${index}`),
      contributionCount: value,
      nb_commits: stats.nb_commits ?? 0,
      nb_line_change: stats.nb_line_change ?? 0,
      sizeInBytes: scaledSize * fixedAuthorSize,
      size: scaledSize * fixedAuthorSize,
      relationships: relationshipsMap[author]?.Relationships ?? {} // <-- Add relationships here
    }
  })

  const authorNetworkRoot: GitTreeObject = {
    type: "tree",
    name: "author-network",
    path: tree.path,
    children: authorNodes,
    hash: hashString("author-network" + authorNodes.map((n) => n.hash).join(","))
  }

  return hierarchy(authorNetworkRoot as GitObject)
}

export function getAuthorsRelationships(
  databaseInfo: DatabaseInfo,
) {
  const relationshipMap: Record<string, { Relationships: Record<string, { 
    commonFiles: string[],
    author1Contribs: { nb_commits: number; nb_line_change: number },
    author2Contribs: { nb_commits: number; nb_line_change: number }
  }> }> = {};

  const authorsFileStats = databaseInfo.authorsFilesStats;
  const authors = Object.keys(authorsFileStats);

  for (let i = 0; i < authors.length; i++) {
    const author1 = authors[i];
    relationshipMap[author1] = { Relationships: {} };

    for (let j = i + 1; j < authors.length; j++) {
      const author2 = authors[j];

      // Find common files
      const files1 = Object.keys(authorsFileStats[author1]);
      const files2 = Object.keys(authorsFileStats[author2]);
      // Only count files where line change is at least 20% of the other author
      const commonFiles = files1.filter(f => {
        if (!files2.includes(f)) return false;
        const lc1 = authorsFileStats[author1][f].nb_line_change;
        const lc2 = authorsFileStats[author2][f].nb_line_change;
        // Both must have at least 20% of the other's line change
        return (
          (lc1 >= 0.2 * lc2 && lc2 > 0) ||
          (lc2 >= 0.2 * lc1 && lc1 > 0)
        );
      });

      if (commonFiles.length > 0) {
        relationshipMap[author1].Relationships[author2] = {
          commonFiles,
          author1Contribs: commonFiles.reduce((acc, file) => ({
            nb_commits: acc.nb_commits + authorsFileStats[author1][file].nb_commits,
            nb_line_change: acc.nb_line_change + authorsFileStats[author1][file].nb_line_change
          }), { nb_commits: 0, nb_line_change: 0 }),
          author2Contribs: commonFiles.reduce((acc, file) => ({
            nb_commits: acc.nb_commits + authorsFileStats[author2][file].nb_commits,
            nb_line_change: acc.nb_line_change + authorsFileStats[author2][file].nb_line_change
          }), { nb_commits: 0, nb_line_change: 0 })
        };
      }
    }
  }

  return relationshipMap;
}