import { useRef, useEffect, useDeferredValue, useState, useCallback } from "react"
import * as d3 from "d3"
import { useData } from "~/contexts/DataContext"
import { useComponentSize } from "~/hooks"
import type { GitTreeObject } from "~/analyzer/model"
import { useFetcher } from "@remix-run/react"
import type { SizeMetricType } from "~/metrics/sizeMetric"

type ActivityFetcherData = {
  data: ActivityDataPoint[]
  days: string[]
}

type ActivityDataPoint = {
  author: string
  date: string
  timestamp: number
  commits: number
  lineChanges: number
  fileChanges: number
}

type ActivityData = ActivityDataPoint[]

interface ActivityProps {
  filetree: GitTreeObject
  sizeMetric: SizeMetricType
}

const Activity = ({ filetree, sizeMetric }: ActivityProps) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const { databaseInfo, repo } = useData()
  const [ref, rawSize] = useComponentSize()
  const size = useDeferredValue(rawSize)
  const fetcher = useFetcher<ActivityFetcherData>()
  const [visible, setVisible] = useState(false)
  // Immediately disable animations on mount
  useEffect(() => {
    const style = document.createElement("style")
    style.id = "activity-no-animation"
    style.textContent = `
      .activity-container,
      .activity-container * {
        transition: none !important;
        animation: none !important;
      }
    `
    document.head.appendChild(style)

    setVisible(true)

    return () => {
      const el = document.getElementById("activity-no-animation")
      if (el) el.remove()
    }
  }, [])

  const [activityData, setActivityData] = useState<ActivityData>([])
  const [allDays, setAllDays] = useState<string[]>([])

  const [selectedAuthor, setSelectedAuthor] = useState("ALL")
  const [hideEmpty, setHideEmpty] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showAllContributors, setShowAllContributors] = useState(false)

  // Get available years from the data
  const availableYears = Array.from(new Set(activityData.map((d) => new Date(d.date).getFullYear()))).sort(
    (a, b) => b - a
  )

  // Default to current year or most recent year in data
  const currentYear = new Date().getFullYear()
  const defaultYear = availableYears.includes(currentYear) ? currentYear : availableYears[0]
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear)

  // Update selected year when data changes
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(defaultYear)
    }
  }, [availableYears, selectedYear, defaultYear])

  const authors = Array.from(new Set(activityData.map((d) => d.author))).sort()
  console.log("AUTHORS:", authors)

  const getMetricValue = useCallback(
    (d: ActivityDataPoint): number => {
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
    },
    [sizeMetric]
  )

  // Get metric label for display
  const metricLabel =
    sizeMetric === "MOST_COMMITS" ? "Commits" : sizeMetric === "MOST_CONTRIBS" ? "Line changes" : "File changes"

  useEffect(() => {
    const params = new URLSearchParams({
      repo: repo.name,
      branch: databaseInfo.branch,
      startTime: databaseInfo.selectedRange[0].toString(),
      endTime: databaseInfo.selectedRange[1].toString()
    })
    fetcher.load(`/activity?${params}`)
    // Clear selected day when timeline changes
    setSelectedDay(null)
  }, [databaseInfo.selectedRange, repo.name, databaseInfo.branch])

  // set activity data
  useEffect(() => {
    if (fetcher.data) {
      setActivityData(fetcher.data.data)
      setAllDays(fetcher.data.days)
    }
  }, [fetcher.data])

  // Filter data by selected year and author
  const filteredActivityData: ActivityData = activityData
    .filter((d) => {
      const year = new Date(d.date).getFullYear()
      if (year !== selectedYear) return false
      if (selectedAuthor !== "ALL" && d.author !== selectedAuthor) return false
      return true
    })
    .reduce((acc, d) => {
      // Group by date
      const existing = acc.find((item) => item.date === d.date)
      if (existing) {
        // Aggregate metrics for this day
        existing.commits += d.commits
        existing.lineChanges += d.lineChanges
        existing.fileChanges += d.fileChanges
      } else {
        acc.push({ ...d })
      }
      return acc
    }, [] as ActivityData)
    .sort((a, b) => a.date.localeCompare(b.date))

  interface ContributorRank {
    author: string
    total: number
    days: ContributorDayData[]
  }

  // top contributor and days
  interface ContributorDayData {
    day: string
    value: number
  }

  let contributorRanks: ContributorRank[] = []

  if (selectedAuthor === "ALL") {
    // Group data by author
    const authorGroups = d3.group(activityData, (d) => d.author)

    contributorRanks = Array.from(authorGroups, ([author, entries]) => {
      // Total metric per author
      const total = d3.sum(entries, getMetricValue)

      // Top days for this author
      const days = entries.map((d) => ({ day: d.date, value: getMetricValue(d) })).sort((a, b) => b.value - a.value)

      return { author, total, days }
    })

    // Sort contributors by total descending
    contributorRanks.sort((a, b) => b.total - a.total)
  }

  useEffect(() => {
    if (!svgRef.current || filteredActivityData.length === 0 || size.width === 0 || size.height === 0) return

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

    const cellSize = 12
    const cellPadding = 3
    const topPadding = 120
    const leftPadding = 50

    const dataByDate = new Map<string, ActivityDataPoint>()
    filteredActivityData.forEach((d) => dataByDate.set(d.date, d))

    const firstDate = new Date(selectedYear, 0, 1)
    const lastDate = new Date(selectedYear, 11, 31)

    const firstSunday = new Date(firstDate)
    firstSunday.setDate(firstDate.getDate() - firstDate.getDay())

    const lastSaturday = new Date(lastDate)
    lastSaturday.setDate(lastDate.getDate() + (6 - lastDate.getDay()))

    const numWeeks = Math.ceil((lastSaturday.getTime() - firstSunday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    const numCols = numWeeks
    const numRows = 7

    const gridWidth = numCols * (cellSize + cellPadding)
    const gridHeight = numRows * (cellSize + cellPadding)

    const xOffset = leftPadding
    const yOffset = topPadding

    console.log(`Year ${selectedYear} grid:`, numCols, "cols x", numRows, "rows")

    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")

    // Get all non-zero values for percentile calculation
    const nonZeroValues = filteredActivityData
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
      .attr("class", "activity-grid")
      .attr("transform", `translate(${xOffset},${yOffset})`)
      .style("opacity", 1)
      .style("transition", "none !important")
      .style("animation", "none !important")

    console.log("Group transform:", g.attr("transform"))

    // Add month labels above the grid
    let lastMonth = -1
    for (let week = 0; week < numWeeks; week++) {
      const weekDate = new Date(firstSunday)
      weekDate.setDate(firstSunday.getDate() + week * 7)
      const currentMonth = weekDate.getMonth()
      const currentYear = weekDate.getFullYear()

      // Only show month labels for the selected year
      if (currentYear === selectedYear && currentMonth !== lastMonth) {
        svg
          .append("text")
          .attr("x", xOffset + week * (cellSize + cellPadding))
          .attr("y", yOffset - 8)
          .attr("text-anchor", "start")
          .style("font-size", "10px")
          .style("fill", "#666")
          .text(weekDate.toLocaleDateString("en-US", { month: "short" }))
        lastMonth = currentMonth
      } else if (currentYear !== selectedYear) {
        lastMonth = -1
      }
    }

    // Add day labels
    const dayLabels = ["Mon", "", "Wed", "", "Fri", "", ""]
    dayLabels.forEach((label, i) => {
      if (label) {
        svg
          .append("text")
          .attr("x", xOffset - 5)
          .attr("y", yOffset + i * (cellSize + cellPadding) + cellSize / 2)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .style("font-size", "9px")
          .style("fill", "#666")
          .text(label)
      }
    })

    // Create calendar grid data
    const calendarData: Array<{ date: Date; weekIndex: number; dayIndex: number; data?: ActivityDataPoint }> = []
    for (let week = 0; week < numWeeks; week++) {
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(firstSunday)
        currentDate.setDate(firstSunday.getDate() + week * 7 + day)
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`
        const data = dataByDate.get(dateStr)
        calendarData.push({
          date: currentDate,
          weekIndex: week,
          dayIndex: day,
          data: data
        })
      }
    }

    // Draw cells
    g.selectAll("rect")
      .data(calendarData)
      .enter()
      .append("rect")
      .attr("x", (d) => d.weekIndex * (cellSize + cellPadding))
      .attr("y", (d) => d.dayIndex * (cellSize + cellPadding))
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("fill", (d) => {
        if (!d.data) return "#ebedf0"
        const value = getMetricValue(d.data)
        return value === 0 ? "#ebedf0" : colorScale(value)
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("rx", 2)
      .attr("shape-rendering", "crispEdges")
      .style("cursor", "pointer")
      .on("click", function (_event, d) {
        // Set selected day
        const dateStr = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(d.date.getDate()).padStart(2, "0")}`
        setSelectedDay(dateStr)

        // Update visual selection
        g.selectAll("rect")
          .data(calendarData)
          .attr("stroke", (cell) => {
            const cellDateStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, "0")}-${String(cell.date.getDate()).padStart(2, "0")}`
            return cellDateStr === dateStr ? "#000" : "#fff"
          })
          .attr("stroke-width", (cell) => {
            const cellDateStr = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, "0")}-${String(cell.date.getDate()).padStart(2, "0")}`
            return cellDateStr === dateStr ? 3 : 1
          })
      })
      .on("mouseover", function (event, d) {
        const currentStroke = d3.select(this).attr("stroke")
        if (currentStroke !== "#000") {
          d3.select(this).attr("stroke", "#666").attr("stroke-width", 2)
        }

        d3.select("body")
          .append("div")
          .attr("class", "activity-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.9)")
          .style("color", "white")
          .style("padding", "8px 12px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "10000")
          .html(() => {
            const dateStr = d.date.toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric"
            })
            const value = d.data ? getMetricValue(d.data) : 0
            return `<strong>${dateStr}</strong><br/>${value} ${metricLabel}`
          })
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 10 + "px")
      })
      .on("mouseout", function (_event, d) {
        const dateStr = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(d.date.getDate()).padStart(2, "0")}`
        const isSelected = dateStr === selectedDay
        if (!isSelected) {
          d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1)
        }
        d3.selectAll(".activity-tooltip").remove()
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
      .text(`${metricLabel} Activity`)

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
      .text(`${filteredActivityData.length} days of activity`)

    // Add gradient legend bar at bottom
    const legendWidth = 300
    const legendHeight = 15
    const legendX = width / 2 - legendWidth / 2
    const legendY = height - 40

    // Create gradient definition
    const defs = svg.append("defs")
    const gradient = defs
      .append("linearGradient")
      .attr("id", "activity-gradient")
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
      .style("fill", "url(#activity-gradient)")
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
  }, [filteredActivityData, size, sizeMetric, selectedYear, selectedDay, getMetricValue, metricLabel])

  // Render left panel with filters
  const renderLeftPanel = () => (
    <div className="w-64 flex-shrink-0 overflow-y-auto rounded-lg border bg-white px-4 py-3 text-sm shadow-sm">
      {/* Filters Section */}
      <div className="mb-4 space-y-3 border-b pb-4">
        <h3 className="font-semibold text-gray-800">Filters</h3>

        {/* Year selector */}
        {availableYears.length > 1 && (
          <div>
            <label htmlFor="year-select" className="mb-1 block text-xs font-medium text-gray-700">
              Year
            </label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Select for author */}
        {authors.length > 0 && (
          <div>
            <label htmlFor="author-select" className="mb-1 block text-xs font-medium text-gray-700">
              Author
            </label>
            <select
              id="author-select"
              value={selectedAuthor}
              onChange={(e) => setSelectedAuthor(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
            >
              <option value="ALL">All</option>
              {authors.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Day Details Section */}
      {selectedDay ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Day Details</h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {(() => {
            const date = new Date(selectedDay)
            const dayData = activityData.filter((d) => d.date === selectedDay)

            if (dayData.length === 0) {
              return <p className="text-gray-500">No activity on this day</p>
            }

            const totalCommits = d3.sum(dayData, (d) => d.commits)
            const totalLineChanges = d3.sum(dayData, (d) => d.lineChanges)
            const totalFileChanges = d3.sum(dayData, (d) => d.fileChanges)
            const dayAuthors = Array.from(new Set(dayData.map((d) => d.author)))

            return (
              <div className="space-y-3">
                {/* Date */}
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {date.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </p>
                </div>

                {/* Metrics Summary */}
                <div className="rounded bg-gray-50 p-2">
                  <p className="mb-1 text-xs font-semibold uppercase text-gray-600">Summary</p>
                  <div className="space-y-1 text-xs">
                    <p className={sizeMetric === "MOST_COMMITS" ? "font-semibold text-blue-600" : ""}>
                      <span className="text-gray-600">Commits:</span> {totalCommits}
                    </p>
                    <p className={sizeMetric === "MOST_CONTRIBS" ? "font-semibold text-blue-600" : ""}>
                      <span className="text-gray-600">Line changes:</span> {totalLineChanges.toLocaleString()}
                    </p>
                    <p className={sizeMetric === "FILE_SIZE" ? "font-semibold text-blue-600" : ""}>
                      <span className="text-gray-600">Files changed:</span> {totalFileChanges}
                    </p>
                  </div>
                </div>

                {/* Authors */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-600">
                    Contributors ({dayAuthors.length})
                  </p>
                  <div className="space-y-2">
                    {dayData.map((d, idx) => (
                      <div key={idx} className="rounded border border-gray-200 p-2">
                        <p className="mb-1 text-xs font-medium text-gray-700">{d.author}</p>
                        <div className="space-y-0.5 text-xs text-gray-600">
                          <p>Commits: {d.commits}</p>
                          <p>Lines: {d.lineChanges.toLocaleString()}</p>
                          <p>Files: {d.fileChanges}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      ) : (
        <div className="text-center text-gray-500">
          <p className="text-xs">Click on a day to view details</p>
        </div>
      )}
    </div>
  )

  if (fetcher.state === "loading") {
    return (
      <div
        ref={ref}
        className="activity-container flex h-full w-full gap-4 overflow-hidden p-4"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {renderLeftPanel()}
        <div className="flex flex-1 items-center justify-center">
          <p>Loading activity data...</p>
        </div>
      </div>
    )
  }

  if (filteredActivityData.length === 0) {
    return (
      <div
        ref={ref}
        className="activity-container flex h-full w-full gap-4 overflow-hidden p-4"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {renderLeftPanel()}
        <div className="flex flex-1 items-center justify-center">
          <p>No data available for activity view</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="activity-container flex h-full w-full gap-4 overflow-hidden p-4"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {renderLeftPanel()}

      {/* activity */}
      <div className="flex-1">
        <svg ref={svgRef} className="h-full w-full" style={{ maxHeight: "100vh", display: "block" }}></svg>
      </div>

      {/* info box */}
      <div className="w-64 flex-shrink-0 overflow-y-auto rounded-lg border bg-gray-50 px-4 py-2 text-sm shadow-sm">
        <p>
          <strong>Total days:</strong> {filteredActivityData.length}
        </p>
        <p>
          <strong>Total commits:</strong> {d3.sum(filteredActivityData, (d) => d.commits)}
        </p>
        <p>
          <strong>Total line changes:</strong> {d3.sum(filteredActivityData, (d) => d.lineChanges)}
        </p>
        <p>
          <strong>Total file changes:</strong> {d3.sum(filteredActivityData, (d) => d.fileChanges)}
        </p>

        {/* show top contributors and their top weeks */}
        {/* Top contributors & top weeks */}
        {selectedAuthor === "ALL" && contributorRanks.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 font-semibold text-gray-700">Top Contributors - {metricLabel}</h3>
            <div className="space-y-3">
              {contributorRanks.slice(0, showAllContributors ? contributorRanks.length : 5).map((c, index) => (
                <div key={c.author} className="rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm">
                  <div className="mb-2">
                    <span className="font-medium text-gray-800">
                      {index + 1}. {c.author}
                    </span>
                    <div className="text-sm text-gray-600">Total: {c.total.toLocaleString()}</div>
                  </div>
                  <ul className="ml-4 list-inside list-disc space-y-1 text-xs">
                    {c.days.slice(0, 3).map((d, i) => (
                      <li key={i} className="text-gray-700">
                        {d.day}: <span className="font-medium">{d.value.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Show More/Less button */}
            {contributorRanks.length > 5 && (
              <button
                onClick={() => setShowAllContributors(!showAllContributors)}
                className="mt-3 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {showAllContributors ? `Show Less` : `Show All (${contributorRanks.length} contributors)`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Activity
