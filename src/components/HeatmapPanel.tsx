import { memo, useState, useEffect } from "react"

let globalHeatmapSelection: {
  selectedLabel: string | null
  collaborationsMap: Record<string, any>
  sizeMetric: string
  metricLabel: string
} = {
  selectedLabel: null,
  collaborationsMap: {},
  sizeMetric: "MOST_COMMITS",
  metricLabel: "Commits"
}

export const setHeatmapSelection = (selection: typeof globalHeatmapSelection) => {
  globalHeatmapSelection = { ...selection }
  window.dispatchEvent(new CustomEvent("heatmapSelectionChanged"))
}

export const HeatmapPanel = memo(function HeatmapPanel() {
  const [selection, setSelection] = useState(globalHeatmapSelection)

  useEffect(() => {
    const handler = () => setSelection({ ...globalHeatmapSelection })
    window.addEventListener("heatmapSelectionChanged", handler)
    return () => window.removeEventListener("heatmapSelectionChanged", handler)
  }, [])

  const { selectedLabel, collaborationsMap, sizeMetric, metricLabel } = selection

  return (
    <div className="card">
      <h3 className="mb-2 font-semibold text-gray-800">Co-Activity Details</h3>

      {selectedLabel ? (
        <div className="mt-2 space-y-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-gray-600">Individuals</p>
            {selectedLabel.split(" - ").map((user, idx) => (
              <p key={idx} className="text-sm text-gray-800">
                {user}
              </p>
            ))}
          </div>

          <div>
            <p className="mb-1 text-xs font-bold uppercase text-gray-600">Metric Value</p>
            <p className="text-sm text-gray-800">
              {collaborationsMap[selectedLabel]?.reduce((sum: number, f: any) => {
                switch (sizeMetric) {
                  case "MOST_COMMITS":
                    return sum + f.totalCommits
                  case "MOST_CONTRIBS":
                    return sum + f.totalLineChanges
                  case "FILE_SIZE":
                    return sum + f.sharedFiles
                  default:
                    return sum
                }
              }, 0) ?? 0}{" "}
              {metricLabel}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-bold uppercase text-gray-600">Files Impacted</p>
            <div className="max-h-96 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-500">
              {collaborationsMap[selectedLabel]?.map((file: any) => (
                <div key={file.file} className="mb-1">
                  <p className="text-gray-700">{file.file}</p>
                  <p className="text-xs text-gray-500">
                    Commits: {file.totalCommits}, Lines: {file.totalLineChanges}
                  </p>
                </div>
              )) ?? <p className="text-gray-400">No data</p>}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Click a cell in the heatmap to view details</p>
      )}
    </div>
  )
})
