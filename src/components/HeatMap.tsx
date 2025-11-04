import { useRef, useEffect, useDeferredValue, useState } from "react"
import * as d3 from "d3"
import { useData } from "~/contexts/DataContext"
import { useComponentSize } from "~/hooks"
import type { GitTreeObject } from "~/analyzer/model"
import { useFetcher } from "@remix-run/react"
import type { SizeMetricType } from "~/metrics/sizeMetric"

type HeatMapFetcherData = {
  data: HeatMapDataPoint[]
  weeks: string[]
}

type HeatMapDataPoint = {
  author: string
  date: string
  timestamp: number
  commits: number
  lineChanges: number
  fileChanges: number
}

type HeatMapData = HeatMapDataPoint[]

interface HeatMapProps {
  filetree: GitTreeObject
  sizeMetric: SizeMetricType
}

const HeatMap = ({ filetree, sizeMetric }: HeatMapProps) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const { databaseInfo, repo } = useData()
  const [ref, rawSize] = useComponentSize()
  const size = useDeferredValue(rawSize)
  const fetcher = useFetcher<HeatMapFetcherData>()
  const [visible, setVisible] = useState(false)
  // Immediately disable animations on mount
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

  const [heatMapData, setHeatMapData] = useState<HeatMapData>([])
  const [allWeeks, setAllWeeks] = useState<string[]>([])

  const [selectedAuthor, setSelectedAuthor] = useState("ALL")
  const [hideEmpty, setHideEmpty] = useState(false)

  const authors = Array.from(new Set(heatMapData.map((d) => d.author))).sort()
  console.log("AUTHORS:", authors)

  const getMetricValue = (d: HeatMapDataPoint): number => {
    switch (sizeMetric) {
      case "MOST_COMMITS":
        return d.commits
      case "MOST_CONTRIBS":
        return d.lineChanges
      case "FILE_SIZE":
        return d.fileChanges
      default:
        return d.commits
    }
  }

  useEffect(() => {
    const params = new URLSearchParams({
      repo: repo.name,
      branch: databaseInfo.branch,
      startTime: databaseInfo.selectedRange[0].toString(),
      endTime: databaseInfo.selectedRange[1].toString()
    })
    fetcher.load(`/heatmap?${params}`)
  }, [databaseInfo.selectedRange, repo.name, databaseInfo.branch])

  // set heatmap data (including empty weeks)
  useEffect(() => {
    if (fetcher.data) {
      setHeatMapData(fetcher.data.data)
      setAllWeeks(fetcher.data.weeks)
    }
  }, [fetcher.data])

  const filteredHeatMapData = allWeeks
    .map((week) => {
      const entries = heatMapData.filter((d) =>
        selectedAuthor === "ALL" ? d.date === week : d.date === week && d.author === selectedAuthor
      )

      if (entries.length === 0) {
        if (hideEmpty) return null
        return {
          author: selectedAuthor === "ALL" ? "" : selectedAuthor,
          date: week,
          timestamp: 0,
          commits: 0,
          lineChanges: 0,
          fileChanges: 0
        }
      }

      if (selectedAuthor === "ALL") {
        // sum metrics across all authors for this week
        return {
          author: "",
          date: week,
          timestamp: Math.min(...entries.map((d) => d.timestamp)),
          commits: d3.sum(entries, (d) => d.commits),
          lineChanges: d3.sum(entries, (d) => d.lineChanges),
          fileChanges: d3.sum(entries, (d) => d.fileChanges)
        }
      } else {
        // only one author, take the first entry (or zero if none)
        return entries[0]
      }
    })
    .filter(Boolean) as HeatMapData

  interface ContributorRank {
    author: string
    total: number
    weeks: ContributorWeekData[]
  }

  // top contributor and weeks
  interface ContributorWeekData {
    week: string
    value: number
  }

  let contributorRanks: ContributorRank[] = []

  if (selectedAuthor === "ALL") {
    // Group data by author
    const authorGroups = d3.group(heatMapData, (d) => d.author)

    contributorRanks = Array.from(authorGroups, ([author, entries]) => {
      // Total metric per author
      const total = d3.sum(entries, getMetricValue)

      // Top weeks for this author
      const weeks = entries.map((d) => ({ week: d.date, value: getMetricValue(d) })).sort((a, b) => b.value - a.value)

      return { author, total, weeks }
    })

    // Sort contributors by total descending
    contributorRanks.sort((a, b) => b.total - a.total)
  }

  useEffect(() => {
    if (!svgRef.current || filteredHeatMapData.length === 0 || size.width === 0 || size.height === 0) return

    const svgElement = svgRef.current

    d3.transition.prototype.duration = function () {
      return this
    }

    let element: Element | null = svgElement
    while (element) {
      if (element instanceof HTMLElement || element instanceof SVGElement) {
        element.style.transition = "none"
        element.style.animation = "none"
      }
      element = element.parentElement
    }

    const svg = d3.select(svgRef.current)

    svg.selectAll("*").remove()

    const parentElement = svgElement.parentElement
    const parentRect = parentElement?.getBoundingClientRect()

    const width = parentRect?.width || 800
    const height = parentRect?.height || 600

    console.log("Parent dimensions:", width, height, "ParentRect:", parentRect)

    const gridSize = Math.ceil(Math.sqrt(filteredHeatMapData.length))

    const cellSize = 35
    const cellPadding = 4

    // Calculate grid dimensions
    const gridWidth = gridSize * (cellSize + cellPadding) - cellPadding
    const gridHeight = gridSize * (cellSize + cellPadding) - cellPadding

    console.log("Grid size:", gridSize, "Grid dimensions:", gridWidth, gridHeight)

    const topPadding = 120
    const xOffset = (width - gridWidth) / 2
    const yOffset = topPadding

    console.log("Offsets:", xOffset, yOffset)

    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")

    // Get metric label for display
    const metricLabel =
      sizeMetric === "MOST_COMMITS" ? "Commits" : sizeMetric === "MOST_CONTRIBS" ? "Line changes" : "File changes"

    // Get all non-zero values for percentile calculation
    const nonZeroValues = filteredHeatMapData
      .map(getMetricValue)
      .filter((v) => v > 0)
      .sort((a, b) => a - b)

    // Calculate percentiles for better color distribution
    const minValue = nonZeroValues.length > 0 ? d3.min(nonZeroValues) || 0 : 0
    const p25 = nonZeroValues.length > 0 ? d3.quantile(nonZeroValues, 0.25) || 0 : 0
    const p50 = nonZeroValues.length > 0 ? d3.quantile(nonZeroValues, 0.5) || 0 : 0
    const p75 = nonZeroValues.length > 0 ? d3.quantile(nonZeroValues, 0.75) || 0 : 0
    const p90 = nonZeroValues.length > 0 ? d3.quantile(nonZeroValues, 0.9) || 0 : 0
    const maxValue = nonZeroValues.length > 0 ? d3.max(nonZeroValues) || 1 : 1

    const colorScale = d3
      .scaleThreshold<number, string>()
      .domain([p25, p50, p75, p90])
      .range(["#fff7bc", "#fec44f", "#fe9929", "#d73027", "#a50026"])

    console.log("Applying transform:", `translate(${xOffset},${yOffset})`)
    const g = svg
      .append("g")
      .attr("class", "heatmap-grid")
      .attr("transform", `translate(${xOffset},${yOffset})`)
      .style("opacity", 1)
      .style("transition", "none !important")
      .style("animation", "none !important")

    console.log("Group transform:", g.attr("transform"))

    // X-axis
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", yOffset + gridHeight + 40)
      .attr("text-anchor", "middle")
      .style("font-size", "13px")
      .style("font-weight", "500")
      .style("fill", "#333")
      .style("transition", "none")
      .style("animation", "none")
      .style("opacity", 1)
      .text("")

    // Y-axis label
    const gridCenterY = yOffset + gridHeight / 2
    svg
      .append("text")
      .attr("x", -gridCenterY)
      .attr("y", xOffset - 40)
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90, ${xOffset - 40}, ${gridCenterY})`)
      .style("font-size", "13px")
      .style("font-weight", "500")
      .style("fill", "#333")
      .style("transition", "none")
      .style("animation", "none")
      .style("opacity", 1)
      .text("")

    g.selectAll("rect")
      .data(filteredHeatMapData)
      .enter()
      .append("rect")
      .attr("x", (_d, i) => (i % gridSize) * (cellSize + cellPadding))
      .attr("y", (_d, i) => Math.floor(i / gridSize) * (cellSize + cellPadding))
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("fill", (d) => {
        const value = getMetricValue(d)
        return value === 0 ? "#ffffff" : colorScale(value)
      })
      .attr("stroke-width", 1)
      .attr("rx", 2)
      .attr("shape-rendering", "crispEdges")
      .attr("opacity", 1)
      .style("cursor", "pointer")
      .style("transition", "none")
      .style("animation", "none")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke", "#000").attr("stroke-width", 2)

        d3.select("body")
          .append("div")
          .attr("class", "heatmap-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.9)")
          .style("color", "white")
          .style("padding", "8px 12px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "10000")
          .html(`<strong>${d.date}</strong><br/>${getMetricValue(d)} ${metricLabel}`)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 10 + "px")
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1)
        d3.selectAll(".heatmap-tooltip").remove()
      })

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .style("transition", "none")
      .style("animation", "none")
      .style("opacity", 1)
      .text(`${metricLabel} Activity Heat Map`)

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 50)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#666")
      .style("transition", "none")
      .style("animation", "none")
      .style("opacity", 1)
      .text(`${filteredHeatMapData.length} weeks of activity`)

    // Add gradient legend bar at bottom
    const legendWidth = 300
    const legendHeight = 15
    const legendX = width / 2 - legendWidth / 2
    const legendY = height - 40

    // Create gradient definition
    const defs = svg.append("defs")
    const gradient = defs
      .append("linearGradient")
      .attr("id", "heatmap-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%")

    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#fff7bc")
    gradient.append("stop").attr("offset", "25%").attr("stop-color", "#fec44f")
    gradient.append("stop").attr("offset", "50%").attr("stop-color", "#fe9929")
    gradient.append("stop").attr("offset", "75%").attr("stop-color", "#d73027")
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#a50026")

    // Draw legend bar
    svg
      .append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#heatmap-gradient)")
      .attr("stroke", "#999")
      .attr("stroke-width", 1)

    // Add legend labels with percentile markers
    svg
      .append("text")
      .attr("x", legendX - 5)
      .attr("y", legendY + legendHeight / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .style("font-size", "11px")
      .style("fill", "#666")
      .text("Low")

    svg
      .append("text")
      .attr("x", legendX + legendWidth + 5)
      .attr("y", legendY + legendHeight / 2)
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "middle")
      .style("font-size", "11px")
      .style("fill", "#666")
      .text("High")

    // Add percentile markers below the legend
    svg
      .append("text")
      .attr("x", legendX)
      .attr("y", legendY + legendHeight + 15)
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "middle")
      .style("font-size", "9px")
      .style("fill", "#999")
      .text(`Min: ${Math.round(minValue)}`)

    svg
      .append("text")
      .attr("x", legendX + legendWidth / 5)
      .attr("y", legendY + legendHeight + 15)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "9px")
      .style("fill", "#999")
      .text(`25th: ${Math.round(p25)}`)

    svg
      .append("text")
      .attr("x", legendX + (2 * legendWidth) / 5)
      .attr("y", legendY + legendHeight + 15)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "9px")
      .style("fill", "#999")
      .text(`50th: ${Math.round(p50)}`)

    svg
      .append("text")
      .attr("x", legendX + (3 * legendWidth) / 5)
      .attr("y", legendY + legendHeight + 15)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "9px")
      .style("fill", "#999")
      .text(`75th: ${Math.round(p75)}`)

    svg
      .append("text")
      .attr("x", legendX + (4 * legendWidth) / 5)
      .attr("y", legendY + legendHeight + 15)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "9px")
      .style("fill", "#999")
      .text(`90th: ${Math.round(p90)}`)

    svg
      .append("text")
      .attr("x", legendX + legendWidth)
      .attr("y", legendY + legendHeight + 15)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .style("font-size", "9px")
      .style("fill", "#999")
      .text(`Max: ${Math.round(maxValue)}`)

    // Update SVG size to fill container
    svg
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("transition", "none")
      .style("animation", "none")
  }, [filteredHeatMapData, size, sizeMetric])

  if (fetcher.state === "loading") {
    return (
      <div ref={ref} className="flex h-full items-center justify-center">
        <p>Loading heat map data...</p>
      </div>
    )
  }

  if (filteredHeatMapData.length === 0) {
    return (
      <div ref={ref} className="flex h-full items-center justify-center">
        <p>No data available for heat map</p>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="heatmap-container flex h-full w-full gap-4 overflow-hidden p-4"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="flex w-40 flex-col space-y-2">
        {/* hide emtpy checkbox */}
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
            className="form-checkbox"
          />
          <span>Hide empty weeks</span>
        </label>

        {/* Select for author */}
        {authors.length > 0 && (
          <label className="flex flex-col space-y-1">
            <span className="text-sm font-medium">Select author</span>
            <select value={selectedAuthor} onChange={(e) => setSelectedAuthor(e.target.value)} className="form-select">
              <option value="ALL">All</option>
              {authors.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* heatmap */}
      <div className="flex-1">
        <svg ref={svgRef} className="h-full w-full" style={{ maxHeight: "100vh", display: "block" }}></svg>
      </div>

      {/* info box */}
      <div className="flex-shrink-0 rounded-lg border bg-gray-50 px-4 py-2 text-sm shadow-sm">
        <p>
          <strong>Total weeks:</strong> {filteredHeatMapData.length}
        </p>
        <p>
          <strong>Total commits:</strong> {d3.sum(filteredHeatMapData, (d) => d.commits)}
        </p>
        <p>
          <strong>Total line changes:</strong> {d3.sum(filteredHeatMapData, (d) => d.lineChanges)}
        </p>
        <p>
          <strong>Total file changes:</strong> {d3.sum(filteredHeatMapData, (d) => d.fileChanges)}
        </p>

        {/* show top contributors and their top weeks */}
        {/* Top contributors & top weeks */}
        {selectedAuthor === "ALL" && contributorRanks.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 font-semibold text-gray-700">Top Contributors</h3>
            <div className="space-y-3">
              {contributorRanks.slice(0, 3).map((c, index) => (
                <div key={c.author} className="rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm">
                  <div className="mb-2">
                    <span className="font-medium text-gray-800">
                      {index + 1}. {c.author}
                    </span>
                    <div className="text-sm text-gray-600">Total: {c.total}</div>
                  </div>
                  <ul className="ml-4 list-inside list-disc space-y-1">
                    {c.weeks.slice(0, 3).map((w, i) => (
                      <li key={i} className="text-gray-700">
                        {w.week}: <span className="font-medium">{w.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HeatMap
