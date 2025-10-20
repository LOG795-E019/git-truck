// Mock latest-version to avoid ESM issues in Jest
jest.mock("latest-version", () => ({
  default: jest.fn().mockResolvedValue("1.0.0")
}))

import ServerInstance from "./ServerInstance.server"
import type { GitLogEntry, RenameEntry, RenameInterval } from "./model"

describe("ServerInstance.gatherCommitsFromGitLog", () => {
  let instance: ServerInstance

  beforeEach(() => {
    instance = new ServerInstance("test-repo", "main", "/fake/path")
  })

  it("should parse a simple commit with file changes", async () => {
    const gitLogOutput = `"<|Alice|><|1700000000 1699999990|><|abc123|>"
3	1	src/index.ts
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput, commits, renamedFiles)

    expect(commits.size).toBe(1)
    const commit = commits.get("abc123")
    expect(commit).toBeDefined()
    expect(commit?.author).toBe("Alice")
    expect(commit?.committertime).toBe(1700000000)
    expect(commit?.authortime).toBe(1699999990)
    expect(commit?.fileChanges).toHaveLength(1)
    expect(commit?.fileChanges[0]).toEqual({
      isBinary: false,
      insertions: 3,
      deletions: 1,
      path: "test-repo/src/index.ts",
      mode: "modify"
    })
  })

  it("should parse multiple commits", async () => {
    const gitLogOutput1 = `"<|Alice|><|1700000000 1699999990|><|abc123|>"
3	1	src/index.ts
`
    const gitLogOutput2 = `"<|Bob|><|1700001000 1700000990|><|def456|>"
5	2	src/utils.ts
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    // Parse them separately to match how the function is actually called
    await instance.gatherCommitsFromGitLog(gitLogOutput1, commits, renamedFiles)
    await instance.gatherCommitsFromGitLog(gitLogOutput2, commits, renamedFiles)

    expect(commits.size).toBe(2)
    expect(commits.has("abc123")).toBe(true)
    expect(commits.has("def456")).toBe(true)
    expect(commits.get("abc123")?.author).toBe("Alice")
    expect(commits.get("def456")?.author).toBe("Bob")
  })

  it("should handle binary files", async () => {
    const gitLogOutput = `"<|Alice|><|1700000000 1699999990|><|abc123|>"
-	-	image.png
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput, commits, renamedFiles)

    const commit = commits.get("abc123")
    expect(commit?.fileChanges).toHaveLength(1)
    expect(commit?.fileChanges[0]).toEqual({
      isBinary: true,
      insertions: 1,
      deletions: 0,
      path: "test-repo/image.png",
      mode: "modify"
    })
  })

  it("should handle file renames", async () => {
    const gitLogOutput = `"<|Alice|><|1700000000 1699999990|><|abc123|>"
5	3	{old.ts => new.ts}
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput, commits, renamedFiles)

    expect(renamedFiles.length).toBeGreaterThan(0)
    const commit = commits.get("abc123")
    expect(commit?.fileChanges[0].path).toContain("new.ts")
  })

  it("should handle file creation mode", async () => {
    const gitLogOutput = `"<|Alice|><|1700000000 1699999990|><|abc123|>"
10	0	newfile.ts
 create mode 100644 newfile.ts
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput, commits, renamedFiles)

    const createEntry = renamedFiles.find((r) => r.toname === "newfile.ts" && r.fromname === null)
    expect(createEntry).toBeDefined()
  })

  it("should handle file deletion mode", async () => {
    const gitLogOutput = `"<|Alice|><|1700000000 1699999990|><|abc123|>"
0	10	oldfile.ts
 delete mode 100644 oldfile.ts
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput, commits, renamedFiles)

    const deleteEntry = renamedFiles.find((r) => r.fromname === "oldfile.ts" && r.toname === null)
    expect(deleteEntry).toBeDefined()
  })

  it("should handle multiple files in one commit", async () => {
    const gitLogOutput = `"<|Alice|><|1700000000 1699999990|><|abc123|>"
3	1	src/file1.ts
5	2	src/file2.ts
10	0	src/file3.ts
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput, commits, renamedFiles)

    const commit = commits.get("abc123")
    expect(commit?.fileChanges).toHaveLength(3)
    expect(commit?.fileChanges[0].path).toBe("test-repo/src/file1.ts")
    expect(commit?.fileChanges[1].path).toBe("test-repo/src/file2.ts")
    expect(commit?.fileChanges[2].path).toBe("test-repo/src/file3.ts")
  })

  it("should handle commits with no file changes", async () => {
    const gitLogOutput = `"<|Alice|><|1700000000 1699999990|><|abc123|>"

`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput, commits, renamedFiles)

    const commit = commits.get("abc123")
    expect(commit).toBeDefined()
    expect(commit?.fileChanges).toHaveLength(0)
  })

  it("should handle commits with complex file paths", async () => {
    const gitLogOutput = `"<|Alice|><|1700000000 1699999990|><|abc123|>"
3	1	src/components/Button/index.tsx
5	2	tests/__mocks__/api.mock.ts
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput, commits, renamedFiles)

    const commit = commits.get("abc123")
    expect(commit?.fileChanges[0].path).toBe("test-repo/src/components/Button/index.tsx")
    expect(commit?.fileChanges[1].path).toBe("test-repo/tests/__mocks__/api.mock.ts")
  })

  it("should handle special characters in author names", async () => {
    const gitLogOutput = `"<|Alice O'Brien|><|1700000000 1699999990|><|abc123|>"
3	1	file.ts
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput, commits, renamedFiles)

    expect(commits.get("abc123")?.author).toBe("Alice O'Brien")
  })

  it("should accumulate commits into existing map", async () => {
    const gitLogOutput1 = `"<|Alice|><|1700000000 1699999990|><|abc123|>"
3	1	file1.ts
`
    const gitLogOutput2 = `"<|Bob|><|1700001000 1700000990|><|def456|>"
5	2	file2.ts
`

    const commits = new Map<string, GitLogEntry>()
    const renamedFiles: RenameEntry[] = []

    await instance.gatherCommitsFromGitLog(gitLogOutput1, commits, renamedFiles)
    await instance.gatherCommitsFromGitLog(gitLogOutput2, commits, renamedFiles)

    expect(commits.size).toBe(2)
    expect(commits.has("abc123")).toBe(true)
    expect(commits.has("def456")).toBe(true)
  })
})

describe("ServerInstance.generateRenameChains", () => {
  let instance: ServerInstance

  beforeEach(() => {
    instance = new ServerInstance("test-repo", "main", "/fake/path")
  })

  it("should handle simple rename A -> B", () => {
    const orderedRenames: RenameInterval[] = [{ fromname: "A.ts", toname: "B.ts", timestamp: 1000, timestampend: 2000 }]
    const currentFiles = ["B.ts"]

    const result = instance["generateRenameChains"](orderedRenames, currentFiles)

    expect(result).toHaveLength(1)
    const chain = result[0]
    expect(chain[0].toname).toBe("B.ts")
    expect(chain[1].fromname).toBe("A.ts")
  })

  it("should handle rename chain A -> B -> C", () => {
    const orderedRenames: RenameInterval[] = [
      { fromname: "B.ts", toname: "C.ts", timestamp: 2000, timestampend: 3000 },
      { fromname: "A.ts", toname: "B.ts", timestamp: 1000, timestampend: 2000 }
    ]
    const currentFiles = ["C.ts"]

    const result = instance["generateRenameChains"](orderedRenames, currentFiles)

    expect(result).toHaveLength(1)
    const chain = result[0]
    expect(chain).toHaveLength(3)
    expect(chain[0].toname).toBe("C.ts")
    expect(chain[1].fromname).toBe("B.ts")
    expect(chain[2].fromname).toBe("A.ts")
  })

  it("should handle file creation (null -> A)", () => {
    const orderedRenames: RenameInterval[] = [{ fromname: null, toname: "A.ts", timestamp: 1000, timestampend: 2000 }]
    const currentFiles = ["A.ts"]

    const result = instance["generateRenameChains"](orderedRenames, currentFiles)

    expect(result).toHaveLength(1)
    const chain = result[0]
    expect(chain[0].fromname).toBe("A.ts")
    expect(chain[0].toname).toBe("A.ts")
    expect(chain[0].timestamp).toBe(2000)
  })

  it("should handle file deletion (A -> null)", () => {
    const orderedRenames: RenameInterval[] = [{ fromname: "A.ts", toname: null, timestamp: 1000, timestampend: 2000 }]
    const currentFiles: string[] = []

    const result = instance["generateRenameChains"](orderedRenames, currentFiles)

    expect(result).toHaveLength(0)
  })

  it("should handle multiple independent rename chains", () => {
    const orderedRenames: RenameInterval[] = [
      { fromname: "A.ts", toname: "B.ts", timestamp: 1000, timestampend: 2000 },
      { fromname: "X.ts", toname: "Y.ts", timestamp: 1500, timestampend: 2500 }
    ]
    const currentFiles = ["B.ts", "Y.ts"]

    const result = instance["generateRenameChains"](orderedRenames, currentFiles)

    expect(result).toHaveLength(2)
  })

  it("should handle empty inputs gracefully", () => {
    const result1 = instance["generateRenameChains"]([], ["file.ts"])
    expect(result1).toHaveLength(1)
    expect(result1[0][0].fromname).toBe("file.ts")

    const result2 = instance["generateRenameChains"]([], [])
    expect(result2).toHaveLength(0)
  })
})
