import type { DatabaseInfo } from "~/routes/$repo.$"
import { Fragment } from "react"
import { useData } from "../contexts/DataContext"

interface FileDistributionFragProps {
  author: string
  show: boolean
  showPercent?: boolean
  sizeMetric?: string
}

export function FileDistributionFragment(props: FileDistributionFragProps) {
  const { databaseInfo } = useData()
  type MetricKey = "nb_commits" | "nb_line_change"
  let sizeMetric: MetricKey = "nb_line_change"
  if (props.sizeMetric === "MOST_COMMITS") {
    sizeMetric = "nb_commits"
  }
  const authorsFilesStatsObj = databaseInfo.authorsFilesStats[props.author] || {}
  const authorContributions = databaseInfo.authorsTotalStats[props.author][sizeMetric] || 0

  if (!props.show) return null

  // Prepare the file entries
  const sortedEntries = Object.entries(authorsFilesStatsObj)
    .sort((a, b) => b[1][sizeMetric] - a[1][sizeMetric])
    .slice(0, 5);

    const fileEntries = sortedEntries.map(([fileName, fileStat]) => {
    const fileSize = fileStat[sizeMetric]
    let displayValue: string

    if (props.showPercent) {
        if (authorContributions === 0) {
        displayValue = fileSize.toString()
        } else {
        const filePercentage = Math.round((fileSize / authorContributions) * 100)
        displayValue = `${filePercentage}%`
        }
    } else {
        displayValue = fileSize.toString()
    }

    return (
      <Fragment key={fileName}>
        <div className="flex items-center gap-2 overflow-hidden overflow-ellipsis whitespace-pre text-sm font-semibold" title={fileName}>
          <span className="overflow-hidden overflow-ellipsis whitespace-pre font-bold opacity-80">{fileName}</span>
        </div>
        <p className="break-all text-right text-sm">{displayValue}</p>
      </Fragment>
    )
  })

  return (
    <div className="grid grid-cols-[1fr,auto] gap-1">
      {fileEntries}
    </div>
  )
}