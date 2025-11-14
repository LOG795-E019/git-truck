import { useRef, useEffect, useDeferredValue, useState } from "react"
import * as d3 from "d3"
import { useData } from "~/contexts/DataContext"
import { useComponentSize } from "~/hooks"
import type { GitTreeObject } from "~/analyzer/model"
import { useFetcher } from "@remix-run/react"
import type { SizeMetricType } from "~/metrics/sizeMetric"

type HeatmapFetcherData = {
  authors: string[]
  matrix: number[][]
}

interface HeatmapProps {
  filetree: GitTreeObject
  sizeMetric: SizeMetricType
}

const Heatmap = ({ filetree, sizeMetric }: HeatmapProps) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const { databaseInfo, repo } = useData()
  const [ref, rawSize] = useComponentSize()
  const size = useDeferredValue(rawSize)
  const fetcher = useFetcher<HeatmapFetcherData>()
  const [visible, setVisible] = useState(false)

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

  const [authors, setAuthors] = useState<string[]>([])
  const [matrix, setMatrix] = useState<number[][]>([])

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
    if (fetcher.data) {
      setAuthors(fetcher.data.authors)
      setMatrix(fetcher.data.matrix)
    }
  }, [fetcher.data])

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

    const margin = { top: 120, right: 20, bottom: 20, left: 120 }
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

    const g = svg
      .append("g")
      .attr("transform", `translate(${xOffset},${yOffset})`)

    const maxValue = d3.max(matrix.flatMap(row => row)) || 1

    const colorScale = d3
      .scaleSequential()
      .domain([0, Math.sqrt(maxValue)])
      .interpolator(d3.interpolateReds)

    matrix.forEach((row, i) => {
      row.forEach((value, j) => {
        g.append("rect")
          .attr("x", j * cellSize)
          .attr("y", i * cellSize)
          .attr("width", cellSize)
          .attr("height", cellSize)
          .attr("fill", value === 0 ? "#f5f5f5" : colorScale(Math.sqrt(value)))
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .style("cursor", "pointer")
          .on("mouseover", function () {
            d3.select(this).attr("stroke", "#000").attr("stroke-width", 2)
          })
          .on("mouseout", function () {
            d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1)
          })
          .append("title")
          .text(`${authors[i]} ↔ ${authors[j]}: ${value}`)
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
      .text(d => d)

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
      .text(d => d)

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
    <div ref={ref} className="heatmap-container relative h-full w-full overflow-auto">
      <svg
        ref={svgRef}
        width={size.width || 800}
        height={size.height || 600}
        className="min-h-full min-w-full"
      />
    </div>
  )
}

export default Heatmap
