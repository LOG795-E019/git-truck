import { createContext, useContext } from "react"
import type { MetricType } from "../metrics/metrics"
import { Metric } from "../metrics/metrics"
import type { SizeMetricType } from "~/metrics/sizeMetric"
import { SizeMetric } from "~/metrics/sizeMetric"
import { Grouping, type GroupingType } from "~/metrics/grouping"
import { Depth, type DepthType } from "~/metrics/chartDepth"

export const Chart = {
  BUBBLE_CHART: "Bubble Chart",
  TREE_MAP: "Tree Map",
  AUTHOR_GRAPH: "Author Graph"
} as const

export type ChartType = keyof typeof Chart

export const Hierarchy = {
  NESTED: "Nested",
  FLAT: "Flat"
} as const

export type HierarchyType = keyof typeof Hierarchy

export const SortingMethods = {
  DATE: "By date",
  AUTHOR: "By author"
}
export type CommitSortingMethodsType = keyof typeof SortingMethods

export const SortingOrders = (isDate: boolean) => {
  return {
    ASCENDING: isDate ? "Latest first" : "Ascending",
    DESCENDING: isDate ? "Oldest first" : "Descending"
  }
}
export type CommitSortingOrdersType = keyof typeof SortingOrders

export type Options = {
  hasLoadedSavedOptions: boolean
  metricType: MetricType
  chartType: ChartType
  depthType: DepthType
  hierarchyType: HierarchyType
  commitSortingMethodsType: CommitSortingMethodsType
  commitSortingOrdersType: CommitSortingOrdersType
  commitSearch: string
  sizeMetric: SizeMetricType
  groupingType: GroupingType
  transitionsEnabled: boolean
  labelsVisible: boolean
  renderCutoff: number
  minBubbleSize: number
  maxBubbleSize: number
  showFilesWithoutChanges: boolean
  showFilesWithNoJSONRules: boolean
  dominantAuthorCutoff: number
  linkMetricAndSizeMetric: boolean
  selectedAuthors: string[]
}

export type OptionsContextType = Options & {
  setMetricType: (metricType: MetricType) => void
  setChartType: (chartType: ChartType) => void
  setSizeMetricType: (sizeMetricType: SizeMetricType) => void
  setGroupingType: (groupingType: GroupingType) => void
  setTransitionsEnabled: (transitionsEnabled: boolean) => void
  setLabelsVisible: (labelsVisible: boolean) => void
  setDepthType: (depthType: DepthType) => void
  setHierarchyType: (hierarchyType: HierarchyType) => void
  setCommitSortingMethodsType: (commitSortingMethodsType: CommitSortingMethodsType) => void
  setCommitSortingOrdersType: (commitSortingOrdersType: CommitSortingOrdersType) => void
  setCommitSearch: (commitSearch: string) => void
  setRenderCutoff: (renderCutoff: number) => void
  setMinBubbleSize: (minBubbleSize: number) => void
  setMaxBubbleSize: (maxBubbleSize: number) => void
  setShowFilesWithoutChanges: (showFilesWithoutChanges: boolean) => void
  setShowFilesWithNoJSONRules: (showFilesWithNoJSONRules: boolean) => void
  setDominantAuthorCutoff: (dominantAuthorCutoff: number) => void
  setLinkMetricAndSizeMetric: (link: boolean) => void
  setSelectedAuthors: (authors: string[]) => void
}

export const OptionsContext = createContext<OptionsContextType | undefined>(undefined)

export function useOptions() {
  const context = useContext(OptionsContext)
  if (!context) {
    throw new Error("useOptions must be used within a SearchProvider")
  }
  return context
}

const defaultOptions: Options = {
  hasLoadedSavedOptions: false,
  metricType: Object.keys(Metric)[0] as MetricType,
  chartType: Object.keys(Chart)[0] as ChartType,
  depthType: Object.keys(Depth)[0] as DepthType,
  hierarchyType: Object.keys(Hierarchy)[0] as HierarchyType,
  sizeMetric: Object.keys(SizeMetric)[0] as SizeMetricType,
  groupingType: Object.keys(Grouping)[0] as GroupingType,
  commitSortingMethodsType: Object.keys(SortingMethods)[0] as CommitSortingMethodsType,
  // The parameter value is based on default sorting method - date (true) or author (false)
  commitSortingOrdersType: Object.keys(SortingOrders(true))[0] as CommitSortingOrdersType,
  commitSearch: "",
  transitionsEnabled: true,
  labelsVisible: true,
  renderCutoff: 2,
  minBubbleSize: 0.1,
  maxBubbleSize: 2,
  showFilesWithoutChanges: true,
  showFilesWithNoJSONRules: false,
  dominantAuthorCutoff: 0,
  linkMetricAndSizeMetric: false,
  selectedAuthors: []
}

export function getDefaultOptionsContextValue(savedOptions: Partial<Options> = {}): OptionsContextType {
  return {
    ...defaultOptions,
    ...savedOptions,
    setChartType: () => {
      throw new Error("No chartTypeSetter provided")
    },
    setMetricType: () => {
      throw new Error("No metricTypeSetter provided")
    },
    setSizeMetricType: () => {
      throw new Error("No sizeMetricTypeSetter provided")
    },
    setGroupingType: () => {
      throw new Error("No groupingSetter provided")
    },
    setDepthType: () => {
      throw new Error("No DepthTypeSetter provided")
    },
    setHierarchyType: () => {
      throw new Error("No HiearchyTypeSetter provided")
    },
    setCommitSortingMethodsType: () => {
      throw new Error("No CommitSortingMethodsTypeSetter provided")
    },
    setCommitSortingOrdersType: () => {
      throw new Error("No CommitSortingOrdersTypeSetter provided")
    },
    setCommitSearch: () => {
      throw new Error("No CommitSearchSetter provided")
    },
    setTransitionsEnabled: () => {
      throw new Error("No transitionsEnabledSetter provided")
    },
    setLabelsVisible: () => {
      throw new Error("No labelsVisibleSetter provided")
    },
    setRenderCutoff: () => {
      throw new Error("No renderCutoffSetter provided")
    },
    setMinBubbleSize: () => {
      throw new Error("No minBubbleSizeSetter provided")
    },
    setMaxBubbleSize: () => {
      throw new Error("No maxBubbleSizeSetter provided")
    },
    setShowFilesWithoutChanges: () => {
      throw new Error("No showFilesWithoutChangesSetter provided")
    },
    setShowFilesWithNoJSONRules: () => {
      throw new Error("No showFilesWithNoJSONRulesSetter provided")
    },
    setDominantAuthorCutoff: () => {
      throw new Error("No setDominantAuthorCutoffSetter provided")
    },
    setLinkMetricAndSizeMetric: () => {
      throw new Error("No setLinkMetricAndSizeMetricSetter provided")
    },
    setSelectedAuthors: () => {
      throw new Error("No setSelectedAuthorsSetter provided")
    }
  }
}
