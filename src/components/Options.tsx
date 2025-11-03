import type { MetricType } from "../metrics/metrics"
import { Metric } from "../metrics/metrics"
import { EnumSelect } from "./EnumSelect"
import type { ChartType } from "../contexts/OptionsContext"
import { Chart, useOptions } from "../contexts/OptionsContext"
import { Icon } from "@mdi/react"
import { memo, useState, useEffect, useRef, useMemo } from "react"
import { useData } from "~/contexts/DataContext"
import { FileSelector } from "src/components/FileSelector"

import {
  mdiChartBubble,
  mdiChartTree,
  mdiAccountNetwork,
  mdiPodiumGold,
  mdiFileCodeOutline,
  mdiUpdate,
  mdiResize,
  mdiSourceCommit,
  mdiScaleBalance,
  mdiPalette,
  mdiImageSizeSelectSmall,
  mdiPuzzle,
  mdiPlusMinusVariant,
  mdiFolder,
  mdiGroup,
  mdiTextBox,
  mdiAccountMultiple,
  mdiFilter,
  mdiFileMultiple,
  mdiAccount,
  mdiAccountSupervisorCircle
} from "@mdi/js"
import type { SizeMetricType } from "~/metrics/sizeMetric"
import { SizeMetric } from "~/metrics/sizeMetric"
import type { GroupingType } from "~/metrics/grouping"
import { Grouping } from "~/metrics/grouping"

export const relatedSizeMetric: Record<MetricType, SizeMetricType> = {
  FILE_TYPE: "FILE_SIZE",
  TOP_CONTRIBUTOR: "MOST_CONTRIBS",
  MOST_COMMITS: "MOST_COMMITS",
  LAST_CHANGED: "LAST_CHANGED",
  MOST_CONTRIBUTIONS: "MOST_CONTRIBS"
}

export const Options = memo(function Options() {
  const {
    metricType,
    chartType,
    sizeMetric,
    linkMetricAndSizeMetric,
    groupingType,
    selectedAuthors,
    selectedFiles,
    setMetricType,
    setChartType,
    setSizeMetricType,
    setGroupingType,
    setSelectedAuthors,
    setSelectedFiles,
    setSelectedFilePaths
  } = useOptions()

  const { databaseInfo } = useData()
  const [showAuthorFilter, setShowAuthorFilter] = useState(false)
  const [showFileFilter, setShowFileFilter] = useState(false)
  const [searchFilter, setSearchFilter] = useState("")
  const [fileSearchFilter, setFileSearchFilter] = useState("")
  const [fileExtensionFilter, setFileExtensionFilter] = useState("")
  const [minCommits, setMinCommits] = useState<number | undefined>(undefined)
  const [maxCommits, setMaxCommits] = useState<number | undefined>(undefined)
  const [minLineChanges, setMinLineChanges] = useState<number | undefined>(undefined)
  const [maxLineChanges, setMaxLineChanges] = useState<number | undefined>(undefined)
  const authorInitializedRef = useRef(false)
  const filesInitializedRef = useRef(false)

  // Get all authors and files from database
  const allAuthors = Object.keys(databaseInfo?.authorsTotalStats || {})
  const allFiles = useMemo(() => {
    const files = new Set<string>()
    Object.values(databaseInfo?.authorsFilesStats || {}).forEach((authorFiles) => {
      Object.keys(authorFiles).forEach((file) => files.add(file))
    })
    return Array.from(files)
  }, [databaseInfo?.authorsFilesStats])

  // Initialize selected authors and files
  useEffect(() => {
    if ((!selectedAuthors || selectedAuthors.length === 0) && !authorInitializedRef.current && allAuthors.length > 0) {
      setSelectedAuthors(allAuthors)
      authorInitializedRef.current = true
    }
  }, [allAuthors, selectedAuthors, setSelectedAuthors])

  useEffect(() => {
    if (
      (selectedFiles === undefined || selectedFiles.length === 0) &&
      !filesInitializedRef.current &&
      allFiles.length > 0
    ) {
      console.log(`Initializing files selection with ${allFiles.length} files`)
      setSelectedFiles(allFiles)
      filesInitializedRef.current = true
    }
  }, [allFiles, setSelectedFiles])

  // Filtered authors based on search term
  const filteredAuthors = allAuthors
    .filter((author) => author.toLowerCase().includes(searchFilter.toLowerCase()))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  const authorFilteredStats = useMemo(() => {
    if (!databaseInfo?.authorsFilesStats) return {}

    const stats: Record<string, { nb_commits: number; nb_line_change: number }> = {}
    allAuthors.forEach((author) => {
      stats[author] = { nb_commits: 0, nb_line_change: 0 }
    })

    // Calculate stats based only on selected files
    Object.entries(databaseInfo.authorsFilesStats).forEach(([author, fileStats]) => {
      Object.entries(fileStats).forEach(([filePath, fileContributions]) => {
        if (selectedFiles.includes(filePath)) {
          stats[author].nb_commits += fileContributions.nb_commits
          stats[author].nb_line_change += fileContributions.nb_line_change
        }
      })
    })

    return stats
  }, [databaseInfo?.authorsFilesStats, selectedFiles, allAuthors])

  // Filter authors based on numeric stats
  const numericFilteredAuthors = useMemo(() => {
    return filteredAuthors.filter((author) => {
      const stats = authorFilteredStats[author]
      if (!stats) return false

      if (minCommits !== undefined && stats.nb_commits < minCommits) return false
      if (maxCommits !== undefined && stats.nb_commits > maxCommits) return false
      if (minLineChanges !== undefined && stats.nb_line_change < minLineChanges) return false
      if (maxLineChanges !== undefined && stats.nb_line_change > maxLineChanges) return false

      return true
    })
  }, [filteredAuthors, minCommits, maxCommits, minLineChanges, maxLineChanges, authorFilteredStats])

  // File filtering based on search term and extension
  const filteredFiles = useMemo(() => {
    return allFiles
      .filter((file) => {
        // Filter by search term
        if (!file.toLowerCase().includes(fileSearchFilter.toLowerCase())) return false

        // Filter by file extension if specified
        if (fileExtensionFilter) {
          const ext = file.split(".").pop() || ""
          if (!ext.toLowerCase().includes(fileExtensionFilter.toLowerCase())) return false
        }

        return true
      })
      .sort((a, b) => a.localeCompare(b))
  }, [allFiles, fileSearchFilter, fileExtensionFilter])

  const visualizationIcons: Record<MetricType, string> = {
    FILE_TYPE: mdiFileCodeOutline,
    LAST_CHANGED: mdiUpdate,
    MOST_COMMITS: mdiSourceCommit,
    TOP_CONTRIBUTOR: mdiPodiumGold,
    MOST_CONTRIBUTIONS: mdiPlusMinusVariant
  }

  const sizeMetricIcons = useMemo(() => {
    const allIcons: Record<SizeMetricType, string> = {
      FILE_SIZE: mdiResize,
      EQUAL_SIZE: mdiScaleBalance,
      MOST_COMMITS: mdiSourceCommit,
      LAST_CHANGED: mdiUpdate,
      MOST_CONTRIBS: mdiPlusMinusVariant
    }

    if (groupingType === "FILE_AUTHORS") {
      // Only return icons for the visible options
      return {
        MOST_COMMITS: allIcons.MOST_COMMITS,
        MOST_CONTRIBS: allIcons.MOST_CONTRIBS,
        EQUAL_SIZE: allIcons.EQUAL_SIZE
      } as Record<SizeMetricType, string>
    }

    return allIcons
  }, [groupingType])

  const groupingTypeIcons: Record<GroupingType, string> = {
    FILE_TYPE: mdiFileCodeOutline,
    FOLDER_NAME: mdiFolder,
    JSON_RULES: mdiTextBox,
    AUTHOR_FILES: mdiAccountMultiple,
    FILE_AUTHORS: mdiAccountNetwork,
    DEFAULT:mdiAccount,
    SUPERVISOR:mdiAccountSupervisorCircle,
  }

  const chartTypeIcons: Record<ChartType, string> = {
    BUBBLE_CHART: mdiChartBubble,
    TREE_MAP: mdiChartTree,
    AUTHOR_GRAPH: mdiAccountNetwork
  }

  // Compute grouping options depending on chart type. When not in AUTHOR_GRAPH,
  // exclude DEFAULT and SUPERVISOR. Use strict equality checks.
  const groupingOptions = useMemo(() => {
    if (chartType === "AUTHOR_GRAPH") {
      return (
        Object.fromEntries(
          Object.entries(Grouping).filter(([key]) => key === "DEFAULT" || key === "SUPERVISOR")
        ) as Record<GroupingType, string>
      )
    }

    return (
      Object.fromEntries(
        Object.entries(Grouping).filter(([key]) => key !== "DEFAULT" && key !== "SUPERVISOR")
      ) as Record<GroupingType, string>
    )
  }, [chartType])

  // Buttons Behaviors
  const toggleAuthor = (author: string) => {
    if (selectedAuthors.includes(author)) {
      setSelectedAuthors(selectedAuthors.filter((a) => a !== author))
    } else {
      setSelectedAuthors([...selectedAuthors, author])
    }
  }

  const toggleFile = (file: string) => {
    if (selectedFiles.includes(file)) {
      setSelectedFiles(selectedFiles.filter((f) => f !== file))
    } else {
      setSelectedFiles([...selectedFiles, file])
    }
  }

  const selectVisibleAuthors = () => {
    const newSelection = [...new Set([...selectedAuthors, ...numericFilteredAuthors])]
    setSelectedAuthors(newSelection)
  }

  const deselectVisibleAuthors = () => {
    setSelectedAuthors(selectedAuthors.filter((author) => !numericFilteredAuthors.includes(author)))
  }

  const deselectEmpty = () => {
    setSelectedAuthors(
      selectedAuthors.filter((author) => {
        const stats = authorFilteredStats[author]
        return !(stats && stats.nb_commits === 0 && stats.nb_line_change === 0)
      })
    )
  }

  const selectAllVisibleFiles = () => {
    const newSelection = [...new Set([...selectedFiles, ...filteredFiles])]
    setSelectedFiles(newSelection)
  }

  const deselectAllVisibleFiles = () => {
    setSelectedFiles(selectedFiles.filter((file) => !filteredFiles.includes(file)))
  }

  const resetFileFilters = () => {
    setFileSearchFilter("")
    setFileExtensionFilter("")
  }

  const resetAuthorFilters = () => {
    setMinCommits(undefined)
    setMaxCommits(undefined)
    setMinLineChanges(undefined)
    setMaxLineChanges(undefined)
    setSearchFilter("")
  }

  const resetAllFilters = () => {
    resetFileFilters()
    resetAuthorFilters()
    setSelectedFiles(allFiles)
    setSelectedAuthors(allAuthors)
  }

  return (
    <>
      <div className="card">
        <fieldset className="rounded-lg border p-2">
          <legend className="card__title ml-1.5 justify-start gap-2">
            <Icon path={mdiPuzzle} size="1.25em" />
            Layout
          </legend>
          <EnumSelect
            enum={Chart}
            defaultValue={chartType}
            onChange={(chartType: ChartType) => setChartType(chartType)}
            iconMap={chartTypeIcons}
          />
        </fieldset>

        <fieldset className="rounded-lg border p-2">
          <legend className="card__title ml-1.5 justify-start gap-2">
            <Icon path={mdiImageSizeSelectSmall} size="1.25em" />
            Size
          </legend>
          <EnumSelect
            enum={
              chartType === "AUTHOR_GRAPH"
                ? (Object.fromEntries(
                    Object.entries(SizeMetric).filter(([key]) => key !== "FILE_SIZE" && key !== "LAST_CHANGED")
                  ) as Record<SizeMetricType, string>)
                : SizeMetric
            }
            defaultValue={sizeMetric}
            onChange={(sizeMetric: SizeMetricType) => setSizeMetricType(sizeMetric)}
            iconMap={sizeMetricIcons}
          />
        </fieldset>
        {chartType !== "AUTHOR_GRAPH" && groupingType !== "FILE_AUTHORS" && (
          <fieldset className="rounded-lg border p-2">
            <legend className="card__title ml-1.5 justify-start gap-2">
              <Icon path={mdiPalette} size="1.25em" />
              Color
            </legend>
            <EnumSelect
              enum={Metric}
              defaultValue={metricType}
              onChange={(metric: MetricType) => {
                setMetricType(metric)
                if (!linkMetricAndSizeMetric) {
                  return
                }
                const relatedSizeMetricType = relatedSizeMetric[metric]
                if (relatedSizeMetricType) {
                  setSizeMetricType(relatedSizeMetricType)
                }
              }}
              iconMap={visualizationIcons}
            />
          </fieldset>
        )}
        {
          <fieldset className="rounded-lg border p-2">
            <legend className="card__title ml-1.5 justify-start gap-2">
              <Icon path={mdiGroup} size="1.25em" />
              Grouping
            </legend>
            <EnumSelect
              enum={groupingOptions}
              defaultValue={groupingType}
              onChange={(newGroupingType: GroupingType) => {
                setGroupingType(newGroupingType)

                // Clear selections when switching between grouping types
                if (newGroupingType !== "FILE_AUTHORS") {
                  setSelectedFilePaths([])
                }

                // Auto-switch to relevant size metric for FILE_AUTHORS
                if (newGroupingType === "FILE_AUTHORS") {
                  if (sizeMetric === "FILE_SIZE" || sizeMetric === "LAST_CHANGED") {
                    setSizeMetricType("MOST_CONTRIBS") // Default to line changes
                  }
                }
              }}
              iconMap={groupingTypeIcons}
            />
          </fieldset>
        }

        {/* Global Reset Button */}
        {chartType === "AUTHOR_GRAPH" && (
          <div className="mb-2 mt-4">
            <button
              className="btn w-full"
              onClick={resetAllFilters}
              title="Reset all filters and selections to default state"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Author Filter Section */}
        {chartType === "AUTHOR_GRAPH" && (
          <>
            {/* File Filter Section */}
            <fieldset className="mt-2 rounded-lg border p-2">
              <legend className="card__title ml-1.5 justify-start gap-2">
                <Icon path={mdiFileMultiple} size="1.25em" />
                File Filter
                <button className="btn btn-xs ml-auto" onClick={() => setShowFileFilter(!showFileFilter)}>
                  {showFileFilter ? "Hide" : "Show"}
                </button>
              </legend>

              {showFileFilter && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm text-gray-600">
                    This filter only affects stats shown in Author Filter. Search then select files to be included in
                    the stats calculations.
                  </p>

                  {/* Search files box */}
                  <p> File Search </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-grow">
                      <input
                        type="text"
                        className="input w-full pr-8"
                        placeholder="Search files..."
                        value={fileSearchFilter}
                        onChange={(e) => setFileSearchFilter(e.target.value)}
                      />
                      {fileSearchFilter && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setFileSearchFilter("")}
                          title="Clear search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* File extension filter */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-grow">
                      <input
                        type="text"
                        className="input w-full pr-8"
                        placeholder="Filter by extension (js, tsx, etc.)"
                        value={fileExtensionFilter}
                        onChange={(e) => setFileExtensionFilter(e.target.value)}
                      />
                      {fileExtensionFilter && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setFileExtensionFilter("")}
                          title="Clear extension filter"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reset filters button */}
                  <button
                    className="btn btn-xs w-full"
                    onClick={resetFileFilters}
                    disabled={!fileSearchFilter && !fileExtensionFilter}
                  >
                    Clear All Fields
                  </button>

                  <hr className="my-1 border-t border-gray-200 dark:border-gray-700" />
                  <p> File List </p>

                  {/* Select/Deselect buttons - MOVED HERE */}
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-xs flex-1"
                      onClick={selectAllVisibleFiles}
                      title="Select all visible files"
                    >
                      Select All Visible
                    </button>
                    <button
                      className="btn btn-xs flex-1"
                      onClick={deselectAllVisibleFiles}
                      title="Deselect all visible files"
                    >
                      Deselect All Visible
                    </button>
                  </div>

                  {/* File list */}
                  <div className="max-h-60 overflow-y-auto rounded border p-2">
                    {filteredFiles.length > 0 ? (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 text-xs text-gray-500">
                            <th className="w-8 pb-1 text-left">✓</th>
                            <th className="pb-1 text-left">File</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFiles.map((file, index) => {
                            const fileName = file.split("/").pop() || file
                            return (
                              <tr
                                key={file}
                                className={`
                                  hover:bg-gray-100 dark:hover:bg-gray-700
                                  ${index < filteredFiles.length - 1 ? "border-b border-gray-200 dark:border-gray-700" : ""}
                                `}
                                onClick={() => toggleFile(file)}
                              >
                                <td className="py-1 align-middle">
                                  <input
                                    type="checkbox"
                                    checked={selectedFiles.includes(file)}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      toggleFile(file)
                                    }}
                                    className="checkbox checkbox-sm"
                                  />
                                </td>
                                <td className="overflow-hidden text-ellipsis py-1" title={file}>
                                  {fileName}
                                  <span className="ml-2 text-xs text-gray-500">
                                    {file.replace("/" + fileName, "") || "/"}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-center text-gray-500">No files found</p>
                    )}
                  </div>

                  <div className="text-sm text-gray-500">
                    {selectedFiles.length} of {allFiles.length} files selected,
                    {filteredFiles.length} shown
                  </div>
                </div>
              )}
            </fieldset>

            {/* Author Filter Section */}
            <fieldset className="mt-2 rounded-lg border p-2">
              <legend className="card__title ml-1.5 justify-start gap-2">
                <Icon path={mdiFilter} size="1.25em" />
                Author Filter
                <button className="btn btn-xs ml-auto" onClick={() => setShowAuthorFilter(!showAuthorFilter)}>
                  {showAuthorFilter ? "Hide" : "Show"}
                </button>
              </legend>

              {showAuthorFilter && (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm text-gray-600">
                    This filter changes who is shown on the graph. Search then select authors to be included in the
                    graph.
                  </p>

                  {/* Search authors box */}
                  <p> Author Search </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-grow">
                      <input
                        type="text"
                        className="input w-full pr-8"
                        placeholder="Search authors..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                      />
                      {searchFilter && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          onClick={() => setSearchFilter("")}
                          title="Clear search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Numeric filter inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <label htmlFor="commits-min" className="text-xs font-medium">
                        Commits
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          id="commits-min"
                          type="number"
                          className="input input-xs w-full"
                          placeholder="Min"
                          min={0}
                          value={minCommits ?? ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : undefined
                            if (value !== undefined && maxCommits !== undefined && value > maxCommits) {
                              setMaxCommits(value)
                            }
                            setMinCommits(value)
                          }}
                        />
                        <span className="text-xs text-gray-500">to</span>
                        <input
                          id="commits-max"
                          type="number"
                          className="input input-xs w-full"
                          placeholder="Max"
                          min={minCommits ?? 0}
                          value={maxCommits ?? ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : undefined
                            if (value !== undefined && minCommits !== undefined && value < minCommits) {
                              setMinCommits(value)
                            }
                            setMaxCommits(value)
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="line-changes-min" className="text-xs font-medium">
                        Line Changes
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          id="line-changes-min"
                          type="number"
                          className="input input-xs w-full"
                          placeholder="Min"
                          min={0}
                          step={10}
                          value={minLineChanges ?? ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : undefined
                            if (value !== undefined && maxLineChanges !== undefined && value > maxLineChanges) {
                              setMaxLineChanges(value)
                            }
                            setMinLineChanges(value)
                          }}
                        />
                        <span className="text-xs text-gray-500">to</span>
                        <input
                          id="line-changes-max"
                          type="number"
                          className="input input-xs w-full"
                          placeholder="Max"
                          min={minLineChanges ?? 0}
                          value={maxLineChanges ?? ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : undefined
                            if (value !== undefined && minLineChanges !== undefined && value < minLineChanges) {
                              setMinLineChanges(value)
                            }
                            setMaxLineChanges(value)
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reset filters button */}
                  <button
                    className="btn btn-xs w-full"
                    onClick={resetAuthorFilters}
                    disabled={!minCommits && !maxCommits && !minLineChanges && !maxLineChanges && !searchFilter}
                  >
                    Clear All Fields
                  </button>

                  <hr className="my-1 border-t border-gray-200 dark:border-gray-700" />
                  <p> Author List </p>

                  {/* Select/Deselect buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      className="btn btn-xs flex-1"
                      onClick={selectVisibleAuthors}
                      title="Select all visible authors"
                    >
                      Select All
                    </button>
                    <button
                      className="btn btn-xs flex-1"
                      onClick={deselectVisibleAuthors}
                      title="Deselect all visible authors"
                    >
                      Deselect All
                    </button>
                    <button
                      className="btn btn-xs flex-1"
                      onClick={deselectEmpty}
                      title="Deselect authors with no contributions"
                    >
                      Deselect Empty
                    </button>
                  </div>

                  {/* Author list as a table */}
                  <div className="max-h-60 overflow-y-auto rounded border p-2">
                    {numericFilteredAuthors.length > 0 ? (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 text-xs text-gray-500">
                            <th className="w-8 pb-1 text-left">✓</th>
                            <th className="pb-1 text-left">Author</th>
                            <th className="pb-1 text-right">Commits</th>
                            <th className="pb-1 text-right">Changes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {numericFilteredAuthors.map((author, index) => {
                            return (
                              <tr
                                key={author}
                                className={`
                                  hover:bg-gray-100 dark:hover:bg-gray-700
                                  ${index < numericFilteredAuthors.length - 1 ? "border-b border-gray-200 dark:border-gray-700" : ""}
                                `}
                                onClick={() => toggleAuthor(author)}
                              >
                                <td className="py-1 align-middle">
                                  <input
                                    type="checkbox"
                                    checked={selectedAuthors.includes(author)}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      toggleAuthor(author)
                                    }}
                                    className="checkbox checkbox-sm"
                                  />
                                </td>
                                <td className="py-1">{author}</td>
                                <td className="py-1 text-right text-xs text-gray-500">
                                  {authorFilteredStats[author]?.nb_commits.toLocaleString() || 0}
                                </td>
                                <td className="py-1 text-right text-xs text-gray-500">
                                  {authorFilteredStats[author]?.nb_line_change.toLocaleString() || 0}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-center text-gray-500">No authors found</p>
                    )}
                  </div>

                  <div className="text-sm text-gray-500">
                    {selectedAuthors.length} of {allAuthors.length} authors selected,
                    {numericFilteredAuthors.length} shown
                  </div>
                </div>
              )}
            </fieldset>
          </>
        )}
      </div>

      {/* Add the conditional FileSelector here */}
      {groupingType === "FILE_AUTHORS" && (
        <div className="card mt-4">
          <FileSelector />
        </div>
      )}
    </>
  )
})
