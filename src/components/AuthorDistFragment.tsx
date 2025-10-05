import { Fragment } from "react"
import { useMetrics } from "~/contexts/MetricContext"
import { LegendDot } from "./util"
import { AuthorContributionData } from "~/components/DetailsCard"

interface AuthorDistFragProps {
  items: AuthorContributionData[]
  show: boolean
  contribSum: number
  showPercent?: boolean
}

export function AuthorDistFragment(props: AuthorDistFragProps) {
  const [, authorColors] = useMetrics()

  if (!props.show) return null

  return (
    <>
      {props.items.map((legendItem) => {
        const contrib = legendItem.contribs
        const author = legendItem.author
        const roundedContrib = props.contribSum > 0 ? Math.round((contrib / props.contribSum) * 100) : 0
        const contribPercentage = roundedContrib === 0 && props.contribSum > 0 ? "<1" : roundedContrib

        return (
          <div key={author} className="mb-2 flex flex-col gap-1">
            {" "}
            {}
            <div className="flex items-center justify-between">
              <div
                className="flex items-center gap-2 overflow-hidden overflow-ellipsis whitespace-pre text-sm font-semibold"
                title={author}
              >
                <LegendDot
                  authorColorToChange={author}
                  className="ml-1"
                  dotColor={authorColors.get(author) ?? "grey"}
                />
                <span className="overflow-hidden overflow-ellipsis whitespace-pre font-bold opacity-80">{author}</span>
              </div>
              <p className="break-all text-right text-sm">
                {props.showPercent === true ? `${contribPercentage}%` : contrib}
              </p>
            </div>
            {}
            <div className="ml-5 flex gap-2 text-xs text-gray-600">
              {" "}
              {}
              {legendItem.commitsOnPath !== undefined && (
                <div className="rounded-sm border border-gray-200 bg-gray-100 px-1 py-0.5">
                  Commits: {legendItem.commitsOnPath}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
