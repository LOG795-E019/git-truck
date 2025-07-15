export const Grouping = {
  FOLDER_NAME: "Folder Name",
  FILE_TYPE: "File type",
  JSON_RULES: "JSON Rules",
  FILE_AUTHORS: "File Authors"
} as const

export type GroupingType = keyof typeof Grouping
