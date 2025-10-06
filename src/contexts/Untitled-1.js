// ...existing imports...
import { useState } from "react"
// ...existing code...

export const Chart = memo(function Chart({ setHoveredObject }: { setHoveredObject: (obj: GitObject | null) => void }) {
  // ...existing code...
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null)
  // ...existing code...

  // Memoize relationships and related authors for AUTHOR_GRAPH
  const relationshipsMap = useMemo(() => chartType === "AUTHOR_GRAPH" ? getAuthorsRelationships(databaseInfo) : {}, [chartType, databaseInfo])
  const relatedAuthors = useMemo(() => {
    if (!selectedAuthor || chartType !== "AUTHOR_GRAPH") return null
    const rels = relationshipsMap[selectedAuthor]?.Relationships || {}
    return new Set([selectedAuthor, ...Object.keys(rels)])
  }, [selectedAuthor, relationshipsMap, chartType])

  // ...existing code...
  return (
    <div className="relative grid place-items-center overflow-hidden" ref={ref}>
      <svg
        // ...existing svg props...
        onClick={() => {
          setSelectedAuthor(null) // Reset on background click
          const parentPath = path.split("/").slice(0, -1).join("/")
          if (parentPath === "") setPath("/")
          else setPath(parentPath)
        }}
      >
        {/* Draw relationship lines for AUTHOR_GRAPH */}
        {chartType === "AUTHOR_GRAPH" &&
          (() => {
            // ...existing code...
            return Object.entries(relationshipsMap).flatMap(([author1, relObj]) =>
              Object.entries(relObj.Relationships).flatMap(([author2, relData]) => {
                // ...existing code...
                // Fade unrelated lines
                const faded =
                  selectedAuthor &&
                  !(selectedAuthor === author1 || selectedAuthor === author2)
                // ...existing code...
                return [
                  <line
                    key={`rel-${author1}-${author2}-1`}
                    // ...existing props...
                    opacity={faded ? 0.15 : 0.7}
                    className={clsx(
                      "cursor-pointer transition-opacity hover:opacity-100",
                      faded && "pointer-events-none"
                    )}
                    onMouseEnter={() => {
                      if (faded) return
                      // ...existing code...
                      setHoveredObject(tooltipContent as any)
                    }}
                    onMouseLeave={() => setHoveredObject(null)}
                  />,
                  <line
                    key={`rel-${author1}-${author2}-2`}
                    // ...existing props...
                    opacity={faded ? 0.15 : 0.7}
                    className={clsx(
                      "cursor-pointer transition-opacity hover:opacity-100",
                      faded && "pointer-events-none"
                    )}
                    onMouseEnter={() => {
                      if (faded) return
                      // ...existing code...
                      setHoveredObject(tooltipContent as any)
                    }}
                    onMouseLeave={() => setHoveredObject(null)}
                  />
                ]
              })
            )
          })()}

        {/* Draw author nodes and other nodes */}
        {nodes.map((d, i) => {
          let faded = false
          if (
            chartType === "AUTHOR_GRAPH" &&
            d.data.path.includes("/@") &&
            selectedAuthor &&
            relatedAuthors &&
            !relatedAuthors.has(d.data.name)
          ) {
            faded = true
          }
          return (
            <g
              key={d.data.path}
              className={clsx(
                "transition-opacity hover:opacity-60",
                {
                  // ...existing class logic...
                  "animate-blink": clickedObject?.path === d.data.path
                },
                faded && "opacity-30 pointer-events-none"
              )}
              onClick={(evt) => {
                evt.stopPropagation()
                if (
                  chartType === "AUTHOR_GRAPH" &&
                  d.data.path.includes("/@")
                ) {
                  setSelectedAuthor((prev) =>
                    prev === d.data.name ? null : d.data.name
                  )
                } else {
                  createGroupHandlers(d, i === 0).onClick(evt)
                }
              }}
              {...(!(
                chartType === "AUTHOR_GRAPH" &&
                d.data.path.includes("/@")
              )
                ? createGroupHandlers(d, i === 0)
                : {})}
            >
              {(numberOfDepthLevels === undefined || d.depth <= numberOfDepthLevels) && (
                <>
                  <Node key={d.data.path} d={d} isSearchMatch={Boolean(searchResults[d.data.path])} />
                  {labelsVisible && (
                    <NodeText key={`text|${path}|${d.data.path}|${chartType}|${sizeMetric}|${now}`} d={d}>
                      {collapseText({ d, isRoot: i === 0, path, displayText: d.data.name, chartType })}
                    </NodeText>
                  )}
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
})
// ...existing code...