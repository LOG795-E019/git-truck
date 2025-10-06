import type { HierarchyCircularNode, HierarchyNode, HierarchyRectangularNode } from "d3-hierarchy"
import { hierarchy, pack, treemap, treemapResquarify } from "d3-hierarchy"
import type { MouseEventHandler } from "react"
import { useDeferredValue, memo, useEffect, useMemo, useState } from "react"
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
import type { GroupingType } from "~/metrics/grouping"
import { useSearch } from "~/contexts/SearchContext"
import type { DatabaseInfo } from "~/routes/$repo.$"
import ignore, { type Ignore } from "ignore"
import { cn, usePrefersLightMode } from "~/styling"
import { isChrome, isChromium, isEdgeChromium } from "react-device-detect"
import { createHash } from "crypto"
import fileTypeRulesJSON from "./fileTypeRules.json"

type CircleOrRectHiearchyNode = HierarchyCircularNode<GitObject> | HierarchyRectangularNode<GitObject>

export const Chart = memo(function Chart({ setHoveredObject }: { setHoveredObject: (obj: GitObject | null) => void }) {
  const [ref, rawSize] = useComponentSize()
  const { searchResults } = useSearch()
  const size = useDeferredValue(rawSize)
  const { databaseInfo } = useData()
  const {
    chartType,
    sizeMetric,
    groupingType,
    depthType,
    hierarchyType,
    labelsVisible,
    renderCutoff,
    minBubbleSize,
    maxBubbleSize,
    selectedAuthors,
    fileGroups,
    selectedFilePaths,
    fileAuthorMode
  } = useOptions()
  const { path } = usePath()
  const { clickedObject, setClickedObject } = useClickedObject()
  const { setPath } = usePath()
  const { showFilesWithoutChanges, showFilesWithNoJSONRules } = useOptions()
  const [, authorColors] = useMetrics()

  const [selectedAuthorName, setSelectedAuthorName] = useState<string>("")
  // Get relationships map
  const relationshipsMap = getAuthorsRelationships(databaseInfo)
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
      minBubbleSize,
      maxBubbleSize,
      showFilesWithNoJSONRules,
      selectedAuthors,
      fileGroups,
      selectedFilePaths, // Add this parameter
      fileAuthorMode // Add this parameter
    ).descendants()
    console.timeEnd("nodes")
    return res
  }, [
    size,
    chartType,
    sizeMetric,
    path,
    renderCutoff,
    minBubbleSize,
    maxBubbleSize,
    databaseInfo,
    filetree,
    selectedAuthors,
    fileGroups,
    selectedFilePaths,
    fileAuthorMode
  ])

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

            // For FILE_AUTHORS grouping, author bubbles should show details
            if (groupingType === "FILE_AUTHORS" && d.data.path.includes("/@")) {
              return setClickedObject(d.data)
            }

            // For other cases, show details
            return setClickedObject(d.data)
          },
          onMouseOver: () => setHoveredObject(d.data as GitObject),
          onMouseOut: () => setHoveredObject(null)
        }
      : {
          onClick: (evt) => {
            evt.stopPropagation()

            if (isRoot) {
              // Handle root clicks - zoom out
              if (groupingType === "FILE_AUTHORS") {
                // For FILE_AUTHORS, zooming out means going back to multi-file view
                setPath("/")
              } else {
                // Regular zoom out logic
                const parentPath = path.split("/").slice(0, -1).join("/")
                if (parentPath === "") setPath("/")
                else setPath(parentPath)
              }
            } else {
              // Handle non-root clicks for tree elements

              // Special handling for FILE_AUTHORS grouping
              if (groupingType === "FILE_AUTHORS" && fileGroups.length > 1) {
                setSelectedAuthor(null)
                // Clicking a group container zooms into that group
                if (isTree(d.data) && d.data.path.startsWith("/group-")) {
                  console.log("FILE_AUTHORS: Zooming into group:", d.data.path)
                  setPath(d.data.path)
                  return
                }
              }
              // Regular tree navigation for other groupings
              else if (groupingType !== "FILE_AUTHORS" && isTree(d.data)) {
                console.log("Regular tree zoom:", d.data.path)
                setPath(d.data.path)
              }
              // If none of the zoom conditions are met, show details
              else {
                console.log("No zoom, showing details for:", d.data.path)
                setClickedObject(d.data)
              }
            }
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
        {chartType === "AUTHOR_GRAPH" &&
          (() => {
            // Build node position map
            const nodePositions: Record<string, { x: number; y: number; r: number }> = {}
            nodes.forEach((d) => {
              if (d.data.path && d.data.path.includes("/@")) {
                const node = d as HierarchyCircularNode<GitObject>
                nodePositions[d.data.name] = { x: node.x, y: node.y, r: node.r }
              }
            })

            console.log("Related authors for", relationshipsMap)
            // Extract unique array of authors from relationshipsMap
            const authorsInRelationshipMap = Array.from(
              new Set([
                ...Object.keys(relationshipsMap),
                ...Object.values(relationshipsMap).flatMap((rel) => Object.keys(rel.Relationships))
              ])
            )

            return Object.entries(relationshipsMap).flatMap(([author1, relObj]) =>
              Object.entries(relObj.Relationships).flatMap(([author2, relData]) => {
                const pos1 = nodePositions[author1]
                const pos2 = nodePositions[author2]
                if (!pos1 || !pos2) return []
                const searched_Stat = sizeMetric === "MOST_CONTRIBS" ? "nb_line_change" : "nb_commits"
                const author1Value = relData.author1Contribs[searched_Stat]
                const author2Value = relData.author2Contribs[searched_Stat]
                const totalValue = author1Value + author2Value

                // Avoid division by zero
                const author1Percent = totalValue > 0 ? author1Value / totalValue : 0
                const author2Percent = totalValue > 0 ? author2Value / totalValue : 0

                // Scale thickness (adjust base and scaling as needed)
                const multiplier = searched_Stat === "nb_commits" ? 10 : 1
                const baseWidth =
                  Math.max(2, Math.log(totalValue * multiplier + 1)) * (20 / authorsInRelationshipMap.length)
                const strokeWidth1 = baseWidth * author1Percent
                const strokeWidth2 = baseWidth * author2Percent
                const color1 = authorColors.get(author1) || "#888"
                const color2 = authorColors.get(author2) || "#888"

                // Offset each line by half the other line's width
                const offsetA = strokeWidth2 / 2
                const offsetB = strokeWidth1 / 2

                // Perpendicular vector (normalized)
                const dx = pos2.x - pos1.x
                const dy = pos2.y - pos1.y
                const length = Math.sqrt(dx * dx + dy * dy) || 1
                const perpX = -dy / length
                const perpY = dx / length

                // Author 1's line (offset by half of author2's width)
                const x1a = pos1.x + perpX * offsetA
                const y1a = pos1.y + perpY * offsetA
                const x2a = pos2.x + perpX * offsetA
                const y2a = pos2.y + perpY * offsetA

                // Author 2's line (offset by half of author1's width)
                const x1b = pos1.x - perpX * offsetB
                const y1b = pos1.y - perpY * offsetB
                const x2b = pos2.x - perpX * offsetB
                const y2b = pos2.y - perpY * offsetB

                // ...existing code...
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
                    className="cursor-pointer transition-opacity hover:opacity-100"
                    onMouseEnter={() => {
                      const tooltipContent = {
                        type: "blob", // Use existing type
                        name: `${author1} ↔ ${author2} : ${searched_Stat}: ${totalValue}`,
                        path: `relationship-${author1}-${author2}`,
                        sizeInBytes: totalValue // Use existing property that tooltip reads
                        // Add any other properties your tooltip expects
                      }
                      setHoveredObject(tooltipContent as any)
                    }}
                    onMouseLeave={() => setHoveredObject(null)}
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
                    className="cursor-pointer transition-opacity hover:opacity-100"
                    onMouseEnter={() => {
                      const tooltipContent = {
                        type: "blob", // Use existing type
                        name: `${author1} ↔ ${author2} : ${searched_Stat}: ${totalValue}`,
                        path: `relationship-${author1}-${author2}`,
                        sizeInBytes: totalValue // Use existing property that tooltip reads
                        // Add any other properties your tooltip expects
                      }
                      setHoveredObject(tooltipContent as any)
                    }}
                    onMouseLeave={() => setHoveredObject(null)}
                  />
                ]
              })
            )
          })()}

        {/* Draw author nodes and other nodes */}
        {nodes.map((d, i) => {
          const authorName = clickedObject?.path === d.data.path ? clickedObject.name : "" // Check if the author has relationships
          return (
            <g
              key={d.data.path}
              className={clsx("transition-opacity hover:opacity-60", {
                // Root element always has pointer cursor OR non-root clickable elements
                "cursor-pointer":
                  i === 0 ||
                  (i > 0 &&
                    !isTree(d.data) &&
                    // Show pointer cursor for author bubbles in FILE_AUTHORS mode
                    ((groupingType === "FILE_AUTHORS" && d.data.path.includes("/@")) ||
                      // Show pointer cursor for blobs in other modes
                      groupingType !== "FILE_AUTHORS")),

                // Non-root elements - prioritize zoom cursor over pointer cursor
                "cursor-zoom-in":
                  i > 0 &&
                  isTree(d.data) &&
                  // Show zoom cursor for group containers in FILE_AUTHORS mode
                  ((groupingType === "FILE_AUTHORS" && fileGroups.length > 1 && d.data.path.startsWith("/group-")) ||
                    // Show zoom cursor for regular tree navigation
                    (groupingType !== "FILE_AUTHORS" && isTree(d.data))),

                "animate-blink": clickedObject?.path === d.data.path,
                "opacity-30":
                  clickedObject?.path != d.data.path &&
                  !relationshipsMap[selectedAuthorName]?.Relationships?.[d.data.name] &&
                  clickedObject != null,
                "opacity-100":
                  clickedObject == null ||
                  clickedObject?.path === d.data.path ||
                  !relationshipsMap[selectedAuthorName]?.Relationships?.[d.data.name]
              })}
              {...createGroupHandlers(d, i === 0)}
              onClick={(evt) => {
                evt.stopPropagation()
                if (chartType === "AUTHOR_GRAPH" && d.data.path.includes("/@")) {
                  setSelectedAuthorName(d.data.name)
                  setClickedObject(d.data)
                } else {
                  createGroupHandlers(d, i === 0).onClick(evt)
                }
              }}
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
          )
        })}
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
  const { chartType, metricType, transitionsEnabled, groupingType } = useOptions() // Add groupingType
  const [, size] = useComponentSize()

  const commonProps = useMemo(() => {
    let fillColor: string

    if (chartType === "AUTHOR_GRAPH" && d.data.path.includes("/@")) {
      // For author graph, use the authorColor property
      const authorName = d.data.name
      fillColor = authorColors.get(authorName) || "#cccccc"
    } else if (groupingType === "FILE_AUTHORS" && d.data.path.includes("/@")) {
      // For file authors view, use author colors
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
    return props
  }, [d, metricsData, metricType, chartType, groupingType]) // Add groupingType to dependencies

  // Don't render the author-network container node in AUTHOR_GRAPH
  if (chartType === "AUTHOR_GRAPH" && d.data.name === "author-network") {
    return null
  }

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
  minBubbleSize: number,
  maxBubbleSize: number,
  showFilesWithNoJSONRules: boolean,
  selectedAuthors: string[],
  fileGroups: Array<{ id: string; name: string; pattern: string; filePaths: string[] }>,
  selectedFilePaths: string[], // Add this parameter
  fileAuthorMode: "groups" | "individual" // Add this parameter
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

  if (groupingType === "AUTHOR_FILES") {
    // Extract author filter from path for AUTHOR_FILES grouping
    let authorFilter = ""
    if (path.includes("/@")) {
      authorFilter = path.split("/@")[1] || ""
    }
    currentTree = createAuthorFileHierarchy(databaseInfo, currentTree, sizeMetricType, authorFilter)
  }

  let castedTree = currentTree as GitObject

  // Add this new section for FILE_AUTHORS grouping
  if (groupingType === "FILE_AUTHORS") {
    if (fileAuthorMode === "groups") {
      // Existing group logic...
      if (fileGroups.length === 0) {
        const emptyRoot: GitTreeObject = {
          type: "tree",
          name: "Create file groups to view aggregated authors",
          path: "/",
          children: [],
          hash: hashString("no-groups-selected")
        }
        castedTree = emptyRoot as GitObject
      } else {
        // Existing group logic...
        if (fileGroups.length === 1) {
          // Single group: show aggregated authors directly as bubbles
          const group = fileGroups[0]
          const aggregatedAuthors = createAggregatedAuthorNodesForGroup(databaseInfo, group, sizeMetricType)

          const singleGroupRoot: GitTreeObject = {
            type: "tree",
            name: `Authors in ${group.name}`,
            path: `/group-${group.id}`,
            children: aggregatedAuthors,
            hash: hashString("single-group-authors-" + group.id)
          }
          castedTree = singleGroupRoot as GitObject
        } else {
          // Multiple groups: show groups as containers with aggregated authors
          if (path === "/" || path === "") {
            // Root level: show all groups as containers
            const groupNodes: GitTreeObject[] = fileGroups.map((group) => {
              const aggregatedAuthors = createAggregatedAuthorNodesForGroup(databaseInfo, group, sizeMetricType)

              return {
                type: "tree",
                name: group.name,
                path: `/group-${group.id}`,
                children: aggregatedAuthors,
                hash: hashString("group-authors-" + group.id)
              }
            })

            const multiGroupRoot: GitTreeObject = {
              type: "tree",
              name: "File Groups Authors View",
              path: "/",
              children: groupNodes,
              hash: hashString("multi-group-authors-" + fileGroups.map((g) => g.id).join(","))
            }
            castedTree = multiGroupRoot as GitObject
          } else {
            // Zoomed into a specific group
            const groupId = path.replace("/group-", "")
            const targetGroup = fileGroups.find((g) => g.id === groupId)

            if (targetGroup) {
              const aggregatedAuthors = createAggregatedAuthorNodesForGroup(databaseInfo, targetGroup, sizeMetricType)

              const zoomedGroupRoot: GitTreeObject = {
                type: "tree",
                name: `Authors in ${targetGroup.name}`,
                path: path,
                children: aggregatedAuthors,
                hash: hashString("group-authors-zoomed-" + targetGroup.id)
              }
              castedTree = zoomedGroupRoot as GitObject
            } else {
              // Group not found
              const emptyRoot: GitTreeObject = {
                type: "tree",
                name: "Group not found",
                path: "/",
                children: [],
                hash: hashString("group-not-found")
              }
              castedTree = emptyRoot as GitObject
            }
          }
        }
      }
    } else {
      // Individual files mode
      if (selectedFilePaths.length === 0) {
        const emptyRoot: GitTreeObject = {
          type: "tree",
          name: "Select individual files to view their authors",
          path: "/",
          children: [],
          hash: hashString("no-individual-files-selected")
        }
        castedTree = emptyRoot as GitObject
      } else {
        // Show individual file bubbles with their authors
        if (selectedFilePaths.length === 1) {
          // Single file: show authors directly
          const filePath = selectedFilePaths[0]
          const authorNodes = createAuthorNodesForFile(databaseInfo, filePath, sizeMetricType)

          const singleFileRoot: GitTreeObject = {
            type: "tree",
            name: `Authors of ${filePath.split("/").pop()}`,
            path: filePath,
            children: authorNodes,
            hash: hashString("single-file-authors-" + filePath)
          }
          castedTree = singleFileRoot as GitObject
        } else {
          // Multiple files: show files as containers with their authors
          const fileNodes: GitTreeObject[] = selectedFilePaths.map((filePath) => {
            const authorNodes = createAuthorNodesForFile(databaseInfo, filePath, sizeMetricType)

            return {
              type: "tree",
              name: filePath.split("/").pop() || filePath,
              path: filePath,
              children: authorNodes,
              hash: hashString("file-authors-" + filePath)
            }
          })

          const multiFileRoot: GitTreeObject = {
            type: "tree",
            name: "Individual Files Authors View",
            path: "/",
            children: fileNodes,
            hash: hashString("multi-file-authors-" + selectedFilePaths.join(","))
          }
          castedTree = multiFileRoot as GitObject
        }
      }
    }
  } else {
    // For non-FILE_AUTHORS groupings, use the existing logic
    castedTree = currentTree as GitObject
  }

  const hiearchy = hierarchy(castedTree)
    .sum((d) => {
      // Special handling for FILE_AUTHORS grouping
      if (groupingType === "FILE_AUTHORS" && d.path && d.path.includes("/@")) {
        const authorBlob = d as GitBlobObject
        // Use the pre-calculated size from createAuthorNodesForFile
        return authorBlob.sizeInBytes ?? 1
      }

      // Default logic for other groupings
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
  } else if (chartType === "BUBBLE_CHART") {
    const bubbleChartPartition = pack<GitObject>()
      .size([size.width, size.height - estimatedLetterHeightForDirText])
      .padding(bubblePadding)
    const bPartition = bubbleChartPartition(hiearchy)
    filterTree(bPartition, (child) => {
      const cast = child as HierarchyCircularNode<GitObject>
      return cast.r >= cutOff
    })
    return bPartition
  } else if (chartType === "AUTHOR_GRAPH") {
    // Create a network/graph layout for author relationships
    const authorNetwork = createAuthorNetworkHierarchy(
      databaseInfo,
      currentTree,
      sizeMetricType,
      minBubbleSize,
      maxBubbleSize,
      selectedAuthors
    )

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

    const nodePositions: Record<string, { x: number; y: number; r: number }> = {}
    agPartition.descendants().forEach((node) => {
      if (node.data.path.includes("/@")) {
        nodePositions[node.data.name] = { x: node.x, y: node.y, r: node.r }
      }
    })

    // Filter out circles that are too small
    filterTree(agPartition, (child) => {
      const cast = child as HierarchyCircularNode<GitObject>
      return cast.r >= cutOff
    })

    return agPartition
  } else {
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

function createAuthorFileHierarchy(
  databaseInfo: DatabaseInfo,
  tree: GitTreeObject,
  context: string,
  authorFilter: string
): GitTreeObject {
  const blobs = flatten(tree)
  const searched_Stat = context === "MOST_CONTRIBS" ? "nb_line_change" : "nb_commits"
  const authorFileGroups: Record<string, GitBlobObject[]> = {}

  // Group files by their top contributing author
  for (const file of blobs) {
    const filePath = file.path
    let topAuthor = "unknown"
    let maxContrib = 0

    // Find the author with the highest contribution to this file
    for (const [author, authorFiles] of Object.entries(databaseInfo.authorsFilesStats)) {
      if (authorFiles[filePath]) {
        const contrib = authorFiles[filePath][searched_Stat] || 0
        if (contrib > maxContrib) {
          maxContrib = contrib
          topAuthor = author
        }
      }
    }

    // Filter by author if authorFilter is provided (like zoomFilter in fileTypesGrouping)
    if (authorFilter !== "" && topAuthor !== authorFilter) continue

    // Add file to the top author's group
    if (!authorFileGroups[topAuthor]) authorFileGroups[topAuthor] = []
    authorFileGroups[topAuthor].push(file)
  }

  // Create GitTreeObject for each author containing their files
  const children: GitTreeObject[] = Object.entries(authorFileGroups).map(([author, files]) => {
    // Sort files by contribution (highest first) and take top 5
    const sortedFiles = files
      .map((file) => ({
        ...file,
        authorContrib: databaseInfo.authorsFilesStats[author]?.[file.path]?.[searched_Stat] || 0
      }))
      .sort((a, b) => b.authorContrib - a.authorContrib)

    return {
      type: "tree",
      name: author,
      path: tree.path + `/@${author}`,
      children: sortedFiles,
      hash: hashString(author + files.map((f) => f.hash).join(","))
    }
  })

  return {
    type: "tree",
    name: "root-by-author",
    path: tree.path,
    children,
    hash: hashString("root-by-author" + children.map((c) => c.hash).join(","))
  }
}

function createAuthorNetworkHierarchy(
  databaseInfo: DatabaseInfo,
  tree: GitTreeObject,
  sizeMetricType: string,
  minBubbleSize: number,
  maxBubbleSize: number,
  selectedAuthors: string[]
): HierarchyNode<GitObject> {
  const fixedAuthorSize = 1000

  // Get all authors and their total stats, filtered by selected authors
  const authorEntries = Object.entries(databaseInfo.authorsTotalStats).filter(([author]) =>
    selectedAuthors.includes(author)
  )

  // Get all values for scaling
  const allValues = authorEntries.map(
    ([author, stats]) => stats[sizeMetricType === "MOST_CONTRIBS" ? "nb_line_change" : "nb_commits"] ?? 1
  )
  const totalValue = allValues.reduce((sum, count) => sum + count, 0)

  // Get relationships map
  const relationshipsMap = getAuthorsRelationships(databaseInfo)

  const authorNodes: GitBlobObject[] = authorEntries.map(([author, stats], index) => {
    let value: number
    switch (sizeMetricType) {
      case "MOST_COMMITS":
        value = stats["nb_commits"] ?? 1
        break
      case "MOST_CONTRIBS":
        value = stats["nb_line_change"] ?? 1
        break
      default: // EQUAL_SIZE
        value = 1
        break
    }

    // Calculate normalized size
    const normalizedSize = value / totalValue
    const minSize = minBubbleSize
    const maxSize = maxBubbleSize
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

export function getAuthorsRelationships(databaseInfo: DatabaseInfo) {
  const relationshipMap: Record<
    string,
    {
      Relationships: Record<
        string,
        {
          commonFiles: string[]
          author1Contribs: { nb_commits: number; nb_line_change: number }
          author2Contribs: { nb_commits: number; nb_line_change: number }
        }
      >
    }
  > = {}

  const authorsFileStats = databaseInfo.authorsFilesStats
  const authors = Object.keys(authorsFileStats)

  // Initialize all authors first
  for (const author of authors) {
    if (!relationshipMap[author]) relationshipMap[author] = { Relationships: {} }
  }

  for (let i = 0; i < authors.length; i++) {
    const author1 = authors[i]

    for (let j = i + 1; j < authors.length; j++) {
      const author2 = authors[j]

      // Find common files
      const files1 = Object.keys(authorsFileStats[author1])
      const files2 = Object.keys(authorsFileStats[author2])
      const commonFiles = files1.filter((f) => {
        if (!files2.includes(f)) return false
        const lc1 = authorsFileStats[author1][f].nb_line_change
        const lc2 = authorsFileStats[author2][f].nb_line_change
        return (lc1 >= 0.2 * lc2 && lc2 > 0) || (lc2 >= 0.2 * lc1 && lc1 > 0)
      })

      if (commonFiles.length > 0) {
        const relData = {
          commonFiles,
          author1Contribs: commonFiles.reduce(
            (acc, file) => ({
              nb_commits: acc.nb_commits + authorsFileStats[author1][file].nb_commits,
              nb_line_change: acc.nb_line_change + authorsFileStats[author1][file].nb_line_change
            }),
            { nb_commits: 0, nb_line_change: 0 }
          ),
          author2Contribs: commonFiles.reduce(
            (acc, file) => ({
              nb_commits: acc.nb_commits + authorsFileStats[author2][file].nb_commits,
              nb_line_change: acc.nb_line_change + authorsFileStats[author2][file].nb_line_change
            }),
            { nb_commits: 0, nb_line_change: 0 }
          )
        }
        relationshipMap[author1].Relationships[author2] = relData
        relationshipMap[author2].Relationships[author1] = {
          commonFiles,
          author1Contribs: relData.author2Contribs,
          author2Contribs: relData.author1Contribs
        }
      }
    }
  }

  return relationshipMap
}

// Helper function to create author nodes for a specific file
function createAuthorNodesForFile(
  databaseInfo: DatabaseInfo,
  filePath: string,
  sizeMetricType: SizeMetricType
): GitBlobObject[] {
  const fileAuthors: Array<{ author: string; contribution: number }> = []

  Object.entries(databaseInfo.authorsFilesStats).forEach(([author, fileStats]) => {
    if (fileStats[filePath]) {
      let contribution = 0
      switch (sizeMetricType) {
        case "MOST_COMMITS":
          contribution = fileStats[filePath].nb_commits || 0
          break
        case "MOST_CONTRIBS":
          contribution = fileStats[filePath].nb_line_change || 0
          break
        case "EQUAL_SIZE":
          // For equal size, all authors get the same value
          contribution = 1000 // Fixed value for all authors
          break
        case "FILE_SIZE":
        case "LAST_CHANGED":
          // For FILE_AUTHORS grouping, these don't make sense for individual authors
          // Default to line changes as it's most meaningful for author contributions
          contribution = fileStats[filePath].nb_line_change || 0
          break
      }

      if (contribution > 0) {
        fileAuthors.push({ author, contribution })
      }
    }
  })

  // Sort by contribution (largest first) - but for EQUAL_SIZE they'll all be the same
  fileAuthors.sort((a, b) => b.contribution - a.contribution)

  // Calculate total for scaling
  const totalContribution = fileAuthors.reduce((sum, item) => sum + item.contribution, 0)

  return fileAuthors.map(({ author, contribution }, index) => {
    // For EQUAL_SIZE, all authors should have the same normalized size
    const normalizedSize =
      sizeMetricType === "EQUAL_SIZE"
        ? 1 / fileAuthors.length // Equal distribution
        : totalContribution > 0
          ? contribution / totalContribution
          : 0

    const minSize = 0.3
    const maxSize = 2.0
    const scaledSize =
      sizeMetricType === "EQUAL_SIZE"
        ? 1.0 // Fixed size for equal
        : minSize + (maxSize - minSize) * Math.sqrt(normalizedSize)

    return {
      type: "blob",
      name: author,
      path: `${filePath}/@${author}`,
      hash: hashString(`file-author-${author}-${index}-${filePath}`),
      contributionCount: contribution,
      sizeInBytes: scaledSize * 1000,
      size: scaledSize * 1000
    }
  })
}

// Helper function to create aggregated author nodes for a group
function createAggregatedAuthorNodesForGroup(
  databaseInfo: DatabaseInfo,
  group: { id: string; name: string; pattern: string; filePaths: string[] },
  sizeMetricType: SizeMetricType
): GitBlobObject[] {
  const authorContributions = new Map<string, number>()

  // Aggregate contributions across all files in the group
  group.filePaths.forEach((filePath) => {
    Object.entries(databaseInfo.authorsFilesStats).forEach(([author, fileStats]) => {
      if (fileStats[filePath]) {
        let contribution = 0
        switch (sizeMetricType) {
          case "MOST_COMMITS":
            contribution = fileStats[filePath].nb_commits || 0
            break
          case "MOST_CONTRIBS":
            contribution = fileStats[filePath].nb_line_change || 0
            break
          case "EQUAL_SIZE":
            contribution = 1 // Each file counts as 1 for this author
            break
          default:
            contribution = fileStats[filePath].nb_line_change || 0
            break
        }

        if (contribution > 0) {
          const currentTotal = authorContributions.get(author) || 0
          authorContributions.set(author, currentTotal + contribution)
        }
      }
    })
  })

  // Convert to array and sort by contribution
  const authorArray = Array.from(authorContributions.entries())
    .map(([author, contribution]) => ({ author, contribution }))
    .sort((a, b) => b.contribution - a.contribution)

  // Calculate total for scaling
  const totalContribution = authorArray.reduce((sum, item) => sum + item.contribution, 0)

  // Find min and max contributions for better scaling
  const maxContribution = Math.max(...authorArray.map((item) => item.contribution))
  const minContribution = Math.min(...authorArray.map((item) => item.contribution))

  console.log(
    `Group ${group.name}: Total contrib: ${totalContribution}, Max: ${maxContribution}, Min: ${minContribution}`
  ) // Debug

  return authorArray.map(({ author, contribution }, index) => {
    let scaledSize: number

    if (sizeMetricType === "EQUAL_SIZE") {
      // All authors get equal size
      scaledSize = 1000
    } else {
      // Scale based on contribution relative to max in this group
      const contributionRatio = maxContribution > 0 ? contribution / maxContribution : 0

      // Use a more aggressive scaling to make differences more visible
      const minSize = 200 // Minimum bubble size
      const maxSize = 3000 // Maximum bubble size

      // Apply square root scaling to make differences more visible
      scaledSize = minSize + (maxSize - minSize) * Math.sqrt(contributionRatio)
    }

    console.log(`Author ${author}: contribution=${contribution}, scaledSize=${scaledSize}`) // Debug

    return {
      type: "blob",
      name: author,
      path: `/group-${group.id}/@${author}`,
      hash: hashString(`aggregated-author-${author}-${index}-${group.id}`),
      contributionCount: contribution,
      sizeInBytes: scaledSize,
      size: scaledSize
    } as GitBlobObject
  })
}
