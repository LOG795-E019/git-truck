import type { DatabaseInfo } from "~/routes/$repo.$"
import { Fragment } from "react"
import { useData } from "../contexts/DataContext"
import { getAuthorsRelationships } from "./Chart"

interface RelationshipDistFragProps {
  author: string
  show: boolean
  showPercent?: boolean
  sizeMetric?: string
}

export function RelationshipDistFragment(props: RelationshipDistFragProps) {
  const { databaseInfo } = useData()
  const authorsRelationships = getAuthorsRelationships(databaseInfo)
  // Correct way to access relationships for the author:
  const authorRelationships = authorsRelationships[props.author]?.Relationships || {}

  if (!props.show) return null

  // Choose metric
  const searched_Stat = props.sizeMetric === "MOST_CONTRIBS" ? "nb_line_change" : "nb_commits"

  // Prepare entries
  const entries = Object.entries(authorRelationships)
  .sort((a, b) => {
    const aTotal = (a[1].author1Contribs[searched_Stat] ?? 0) + (a[1].author2Contribs[searched_Stat] ?? 0)
    const bTotal = (b[1].author1Contribs[searched_Stat] ?? 0) + (b[1].author2Contribs[searched_Stat] ?? 0)
    return bTotal - aTotal
  })
  .slice(0, 5)

  return (
    <div className="grid grid-cols-[1fr,auto,auto] gap-1">
      <div className="font-semibold">Co-author</div>
      <div className="font-semibold text-right">Current Author{}</div>
      <div className="font-semibold text-right">Co-Author</div>
      {entries.map(([author2, relData]) => {
        const author1Value = relData.author1Contribs[searched_Stat] ?? 0
        const author2Value = relData.author2Contribs[searched_Stat] ?? 0
        const totalValue = author1Value + author2Value

        let author1Display = author1Value
        let author2Display = author2Value
        if (props.showPercent) {
          author1Display = totalValue > 0 ? Math.round((author1Value / totalValue) * 100) : 0
          author2Display = totalValue > 0 ? Math.round((author2Value / totalValue) * 100) : 0
        }

        return (
          <Fragment key={author2}>
            <div className="truncate font-bold opacity-80" title={author2}>{author2}</div>
            <div className="break-all text-right text-sm">
              {props.showPercent ? `${author1Display}%` : author1Value}
            </div>
            <div className="break-all text-right text-sm">
              {props.showPercent ? `${author2Display}%` : author2Value}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}