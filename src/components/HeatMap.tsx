import { useRef, useEffect, useDeferredValue, useState } from "react"
import * as d3 from "d3"
import { useData } from "~/contexts/DataContext"
import { useComponentSize } from "~/hooks"
import type { GitTreeObject } from "~/analyzer/model"
import { useFetcher } from "@remix-run/react"
import type { SizeMetricType } from "~/metrics/sizeMetric"
import { setHeatmapSelection } from "./HeatmapPanel"
import { useOptions } from "../contexts/OptionsContext"

interface HeatmapProps {
  filetree: GitTreeObject
  sizeMetric: SizeMetricType
}

const Heatmap = ({ filetree, sizeMetric }: HeatmapProps) => {
  const [heatmapData, setHeatmapData] = useState<{
    authors: string[]
    matrix: number[][]
    collaborationsMap?: Record<string, any>
  }>({
    authors: [],
    matrix: []
  })

  const svgRef = useRef<SVGSVGElement>(null)
  const { databaseInfo, repo } = useData()
  const [ref, rawSize] = useComponentSize()
  const size = useDeferredValue(rawSize)
  const fetcher = useFetcher<HeatmapFetcherData>()
  const [visible, setVisible] = useState(false)

  // Heatmap options sliders
  const { minFilesChanged, maxContributors } = useOptions()

  useEffect(() => {
    const style = document.createElement("style")
    style.id = "heatmap-no-animation"
    style.textContent = `
      .heatmap-container,
      .heatmap-container * {
        transition: none !important;
        animation: none !important;
      }
    `
    document.head.appendChild(style)

    setVisible(true)

    return () => {
      const el = document.getElementById("heatmap-no-animation")
      if (el) el.remove()
    }
  }, [])

  // Get metric label for display
  const metricLabel =
    sizeMetric === "MOST_COMMITS" ? "Commits" : sizeMetric === "MOST_CONTRIBS" ? "Line changes" : "Shared Files"

  const [authors, setAuthors] = useState<string[]>([])
  const [matrix, setMatrix] = useState<number[][]>([])
  const [collaborationsMap, setCollaborationsMap] = useState<Record<string, typeof fetcher.data.collaborationsMap>>({})

  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)

  const renderLeftPanel = () => (
    <div className="w-64 flex-shrink-0 overflow-y-auto rounded-lg border bg-white px-4 py-3 text-sm shadow-sm">
      <h3 className="mb-2 font-semibold text-gray-800">Co-Activity Details</h3>

      {selectedLabel ? (
        <div className="mt-2 space-y-3">
          {/* Individuals Section */}
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-gray-600">Individuals</p>
            {selectedLabel.split(" - ").map((user, idx) => (
              <p key={idx} className="text-sm text-gray-800">
                {user}
              </p>
            ))}
          </div>

          {/* Metric Section */}
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-gray-600">Metric Value</p>
            <p className="text-sm text-gray-800">
              {collaborationsMap[selectedLabel]?.reduce((sum, f) => {
                switch (sizeMetric) {
                  case "MOST_COMMITS":
                    return sum + f.totalCommits
                  case "MOST_CONTRIBS":
                    return sum + f.totalLineChanges
                  case "FILE_SIZE":
                    return sum + f.sharedFiles
                  default:
                    return sum
                }
              }, 0) ?? 0}{" "}
              {metricLabel}
            </p>
          </div>

          {/* Files Impacted Section */}
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-gray-600">Files Impacted</p>
            <div className="max-h-96 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-500">
              {collaborationsMap[selectedLabel]?.map((file) => (
                <div key={file.file} className="mb-1">
                  <p className="text-gray-700">{file.file}</p>
                  <p className="text-xs text-gray-500">
                    Commits: {file.totalCommits}, Lines: {file.totalLineChanges}
                  </p>
                </div>
              )) ?? <p className="text-gray-400">No data</p>}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Click a cell in the heatmap to view details</p>
      )}
    </div>
  )

  useEffect(() => {
    console.log("Heatmap data")
    const params = new URLSearchParams({
      repo: repo.name,
      branch: databaseInfo.branch,
      startTime: databaseInfo.selectedRange[0].toString(),
      endTime: databaseInfo.selectedRange[1].toString(),
      metric: sizeMetric
    })
    fetcher.load(`/heatmap?${params}`)
  }, [databaseInfo.selectedRange, repo.name, databaseInfo.branch, sizeMetric])

  useEffect(() => {
    if (!fetcher.data) return

    const { authors: allAuthors, collaborationsMap } = fetcher.data

    // setUp author file count
    const authorFilesCount: Record<string, Set<string>> = {}
    allAuthors.forEach((author) => {
      authorFilesCount[author] = new Set()
    })

    // process the total file count per author
    Object.entries(collaborationsMap).forEach(([key, files]) => {
      const [a1, a2] = key.split(" - ")
      files.forEach((f) => {
        authorFilesCount[a1]?.add(f.file)
        authorFilesCount[a2]?.add(f.file)
      })
    })

    // filter authors by minFilesChanged
    const eligibleAuthors = allAuthors.filter((author) => (authorFilesCount[author]?.size ?? 0) >= minFilesChanged)

    // adds up the values depending on the current metric
    const authorActivity: Record<string, number> = {}
    eligibleAuthors.forEach((author) => (authorActivity[author] = 0))

    Object.entries(collaborationsMap).forEach(([key, files]) => {
      const [a1, a2] = key.split(" - ")
      if (!eligibleAuthors.includes(a1) || !eligibleAuthors.includes(a2)) return

      const value = files.reduce((sum, f) => {
        switch (sizeMetric) {
          case "MOST_COMMITS":
            return sum + f.totalCommits
          case "MOST_CONTRIBS":
            return sum + f.totalLineChanges
          case "FILE_SIZE":
            return sum + f.sharedFiles
          default:
            return sum
        }
      }, 0)

      authorActivity[a1] += value
      authorActivity[a2] += value
    })

    // limit number of authors by maxContributors
    const activeAuthors = Object.entries(authorActivity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxContributors)
      .map(([author]) => author)

    setAuthors(activeAuthors)

    // Heatmap matrix (active authors only)
    const newMatrix = activeAuthors.map((a1) =>
      activeAuthors.map((a2) => {
        if (a1 === a2) return 0

        const key1 = `${a1} - ${a2}`
        const key2 = `${a2} - ${a1}`
        const files = collaborationsMap[key1] ?? collaborationsMap[key2] ?? []

        return files.reduce((sum, f) => {
          switch (sizeMetric) {
            case "MOST_COMMITS":
              return sum + f.totalCommits
            case "MOST_CONTRIBS":
              return sum + f.totalLineChanges
            case "FILE_SIZE":
              return sum + f.sharedFiles
            default:
              return sum
          }
        }, 0)
      })
    )

    // only show collaborators if both are active
    const filteredPairs: Record<string, (typeof collaborationsMap)[string]> = {}
    Object.entries(collaborationsMap).forEach(([key, files]) => {
      const [a1, a2] = key.split(" - ")
      if (activeAuthors.includes(a1) && activeAuthors.includes(a2)) {
        filteredPairs[key] = files
      }
    })

    setMatrix(newMatrix)
    setCollaborationsMap(filteredPairs)
  }, [fetcher.data, sizeMetric, minFilesChanged, maxContributors])

  // Update global heatmap selection state
  useEffect(() => {
    setHeatmapSelection({
      selectedLabel,
      collaborationsMap,
      sizeMetric,
      metricLabel
    })
  }, [selectedLabel, collaborationsMap, sizeMetric, metricLabel])

  useEffect(() => {
    if (!svgRef.current || !visible || authors.length === 0 || matrix.length === 0) {
      return
    }

    console.log("Heatmap: Starting D3 render...")
    const svgElement = svgRef.current
    const svg = d3.select(svgElement)
    svg.selectAll("*").remove()

    const parentElement = svgElement.parentElement
    const parentRect = parentElement?.getBoundingClientRect()
    const svgWidth = parentRect?.width || 800
    const svgHeight = parentRect?.height || 600

    const margin = { top: 160, right: 60, bottom: 60, left: 160 }
    const width = svgWidth - margin.left - margin.right
    const height = svgHeight - margin.top - margin.bottom

    const cellSize = Math.min(width / authors.length, height / authors.length)
    const matrixWidth = cellSize * authors.length
    const matrixHeight = cellSize * authors.length

    const xOffset = margin.left + (width - matrixWidth) / 2
    const yOffset = margin.top + (height - matrixHeight) / 2

    svg
      .attr("width", svgWidth)
      .attr("height", svgHeight)
      .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")

    const bounding = svgElement.getBoundingClientRect()
    svg
      .append("text")
      .attr("x", bounding.width / 2 + 40)
      .attr("y", margin.top / 6)
      .attr("text-anchor", "middle")
      .style("dominant-baseline", "middle")
      .attr("font-size", "15px")
      .attr("font-weight", "600")
      .text(`${metricLabel} - File Co-Activity`)

    const g = svg.append("g").attr("transform", `translate(${xOffset},${yOffset})`)

    // LEGEND

    const allValues = matrix.flatMap((row) => row).filter((v) => v > 0)
    const sortedValues = allValues.sort(d3.ascending)

    const actualMaxValue = d3.max(matrix.flatMap((row) => row)) || 1
    const minValue = d3.min(allValues) || 0
    const maxValue = actualMaxValue

    const verticalLegendWidth = 15 // Largeur de la barre
    const verticalLegendHeight = 200 // Hauteur de la barre
    const legendPadding = 20

    const legendX = xOffset + matrixWidth + legendPadding
    const legendY = yOffset + (matrixHeight - verticalLegendHeight) / 2 // 3. DÉGRADÉ SVG

    const defs = svg.append("defs")
    const gradient = defs
      .append("linearGradient")
      .attr("id", "activity-gradient-vertical")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%")

    const legend = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`) // 4. DESSIN DE LA BARRE

    legend
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", verticalLegendWidth)
      .attr("height", verticalLegendHeight)
      .style("fill", "url(#activity-gradient-vertical)")
      .attr("stroke", "#999")
      .attr("stroke-width", 1)

    legend
      .append("text")
      .attr("x", verticalLegendWidth / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#666")
      .text("High") // Low (en bas)

    legend
      .append("text")
      .attr("x", verticalLegendWidth / 2)
      .attr("y", verticalLegendHeight + 5)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "hanging")
      .style("font-size", "11px")
      .style("fill", "#666")
      .text("Low")

    const markerOffset = verticalLegendWidth + 5

    // const scaleLegend = d3.scaleLinear().domain([minValue, maxValue]).range([verticalLegendHeight, 0])
    // const addMarker = (value: number, label: string) => {
    //   const yPos = scaleLegend(value)

    const sqrtScaleLegend = d3
      .scaleLinear()
      .domain([0, Math.sqrt(maxValue)])
      .range([verticalLegendHeight, 0])

    const addMarker = (value: number, label: string) => {
      const yPos = sqrtScaleLegend(Math.sqrt(value))

      legend
        .append("line")
        .attr("x1", verticalLegendWidth)
        .attr("y1", yPos)
        .attr("x2", verticalLegendWidth + 3)
        .attr("y2", yPos)
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5)

      legend
        .append("text")
        .attr("x", markerOffset)
        .attr("y", yPos)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-size", "9px")
        .style("fill", "#666")
        .text(`${label}: ${Math.round(value)}`)
    }

    addMarker(maxValue, "Max")
    addMarker(minValue, "Min")

    // const colorScale = d3
    //   .scaleSequential()
    //   .domain([0, Math.sqrt(maxValue)])
    //   .interpolator(d3.interpolateReds)

    // normalization for larger gaps between data
    const colorScale = d3.scaleSequentialLog().domain([1, maxValue]).interpolator(d3.interpolateReds)

    const legendSteps = 20
    // for (let i = 0; i <= legendSteps; i++) {
    //   const t = i / legendSteps // 0 → 1
    //   gradient
    //     .append("stop")
    //     .attr("offset", `${t * 100}%`)
    //     .attr("stop-color", colorScale(Math.sqrt(maxValue) * t))
    // }
    for (let i = 0; i <= legendSteps; i++) {
      const value = 1 * Math.pow(maxValue / 1, i / legendSteps) // logarithmic spacing
      gradient
        .append("stop")
        .attr("offset", `${(i / legendSteps) * 100}%`)
        .attr("stop-color", colorScale(value))
    }

    matrix.forEach((row, i) => {
      row.forEach((value, j) => {
        const isDiagonal = i === j

        g.append("rect")
          .attr("x", j * cellSize)
          .attr("y", i * cellSize)
          .attr("width", cellSize)
          .attr("height", cellSize)
          //.attr("fill", isDiagonal ? "#ccc" : value === 0 ? "#f5f5f5" : colorScale(Math.sqrt(value)) // using this with scaleSequential
          .attr("fill", isDiagonal ? "#ccc" : value === 0 ? "#f5f5f5" : colorScale(value)) // using this with scaleSequentialLog
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .style("cursor", "pointer")
          .on("mouseover", function () {
            if (!isDiagonal) d3.select(this).attr("stroke", "#666").attr("stroke-width", 2)
          })
          .on("mouseout", function () {
            if (!isDiagonal) d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1)
          })
          .on("click", () => {
            if (!isDiagonal) {
              const [a, b] = i < j ? [authors[i], authors[j]] : [authors[j], authors[i]]
              setSelectedLabel(`${a} - ${b}`)
            }
          })
          .append("title")
          .text(isDiagonal ? `${authors[i]} ↔ ${authors[j]}: N/A` : `${authors[i]} ↔ ${authors[j]}: ${value}`)
      })
    })

    g.selectAll(".author-label-y")
      .data(authors)
      .enter()
      .append("text")
      .attr("class", "author-label-y")
      .attr("x", -5)
      .attr("y", (d, i) => i * cellSize + cellSize / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .style("font-size", "12px")
      .style("fill", "#333")
      .text((d) => d)

    g.selectAll(".author-label-x")
      .data(authors)
      .enter()
      .append("text")
      .attr("class", "author-label-x")
      .attr("x", (d, i) => i * cellSize + cellSize / 2)
      .attr("y", -10)
      .attr("text-anchor", "start")
      .attr("transform", (d, i) => `rotate(-45, ${i * cellSize + cellSize / 2}, -10)`)
      .style("font-size", "12px")
      .style("fill", "#333")
      .text((d) => d)
  }, [authors, matrix, size, visible])

  if (fetcher.state === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Loading heatmap data...</p>
      </div>
    )
  }

  if (authors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">No collaboration data available for heatmap view</p>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden p-4">
      <div className="flex-1">
        <svg ref={svgRef} className="h-full w-full" style={{ maxHeight: "100vh", display: "block" }}></svg>
      </div>
    </div>
  )
}

export default Heatmap
