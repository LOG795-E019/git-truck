import { Icon } from "@mdi/react"
import { mdiChartLine } from "@mdi/js"
import { memo, useState, useMemo, useEffect } from "react"
import { Slider, Rail, Handles, Tracks } from "react-compound-slider"
import { useData } from "~/contexts/DataContext"
import { Handle, Track } from "./sliderUtils"
import { noEntryColor } from "~/const"

function CompositeScoreSlider({
  weights,
  setWeights
}: {
  weights: [number, number, number]
  setWeights: (weights: [number, number, number]) => void
}) {
  const sliderStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: 20,
    zIndex: 0
  }

  const domain = [0, 100]

  // Calculate handle positions
  const handlePositions = [weights[0], weights[0] + weights[1]]

  const updateWeights = (newPositions: readonly number[]) => {
    const pos1 = Math.max(0, Math.min(100, newPositions[0]))
    const pos2 = Math.max(pos1, Math.min(100, newPositions[1]))

    const busFactor = pos1
    const ownership = pos2 - pos1
    const activity = 100 - pos2

    setWeights([busFactor, ownership, activity])
  }

  // State for real-time visual updates during dragging
  const [tempWeights, setTempWeights] = useState<[number, number, number]>(weights)

  useEffect(() => {
    setTempWeights(weights)
  }, [weights])

  const updateTempWeights = (newPositions: readonly number[]) => {
    const pos1 = Math.max(0, Math.min(100, newPositions[0]))
    const pos2 = Math.max(pos1, Math.min(100, newPositions[1]))

    const busFactor = pos1
    const ownership = pos2 - pos1
    const activity = 100 - pos2

    setTempWeights([busFactor, ownership, activity])
  }

  // Use tempWeights for visual display, weights for actual state
  const displayWeights = tempWeights

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Visual distribution bars */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: 14,
          borderRadius: 7,
          overflow: "hidden",
          backgroundColor: "#7aa0c4"
        }}
      >
        <div
          className="bg-red-500"
          style={{
            position: "absolute",
            left: 0,
            width: `${displayWeights[0]}%`,
            height: "100%"
          }}
        />
        <div
          className="bg-yellow-500"
          style={{
            position: "absolute",
            left: `${displayWeights[0]}%`,
            width: `${displayWeights[1]}%`,
            height: "100%"
          }}
        />
        <div
          className="bg-green-500"
          style={{
            position: "absolute",
            left: `${displayWeights[0] + displayWeights[1]}%`,
            width: `${displayWeights[2]}%`,
            height: "100%"
          }}
        />
      </div>

      {/* Slider overlay */}
      <Slider
        mode={3}
        step={5}
        domain={domain}
        rootStyle={sliderStyle}
        onChange={updateWeights}
        onUpdate={updateTempWeights}
        values={handlePositions}
      >
        <Rail>
          {({ getRailProps }) => (
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: 14,
                borderRadius: 7,
                backgroundColor: "transparent",
                cursor: "pointer"
              }}
              {...getRailProps()}
            />
          )}
        </Rail>
        <Handles>
          {({ handles, getHandleProps }) => (
            <div className="slider-handles">
              {handles.map((handle) => (
                <Handle key={handle.id} handle={handle} domain={domain} getHandleProps={getHandleProps} />
              ))}
            </div>
          )}
        </Handles>
      </Slider>
    </div>
  )
}

export const MetricsCard = memo(function MetricsCard() {
  const { databaseInfo } = useData()
  const [isExpanded, setIsExpanded] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [weights, setWeights] = useState<[number, number, number]>([40, 40, 20])

  const metrics = useMemo(() => {
    // Bus factor
    const busFactorFiles = Object.entries(databaseInfo.authorCounts).filter(([_, count]) => count === 1)
    const busFactor = busFactorFiles.length
    const totalFiles = Object.keys(databaseInfo.authorCounts).length
    const busFactorPercentage = totalFiles > 0 ? ((busFactor / totalFiles) * 100).toFixed(1) : "0"

    // Gini coefficient
    const calculateGini = (values: number[]): number => {
      if (values.length === 0) return 0
      const sorted = [...values].sort((a, b) => a - b)
      const n = sorted.length
      let sum = 0
      for (let i = 0; i < n; i++) {
        sum += (2 * (i + 1) - n - 1) * sorted[i]
      }
      const mean = sorted.reduce((a, b) => a + b, 0) / n
      return sum / (n * n * mean)
    }

    const contributions = Object.values(databaseInfo.authorsTotalStats).map((s) => s.nb_line_change)
    const giniCoefficient = calculateGini(contributions)
    const giniPercentage = (giniCoefficient * 100).toFixed(1)

    // Active contributors
    const totalAuthors = databaseInfo.authors.length
    const now = Date.now()

    const getPeriodLengthSeconds = (dateString: string): number => {
      if (dateString.startsWith("Week")) return 7 * 24 * 60 * 60
      if (
        dateString.includes("Mon") ||
        dateString.includes("Tue") ||
        dateString.includes("Wed") ||
        dateString.includes("Thu") ||
        dateString.includes("Fri") ||
        dateString.includes("Sat") ||
        dateString.includes("Sun")
      )
        return 24 * 60 * 60
      if (
        dateString.includes("January") ||
        dateString.includes("February") ||
        dateString.includes("March") ||
        dateString.includes("April") ||
        dateString.includes("May") ||
        dateString.includes("June") ||
        dateString.includes("July") ||
        dateString.includes("August") ||
        dateString.includes("September") ||
        dateString.includes("October") ||
        dateString.includes("November") ||
        dateString.includes("December")
      )
        return 30 * 24 * 60 * 60
      return 365 * 24 * 60 * 60
    }

    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000

    const recentCommits30 = databaseInfo.commitCountPerDay.filter((d) => {
      const periodLength = getPeriodLengthSeconds(d.date)
      return (d.timestamp + periodLength) * 1000 >= thirtyDaysAgo
    })

    const recentCommits90 = databaseInfo.commitCountPerDay.filter((d) => {
      const periodLength = getPeriodLengthSeconds(d.date)
      return (d.timestamp + periodLength) * 1000 >= ninetyDaysAgo
    })

    const commits30Days = recentCommits30.reduce((sum, d) => sum + d.count, 0)
    const commits90Days = recentCommits90.reduce((sum, d) => sum + d.count, 0)

    // Recent activity
    const repoAgeDays = Math.max(
      1,
      Math.floor(((databaseInfo.newestChangeDate - databaseInfo.oldestChangeDate) * 1000) / (1000 * 60 * 60 * 24))
    )
    const daysSinceLastCommit = Math.floor((now - databaseInfo.newestChangeDate * 1000) / (1000 * 60 * 60 * 24))

    // Recent activity
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

    const recentCommits7 = databaseInfo.commitCountPerDay.filter((d) => {
      const periodLength = getPeriodLengthSeconds(d.date)
      return (d.timestamp + periodLength) * 1000 >= sevenDaysAgo
    })

    const commits7Days = recentCommits7.reduce((sum, d) => sum + d.count, 0)
    const lineChanges7Days = databaseInfo.lineChangeCountPerDay
      .filter((d) => {
        const periodLength = getPeriodLengthSeconds(d.date)
        return (d.timestamp + periodLength) * 1000 >= sevenDaysAgo
      })
      .reduce((sum, d) => sum + d.count, 0)

    // Top hotspot files
    const hotspotFiles = Object.entries(databaseInfo.commitCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    // Code quality indicators
    const oneEightyDaysAgo = (now - 180 * 24 * 60 * 60 * 1000) / 1000
    const staleFiles = Object.entries(databaseInfo.lastChanged).filter(
      ([_, lastChangeTime]) => lastChangeTime < oneEightyDaysAgo
    )
    const staleFilesCount = staleFiles.length
    const staleFilesPercentage = totalFiles > 0 ? ((staleFilesCount / totalFiles) * 100).toFixed(1) : "0"

    // Repository health score
    const busFactorScore = Math.min(100, ((totalFiles - busFactor) / totalFiles) * 100)
    const giniScore = (1 - giniCoefficient) * 100
    const activityScore = Math.min(100, (commits30Days / 30) * 10)

    // Dynamic weights based on slider
    const [busFactorWeight, ownershipWeight, activityWeight] = weights
    const healthScore =
      ((busFactorScore * (busFactorWeight / 100) +
        giniScore * (ownershipWeight / 100) +
        activityScore * (activityWeight / 100)) /
        100) *
      100

    // 80/20 Rule Check
    const sortedContribs = [...contributions].sort((a, b) => b - a)
    const totalContribs = sortedContribs.reduce((a, b) => a + b, 0)
    const top20Percent = Math.ceil(sortedContribs.length * 0.2)
    const top20ContribSum = sortedContribs.slice(0, top20Percent).reduce((a, b) => a + b, 0)
    const top20Percentage = totalContribs > 0 ? ((top20ContribSum / totalContribs) * 100).toFixed(1) : "0"

    return {
      busFactor,
      busFactorPercentage,
      giniCoefficient,
      giniPercentage,
      totalAuthors,
      commits7Days,
      commits30Days,
      commits90Days,
      lineChanges7Days,
      repoAgeDays,
      daysSinceLastCommit,
      hotspotFiles,
      healthScore: healthScore.toFixed(1),
      top20Percentage,
      top20Percent,
      staleFilesCount,
      staleFilesPercentage,
      staleFiles
    }
  }, [databaseInfo, weights])

  return (
    <div className="card">
      <fieldset className="rounded-lg border p-2">
        <legend className="card__title ml-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon path={mdiChartLine} size="1.25em" />
            Metrics
          </div>
          <button className="btn btn-xs ml-auto" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? "Hide" : "Show"}
          </button>
        </legend>

        {isExpanded && (
          <div className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">Repository Health</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{metrics.healthScore}</span>
                <span className="text-sm text-gray-500">/ 100</span>
                <span
                  className={`ml-auto text-xs font-semibold ${
                    Number(metrics.healthScore) >= 70
                      ? "text-green-600"
                      : Number(metrics.healthScore) >= 40
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {Number(metrics.healthScore) >= 70 ? "Good" : Number(metrics.healthScore) >= 40 ? "Fair" : "Poor"}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                Composite score: bus factor ({weights[0]}%), ownership distribution ({weights[1]}%), activity (
                {weights[2]}%)
              </p>
            </div>

            <CompositeScoreSlider weights={weights} setWeights={setWeights} />

            <button className="btn btn-xs w-full" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? "Hide Details" : "Show Details"}
            </button>

            {showDetails && (
              <>
                <hr className="border-gray-200 dark:border-gray-700" />

                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">Bus Factor Risk</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{metrics.busFactor}</span>
                    <span className="text-sm text-gray-500">files ({metrics.busFactorPercentage}%)</span>
                  </div>
                  <p className="text-xs text-gray-600">Files with only one contributor. Lower is better.</p>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">Ownership Concentration</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{metrics.giniPercentage}</span>
                    <span className="text-sm text-gray-500">Gini coefficient</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Top {metrics.top20Percent} authors ({metrics.top20Percentage}% of changes). 0 = equal, 100 =
                    concentrated.
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">Active Contributors</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{metrics.totalAuthors}</span>
                    <span className="text-sm text-gray-500">total</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <div>Last 30 days: {metrics.commits30Days} commits</div>
                    <div>Last 90 days: {metrics.commits90Days} commits</div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">Recent Activity</h3>
                  <div className="text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Last 7 days:</span>
                      <span className="font-semibold">
                        {metrics.commits7Days} commits, {metrics.lineChanges7Days.toLocaleString()} lines
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Repository age:</span>
                      <span className="font-semibold">{metrics.repoAgeDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last commit:</span>
                      <span className="font-semibold">
                        {metrics.daysSinceLastCommit === 0 ? "Today" : `${metrics.daysSinceLastCommit} days ago`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">Top 5 Hotspot Files</h3>
                  <div className="rounded border p-2 text-xs">
                    {metrics.hotspotFiles.map(([filepath, count]) => {
                      const filename = filepath.split("/").pop() || filepath
                      return (
                        <div key={filepath} className="flex justify-between gap-2 border-b py-1 last:border-b-0">
                          <span className="truncate" title={filepath}>
                            {filename}
                          </span>
                          <span className="font-semibold text-gray-600">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-600">Files with most commits. May need attention or refactoring.</p>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">Stale Files (180+ days)</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{metrics.staleFilesCount}</span>
                    <span className="text-sm text-gray-500">files ({metrics.staleFilesPercentage}%)</span>
                  </div>
                  <p className="text-xs text-gray-600">Files not touched in 180+ days. May indicate technical debt.</p>
                  {metrics.staleFiles.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded border p-2 text-xs">
                      {metrics.staleFiles.map(([filepath]) => {
                        const filename = filepath.split("/").pop() || filepath
                        return (
                          <div key={filepath} className="truncate py-0.5" title={filepath}>
                            {filename}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </fieldset>
    </div>
  )
})
