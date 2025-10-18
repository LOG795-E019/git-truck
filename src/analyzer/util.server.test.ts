// Mock latest-version to avoid ESM issues in Jest
jest.mock("latest-version", () => ({
  default: jest.fn().mockResolvedValue("1.0.0")
}))

import { analyzeRenamedFile, getTimeIntervals } from "./util.server"
import type { RenameEntry } from "./model"

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
    const file = "{=>newfile.ts}" // Edge case with empty old path

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
      expect(typeof interval[0]).toBe("string") // label
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
    // Should include years from minTime to maxTime range
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
