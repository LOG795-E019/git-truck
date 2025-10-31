import { useRef, useEffect, useDeferredValue, useState } from "react"
import * as d3 from "d3"
import { useData } from "~/contexts/DataContext"
import { useComponentSize } from "~/hooks"
import type { GitTreeObject } from "~/analyzer/model"
import { useFetcher } from "@remix-run/react"
import type { SizeMetricType } from "~/metrics/sizeMetric"

type HeatMapDataPoint = {
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
  const fetcher = useFetcher<HeatMapData>()
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

  useEffect(() => {
    const params = new URLSearchParams({
      repo: repo.name,
      branch: databaseInfo.branch,
      startTime: databaseInfo.selectedRange[0].toString(),
      endTime: databaseInfo.selectedRange[1].toString()
    })
    fetcher.load(`/heatmap?${params}`)
  }, [databaseInfo.selectedRange, repo.name, databaseInfo.branch])

  const heatMapData = fetcher.data || []

  useEffect(() => {
    if (!svgRef.current || heatMapData.length === 0 || size.width === 0 || size.height === 0) return

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

    const gridSize = Math.ceil(Math.sqrt(heatMapData.length))

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

    // Get metric label for display
    const metricLabel =
      sizeMetric === "MOST_COMMITS" ? "commits" :
      sizeMetric === "MOST_CONTRIBS" ? "line changes" :
      "file changes"

    // Get all non-zero values for percentile calculation
    const nonZeroValues = heatMapData.map(getMetricValue).filter(v => v > 0).sort((a, b) => a - b)

    // Calculate percentiles for better color distribution
    const minValue = nonZeroValues.length > 0 ? d3.min(nonZeroValues) || 0 : 0
    const p25 = nonZeroValues.length > 0 ? d3.quantile(nonZeroValues, 0.25) || 0 : 0
    const p50 = nonZeroValues.length > 0 ? d3.quantile(nonZeroValues, 0.50) || 0 : 0
    const p75 = nonZeroValues.length > 0 ? d3.quantile(nonZeroValues, 0.75) || 0 : 0
    const p90 = nonZeroValues.length > 0 ? d3.quantile(nonZeroValues, 0.90) || 0 : 0
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
      .data(heatMapData)
      .enter()
      .append("rect")
      .attr("x", (_d, i) => (i % gridSize) * (cellSize + cellPadding))
      .attr("y", (_d, i) => Math.floor(i / gridSize) * (cellSize + cellPadding))
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("fill", (d) => {
        const value = getMetricValue(d)
        return value === 0 ? "#ebedf0" : colorScale(value)
      })
      .attr("stroke", "#fff")
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
      .text("Commit Activity Heat Map")

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
      .text(`${heatMapData.length} weeks of activity`)

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
  }, [heatMapData, size, sizeMetric])

  if (fetcher.state === "loading") {
    return (
      <div ref={ref} className="flex h-full items-center justify-center">
        <p>Loading heat map data...</p>
      </div>
    )
  }

  if (heatMapData.length === 0) {
    return (
      <div ref={ref} className="flex h-full items-center justify-center">
        <p>No data available for heat map</p>
      </div>
    )
  }

  return (
    <div ref={ref} className="heatmap-container h-full w-full overflow-hidden" style={{ opacity: visible ? 1 : 0 }}>
      <svg ref={svgRef} className="h-full w-full" style={{ maxHeight: "100vh", display: "block" }}></svg>
    </div>
  )
}

export default HeatMap
