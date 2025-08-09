import { useRef, useEffect, useDeferredValue } from "react"
import * as d3 from "d3"
import { useData } from "~/contexts/DataContext"
import { useComponentSize } from "~/hooks"
import { useOptions } from "~/contexts/OptionsContext"
import { sliderPadding } from "~/const"

const BarChart = () => {
  const svgRef = useRef<SVGSVGElement>(null)
  const { databaseInfo } = useData()
  const { sizeMetric } = useOptions() // Get the selected size metric
  const [ref, rawSize] = useComponentSize()
  const size = useDeferredValue(rawSize)
  
  // Determine which data to use based on size metric
  const isCommitMetric = sizeMetric === "MOST_COMMITS"
  const chartData = isCommitMetric 
    ? databaseInfo.commitCountPerDay 
    : databaseInfo.lineChangeCountPerDay || [] // Add fallback to empty array
  
  // Early return if no data is available
  if (!chartData || chartData.length === 0) {
    return <div ref={ref} style={{ height: 30 }} />
  }
  
  // Filter data based on selected range
  const filteredData = chartData.filter(d => {
    return d.timestamp >= databaseInfo.selectedRange[0] && d.timestamp <= databaseInfo.selectedRange[1]
  })

  // Calculate duration in days (timestamps are in seconds)
  const durationInDays = (databaseInfo.selectedRange[1] - databaseInfo.selectedRange[0]) / (60 * 60 * 24)
  const showDailyBars = durationInDays <= 90 // Show daily bars if 2 months or less

  // Fill in missing days with zero counts for daily view
  const completeData = showDailyBars ? fillMissingDays(filteredData, databaseInfo.selectedRange) : filteredData

  // Group data by day or month based on duration
  const groupedData = showDailyBars ? completeData : groupDataByMonth(completeData)

  // Get the appropriate label for the metric
  const metricLabel = isCommitMetric ? "commits" : "line changes"

  useEffect(() => {
    if (!groupedData || groupedData.length === 0 || !svgRef.current) return
    
    const svg = d3.select(svgRef.current)
    const width = size.width - sliderPadding
    const height = 30
    const margin = { top: 5, right: 5, bottom: 5, left: 5 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Clear previous content
    svg.selectAll("*").remove()

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Set up scales
    const xScale = d3
      .scaleBand()
      .domain(groupedData.map(d => d.date))
      .range([0, innerWidth])
      .padding(0.1)

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(groupedData, d => d.count) || 0])
      .range([innerHeight, 0])

    // Create bars with different colors based on metric type
    const barColor = isCommitMetric ? "steelblue" : "green"
    const zeroColor = "#e0e0e0"
    const hoverColor = isCommitMetric ? "#4a90e2" : "#45a049"

    g.selectAll("rect")
      .data(groupedData)
      .enter()
      .append("rect")
      .attr("x", d => xScale(d.date) || 0)
      .attr("y", d => yScale(d.count))
      .attr("width", xScale.bandwidth())
      .attr("height", d => innerHeight - yScale(d.count))
      .attr("fill", d => d.count === 0 ? zeroColor : barColor)
      .attr("stroke", "white")
      .attr("stroke-width", 0.5)
      .on("mouseover", function(event, d) {
        // Format date for display
        let displayDate = d.date
        let timeUnit = showDailyBars ? '' : '(monthly)'
        
        // If it's daily, try to format the date nicely
        if (showDailyBars) {
          try {
            const date = new Date(d.timestamp * 1000)
            displayDate = date.toLocaleDateString()
          } catch (e) {
            timeUnit = '(daily)'
          }
        }

        const tooltip = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "5px")
          .style("border-radius", "3px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000")
          .text(`${displayDate}: ${d.count} ${metricLabel} ${timeUnit}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px")

        d3.select(this).attr("fill", d.count === 0 ? "#c0c0c0" : hoverColor)
      })
      .on("mouseout", function(d) {
        d3.selectAll(".tooltip").remove()
        d3.select(this).attr("fill", d.count === 0 ? zeroColor : barColor)
      })

  }, [groupedData, size, showDailyBars, isCommitMetric, metricLabel])

  return (
    <div className="flex justify-center" ref={ref}>
      <svg ref={svgRef} width={`calc(100% - ${sliderPadding}px)`} height={30}></svg>
    </div>
  )
}

function fillMissingDays(data: Array<{date: string, count: number, timestamp: number}>, selectedRange: [number, number]) {
  const dataMap = new Map<string, {date: string, count: number, timestamp: number}>()
  
  // Map existing data by date
  data.forEach(d => {
    const date = new Date(d.timestamp * 1000)
    const dateKey = date.toISOString().split('T')[0] // YYYY-MM-DD format
    dataMap.set(dateKey, d)
  })
  
  const result: Array<{date: string, count: number, timestamp: number}> = []
  const startDate = new Date(selectedRange[0] * 1000)
  const endDate = new Date(selectedRange[1] * 1000)
  
  // Create entry for each day in the range
  for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
    const dateKey = currentDate.toISOString().split('T')[0]
    const timestamp = Math.floor(currentDate.getTime() / 1000)
    
    if (dataMap.has(dateKey)) {
      // Use existing data
      result.push(dataMap.get(dateKey)!)
    } else {
      // Create zero entry for missing day
      result.push({
        date: dateKey,
        count: 0,
        timestamp: timestamp
      })
    }
  }
  
  return result.sort((a, b) => a.timestamp - b.timestamp)
}

function groupDataByMonth(dailyData: Array<{date: string, count: number, timestamp: number}>) {
  const monthlyMap = new Map<string, number>()
  
  dailyData.forEach(d => {
    // Convert timestamp (seconds) to date
    const date = new Date(d.timestamp * 1000) // Convert to milliseconds
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + d.count)
  })
  
  return Array.from(monthlyMap.entries())
    .map(([date, count]) => ({
      date,
      count,
      timestamp: new Date(date + '-01').getTime() / 1000 // Convert back to seconds
    }))
    .sort((a, b) => a.timestamp - b.timestamp) // Sort by date
}

export default BarChart