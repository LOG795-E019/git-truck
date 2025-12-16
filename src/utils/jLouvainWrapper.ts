/* eslint-disable @typescript-eslint/no-var-requires */
// Thin TypeScript wrapper around the existing UMD/CommonJS `jLouvain.js`
// It provides a typed factory function that returns the jLouvain core object.

type JLouvainEdge = { source: string; target: string; weight: number }
type JLouvainPartition = Record<string, string>

type JLouvainCore = {
  nodes: (nds: string[]) => JLouvainCore
  edges: (eds: JLouvainEdge[]) => JLouvainCore
  partition_init: (p: JLouvainPartition) => JLouvainCore
  // calling the object returns the resulting partition mapping
  (): JLouvainPartition
}

// Import the JS file (CommonJS/UMD). This uses require because the file
// exports with `module.exports = factory()` and may not be a true ES module.
const jLouvainFactory: () => JLouvainCore = require("./jLouvain")

export default function jLouvain(): JLouvainCore {
  return jLouvainFactory()
}

export type { JLouvainEdge, JLouvainPartition, JLouvainCore }
