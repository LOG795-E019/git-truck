// Mock latest-version to avoid ESM issues in Jest
jest.mock("latest-version", () => ({
  default: jest.fn().mockResolvedValue("1.0.0")
}))

import { analyzeRenamedFile, getTimeIntervals } from "./util.server"
import type { RenameEntry } from "./model"
import {
  analyzeRenamedFile,
  getTimeIntervals,
  last,
  sleep,
  lookupFileInTree,
  formatMs,
  generateTruckFrames,
  getBaseDirFromPath,
  getRepoNameFromPath,
  getSiblingRepository,
  isValidURI,
  promiseHelper
} from "./util.server"
import type { RenameEntry, GitTreeObject, GitBlobObject } from "./model"

describe("analyzeRenamedFile", () => {
  const repo = "test-repo"
  const timestamp = 1000000
  const authortime = 999999

  it("should handle nested path renames with braces", () => {
    const renamedFiles: RenameEntry[] = []
    const file = "src/{old/path/file.ts => new/path/file.ts}"

    const result = analyzeRenamedFile(file, timestamp, authortime, renamedFiles, repo)

    expect(result).toBe("test-repo/src/new/path/file.ts")
    expect(renamedFiles).toHaveLength(1)
    expect(renamedFiles[0]).toEqual({
      fromname: "test-repo/src/old/path/file.ts",
      toname: "test-repo/src/new/path/file.ts",
      timestamp,
      timestampauthor: authortime
    })
  })

  it("should handle simple renames with braces", () => {
    const renamedFiles: RenameEntry[] = []
    const file = "{oldfile.ts => newfile.ts}"

    const result = analyzeRenamedFile(file, timestamp, authortime, renamedFiles, repo)

    expect(result).toBe("test-repo/newfile.ts")
    expect(renamedFiles[0].fromname).toBe("test-repo/oldfile.ts")
    expect(renamedFiles[0].toname).toBe("test-repo/newfile.ts")
  })

  it("should handle arrow-style renames without braces", () => {
    const renamedFiles: RenameEntry[] = []
    const file = "old/path/file.ts => new/path/file.ts"

    const result = analyzeRenamedFile(file, timestamp, authortime, renamedFiles, repo)

    expect(result).toBe("test-repo/new/path/file.ts")
    expect(renamedFiles[0].fromname).toBe("test-repo/old/path/file.ts")
    expect(renamedFiles[0].toname).toBe("test-repo/new/path/file.ts")
  })

  it("should handle directory rename with multiple path segments", () => {
    const renamedFiles: RenameEntry[] = []
    const file = "src/components/{Button/index.tsx => Modal/index.tsx}"

    const result = analyzeRenamedFile(file, timestamp, authortime, renamedFiles, repo)

    expect(result).toBe("test-repo/src/components/Modal/index.tsx")
    expect(renamedFiles[0].fromname).toBe("test-repo/src/components/Button/index.tsx")
  })

  it("should handle partial directory renames", () => {
    const renamedFiles: RenameEntry[] = []
    const file = "lib/{utils => helpers}/file.ts"

    const result = analyzeRenamedFile(file, timestamp, authortime, renamedFiles, repo)

    expect(result).toBe("test-repo/lib/helpers/file.ts")
    expect(renamedFiles[0].fromname).toBe("test-repo/lib/utils/file.ts")
  })

  it("should avoid double slashes in paths", () => {
    const renamedFiles: RenameEntry[] = []
    const file = "{=>newfile.ts}"

    const result = analyzeRenamedFile(file, timestamp, authortime, renamedFiles, repo)

    expect(result).not.toContain("//")
    expect(renamedFiles[0].fromname).not.toContain("//")
  })

  it("should handle files with special characters", () => {
    const renamedFiles: RenameEntry[] = []
    const file = "{old-file_v1.0.ts => new-file_v2.0.ts}"

    const result = analyzeRenamedFile(file, timestamp, authortime, renamedFiles, repo)

    expect(result).toBe("test-repo/new-file_v2.0.ts")
    expect(renamedFiles[0].fromname).toBe("test-repo/old-file_v1.0.ts")
  })

  it("should preserve timestamps correctly", () => {
    const renamedFiles: RenameEntry[] = []
    const file = "{old.ts => new.ts}"
    const customTimestamp = 1234567890
    const customAuthortime = 1234567800

    analyzeRenamedFile(file, customTimestamp, customAuthortime, renamedFiles, repo)

    expect(renamedFiles[0].timestamp).toBe(customTimestamp)
    expect(renamedFiles[0].timestampauthor).toBe(customAuthortime)
  })
})

describe("getTimeIntervals", () => {
  it("should generate day intervals correctly", () => {
    const minTime = new Date("2024-01-01").getTime() / 1000
    const maxTime = new Date("2024-01-05").getTime() / 1000

    const intervals = getTimeIntervals("day", minTime, maxTime)

    expect(intervals.length).toBeGreaterThanOrEqual(5)
    intervals.forEach((interval) => {
      expect(interval).toBeInstanceOf(Array)
      expect(interval).toHaveLength(2)
      expect(typeof interval[0]).toBe("string")
      expect(typeof interval[1]).toBe("number")
    })
  })

  it("should generate week intervals correctly", () => {
    const minTime = new Date("2024-01-01").getTime() / 1000
    const maxTime = new Date("2024-01-31").getTime() / 1000

    const intervals = getTimeIntervals("week", minTime, maxTime)

    expect(intervals.length).toBeGreaterThan(0)
    expect(intervals.length).toBeLessThanOrEqual(6)
    expect(intervals[0][0]).toContain("Week")
  })

  it("should generate month intervals correctly", () => {
    const minTime = new Date("2024-01-01").getTime() / 1000
    const maxTime = new Date("2024-06-30").getTime() / 1000

    const intervals = getTimeIntervals("month", minTime, maxTime)

    expect(intervals.length).toBeGreaterThanOrEqual(6)
    expect(intervals[intervals.length - 1][0]).toContain("June")
  })

  it("should generate year intervals correctly", () => {
    const minTime = new Date("2020-06-15").getTime() / 1000
    const maxTime = new Date("2024-12-31").getTime() / 1000

    const intervals = getTimeIntervals("year", minTime, maxTime)

    expect(intervals.length).toBeGreaterThanOrEqual(4)
    const yearLabels = intervals.map((i) => i[0])
    expect(yearLabels).toContain("2024")
  })

  it("should handle same start and end time", () => {
    const time = new Date("2024-06-15").getTime() / 1000

    const intervals = getTimeIntervals("day", time, time)

    expect(intervals.length).toBeGreaterThanOrEqual(1)
  })

  it("should handle year boundary transitions for weeks", () => {
    const minTime = new Date("2023-12-25").getTime() / 1000
    const maxTime = new Date("2024-01-05").getTime() / 1000

    const intervals = getTimeIntervals("week", minTime, maxTime)

    expect(intervals.length).toBeGreaterThan(0)
  })

  it("should handle year boundary transitions for months", () => {
    const minTime = new Date("2023-11-15").getTime() / 1000
    const maxTime = new Date("2024-02-15").getTime() / 1000

    const intervals = getTimeIntervals("month", minTime, maxTime)

    expect(intervals.length).toBeGreaterThanOrEqual(3)
  })

  it("should have timestamps in ascending order", () => {
    const minTime = new Date("2024-01-01").getTime() / 1000
    const maxTime = new Date("2024-12-31").getTime() / 1000

    const intervals = getTimeIntervals("month", minTime, maxTime)

    for (let i = 0; i < intervals.length - 1; i++) {
      expect(intervals[i][1]).toBeLessThanOrEqual(intervals[i + 1][1])
    }
  })
})

describe("last", () => {
  it("should return the last element of an array", () => {
    expect(last([1, 2, 3])).toBe(3)
    expect(last(["a", "b", "c"])).toBe("c")
    expect(last([42])).toBe(42)
  })

  it("should return undefined for empty array", () => {
    expect(last([])).toBeUndefined()
  })
})

describe("sleep", () => {
  it("should resolve after the specified time", async () => {
    const start = Date.now()
    await sleep(10)
    const end = Date.now()
    expect(end - start).toBeGreaterThanOrEqual(8)
  })
})

describe("lookupFileInTree", () => {
  const mockBlob: GitBlobObject = {
    type: "blob",
    name: "file.txt",
    path: "file.txt",
    sizeInBytes: 100,
    hash: "abc123"
  }

  const mockTree: GitTreeObject = {
    type: "tree",
    name: "root",
    path: "",
    children: [mockBlob],
    hash: "def456"
  }

  it("should find a file at root level", () => {
    const result = lookupFileInTree(mockTree, "file.txt")
    expect(result).toBe(mockBlob)
  })

  it("should return undefined for non-existent file", () => {
    const result = lookupFileInTree(mockTree, "nonexistent.txt")
    expect(result).toBeUndefined()
  })

  it("should handle nested paths", () => {
    const nestedTree: GitTreeObject = {
      type: "tree",
      name: "root",
      path: "",
      children: [
        {
          type: "tree",
          name: "dir",
          path: "dir",
          children: [mockBlob],
          hash: "ghi789"
        }
      ],
      hash: "def456"
    }

    const result = lookupFileInTree(nestedTree, "dir/file.txt")
    expect(result).toBe(mockBlob)
  })
})

describe("formatMs", () => {
  it("should format milliseconds correctly", () => {
    expect(formatMs(1000)).toBe("1.00s")
    expect(formatMs(1500)).toBe("1.50s")
    expect(formatMs(100)).toBe("100ms")
    expect(formatMs(0)).toBe("0ms")
  })
})

describe("path utilities", () => {
  it("getBaseDirFromPath should return parent directory", () => {
    expect(getBaseDirFromPath("/path/to/repo")).toBe("/path/to")
    const result = getBaseDirFromPath("repo")
    expect(result).toMatch(/^\/.+/)
  })

  it("getRepoNameFromPath should extract repo name", () => {
    expect(getRepoNameFromPath("/path/to/my-repo")).toBe("my-repo")
    expect(getRepoNameFromPath("my-repo")).toBe("my-repo")
  })

  it("getSiblingRepository should construct sibling path", () => {
    expect(getSiblingRepository("/path/to/repo1", "repo2")).toBe("/path/to/repo2")
  })
})

describe("isValidURI", () => {
  it("should check if string can be decoded as URI component", () => {
    expect(isValidURI("http://example.com")).toBe(true)
    expect(isValidURI("https://example.com")).toBe(true)
    expect(isValidURI("ftp://example.com")).toBe(true)
    expect(isValidURI("not-a-uri")).toBe(true)
    expect(isValidURI("")).toBe(true)
    expect(isValidURI("%")).toBe(false)
  })
})

describe("promiseHelper", () => {
  it("should resolve successful promises", async () => {
    const result = await promiseHelper(Promise.resolve("success"))
    expect(result).toEqual(["success", null])
  })

  it("should reject failed promises", async () => {
    const error = new Error("test error")
    const result = await promiseHelper(Promise.reject(error))
    expect(result).toEqual([null, error])
  })
})

describe("generateTruckFrames", () => {
  it("should generate frames for truck animation", () => {
    const frames = generateTruckFrames(3)

    expect(frames).toHaveLength(3)
    expect(frames[0]).toBe("  🚛\n")
    expect(frames[1]).toBe(" 🚛\n")
    expect(frames[2]).toBe("🚛\n")
  })

  it("should handle length of 1", () => {
    const frames = generateTruckFrames(1)

    expect(frames).toHaveLength(1)
    expect(frames[0]).toBe("🚛\n")
  })
})
