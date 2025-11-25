// Mock color-convert
jest.mock("color-convert", () => ({
  hex: {
    rgb: jest.fn((hex: string) => {
      const cleanHex = hex.replace("#", "")
      if (cleanHex === "ff0000") return [255, 0, 0]
      if (cleanHex === "00ff00") return [0, 255, 0]
      if (cleanHex === "0000ff") return [0, 0, 255]
      if (cleanHex === "ffffff") return [255, 255, 255]
      if (cleanHex === "000000") return [0, 0, 0]
      if (cleanHex === "808080") return [128, 128, 128]
      return [128, 128, 128]
    })
  },
  hsl: {
    hex: jest.fn((hsl: [number, number, number]) => {
      return "808080"
    })
  }
}))

import {
  diagonal,
  dateFormatLong,
  dateFormatCalendarHeader,
  dateFormatShort,
  dateTimeFormatShort,
  dateFormatRelative,
  last,
  allExceptLast,
  allExceptFirst,
  getSeparator,
  getPathFromRepoAndHead,
  branchCompare,
  semverCompare,
  getTextColorFromBackground,
  hslToHex,
  getLightness,
  isTree,
  isBlob
} from "./util"
import type { GitTreeObject, GitBlobObject } from "./analyzer/model"

describe("util.ts", () => {
  describe("diagonal", () => {
    it("should calculate diagonal distance", () => {
      const mockNode = {
        x0: 0,
        x1: 3,
        y0: 0,
        y1: 4
      } as any

      const result = diagonal(mockNode)
      expect(result).toBe(5)
    })

    it("should handle negative coordinates", () => {
      const mockNode = {
        x0: -1,
        x1: 2,
        y0: -1,
        y1: 2
      } as any

      const result = diagonal(mockNode)
      expect(result).toBeCloseTo(4.24, 2)
    })
  })

  describe("dateFormatLong", () => {
    it("should format epoch time to long date format", () => {
      const epochTime = 1704067200
      const result = dateFormatLong(epochTime)
      expect(result).toMatch(/\d{2} \w{3} \d{4}/)
      expect(result).not.toBe("Invalid date")
    })

    it("should return 'Invalid date' for undefined", () => {
      expect(dateFormatLong(undefined)).toBe("Invalid date")
      expect(dateFormatLong(0)).toBe("Invalid date")
    })
  })

  describe("dateFormatCalendarHeader", () => {
    it("should format epoch time to calendar header format", () => {
      const epochTime = Date.now()
      const result = dateFormatCalendarHeader(epochTime)
      expect(result).toMatch(/\w+ \d{4}/)
      expect(result).not.toBe("Invalid date")
    })

    it("should return 'Invalid date' for undefined", () => {
      expect(dateFormatCalendarHeader(undefined)).toBe("Invalid date")
    })
  })

  describe("dateFormatShort", () => {
    it("should format epoch time to short date format", () => {
      const epochTime = Date.now()
      const result = dateFormatShort(epochTime)
      expect(result).toMatch(/\d{2} \w{3} \d{2}/)
    })
  })

  describe("dateTimeFormatShort", () => {
    it("should format epoch time to short datetime format", () => {
      const epochTime = 1704112200000
      const result = dateTimeFormatShort(epochTime)
      expect(result).toContain("01.")
      expect(result).toContain("24")
    })
  })

  describe("dateFormatRelative", () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("should return 'Unknown time ago' for future dates", () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600
      expect(dateFormatRelative(futureTime)).toBe("Unknown time ago")
    })

    it("should return days ago for dates more than 24 hours ago", () => {
      const twoDaysAgo = Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000)
      expect(dateFormatRelative(twoDaysAgo)).toBe("2 days ago")

      const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
      expect(dateFormatRelative(oneDayAgo)).toBe("1 day ago")
    })

    it("should return hours ago for dates less than 24 hours ago", () => {
      const twoHoursAgo = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000)
      expect(dateFormatRelative(twoHoursAgo)).toBe("2 hours ago")

      const oneHourAgo = Math.floor((Date.now() - 60 * 60 * 1000) / 1000)
      expect(dateFormatRelative(oneHourAgo)).toBe("1 hour ago")
    })

    it("should return '<1 hour ago' for recent dates", () => {
      const thirtyMinutesAgo = Math.floor((Date.now() - 30 * 60 * 1000) / 1000)
      expect(dateFormatRelative(thirtyMinutesAgo)).toBe("<1 hour ago")
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

  describe("allExceptLast", () => {
    it("should return all elements except the last", () => {
      expect(allExceptLast([1, 2, 3, 4])).toEqual([1, 2, 3])
      expect(allExceptLast([1, 2])).toEqual([1])
    })

    it("should return empty array for arrays with 1 or 0 elements", () => {
      expect(allExceptLast([1])).toEqual([])
      expect(allExceptLast([])).toEqual([])
    })
  })

  describe("allExceptFirst", () => {
    it("should return all elements except the first", () => {
      expect(allExceptFirst([1, 2, 3, 4])).toEqual([2, 3, 4])
      expect(allExceptFirst([1, 2])).toEqual([2])
    })

    it("should return empty array for arrays with 1 or 0 elements", () => {
      expect(allExceptFirst([1])).toEqual([])
      expect(allExceptFirst([])).toEqual([])
    })
  })

  describe("getSeparator", () => {
    it("should return backslash for Windows paths", () => {
      expect(getSeparator("C:\\path\\to\\file")).toBe("\\")
      expect(getSeparator("path\\to\\file")).toBe("\\")
    })

    it("should return forward slash for Unix paths", () => {
      expect(getSeparator("/path/to/file")).toBe("/")
      expect(getSeparator("path/to/file")).toBe("/")
      expect(getSeparator("file.txt")).toBe("/")
    })
  })

  describe("getPathFromRepoAndHead", () => {
    it("should join repo and encoded branch with slash", () => {
      expect(getPathFromRepoAndHead("my-repo", "feature/branch")).toBe("my-repo/feature%2Fbranch")
      expect(getPathFromRepoAndHead("repo", "main")).toBe("repo/main")
    })
  })

  describe("branchCompare", () => {
    it("should prioritize main/master branches", () => {
      expect(branchCompare("main", "feature")).toBe(-1)
      expect(branchCompare("master", "develop")).toBe(-1)
      expect(branchCompare("feature", "main")).toBe(1)
      expect(branchCompare("develop", "master")).toBe(1)
    })

    it("should sort alphabetically when neither is main/master", () => {
      expect(branchCompare("alpha", "beta")).toBeLessThan(0)
      expect(branchCompare("beta", "alpha")).toBeGreaterThan(0)
      expect(branchCompare("branch", "branch")).toBe(0)
    })

    it("should prioritize exact main/master matches", () => {
      expect(branchCompare("main", "feature")).toBe(-1)
      expect(branchCompare("master", "develop")).toBe(-1)
    })

    it("should be case insensitive for non-default branches", () => {
      expect(branchCompare("alpha", "Beta")).toBeLessThan(0)
      expect(branchCompare("Beta", "alpha")).toBeGreaterThan(0)
    })
  })

  describe("semverCompare", () => {
    it("should compare valid semver versions", () => {
      expect(semverCompare("2.0.0", "1.0.0")).toBeGreaterThan(0)
      expect(semverCompare("1.0.0", "2.0.0")).toBeLessThan(0)
      expect(semverCompare("1.0.0", "1.0.0")).toBe(0)
    })

    it("should handle invalid semver gracefully", () => {
      expect(semverCompare("1.0.0", "invalid")).toBeGreaterThan(0)
      expect(semverCompare("invalid", "1.0.0")).toBeLessThan(0)
      expect(semverCompare("invalid1", "invalid2")).toBeLessThan(0)
    })

    it("should clean versions before comparison", () => {
      expect(semverCompare("v1.0.0", "1.0.0")).toBe(0)
      expect(semverCompare("1.0.0", "=1.0.0")).toBe(0)
    })
  })

  describe("getTextColorFromBackground", () => {
    it("should return white for dark backgrounds", () => {
      expect(getTextColorFromBackground("#000000")).toBe("#ffffff")
      expect(getTextColorFromBackground("#0000ff")).toBe("#ffffff")
    })

    it("should return appropriate text color for backgrounds", () => {
      const result1 = getTextColorFromBackground("#ffffff")
      const result2 = getTextColorFromBackground("#000000")

      expect(result1).toMatch(/^#[0-9a-f]{6}$/)
      expect(result2).toMatch(/^#[0-9a-f]{6}$/)
      expect(result1).not.toBe(result2)
    })

    it("should return black for invalid hex colors", () => {
      expect(getTextColorFromBackground("#invalid")).toBe("#000000")
      expect(getTextColorFromBackground("#12")).toBe("#000000")
      expect(getTextColorFromBackground("#gggggg")).toBe("#000000")
    })

    it("should use caching for repeated calls", () => {
      const result1 = getTextColorFromBackground("#000000")
      const result2 = getTextColorFromBackground("#000000")
      expect(result1).toBe(result2)
      expect(result1).toBe("#ffffff")
    })
  })

  describe("hslToHex", () => {
    it("should convert HSL to hex", () => {
      const result = hslToHex(0, 100, 50)
      expect(result).toMatch(/^#[0-9a-f]{6}$/)
    })

    it("should use caching for repeated calls", () => {
      const result1 = hslToHex(120, 50, 50)
      const result2 = hslToHex(120, 50, 50)
      expect(result1).toBe(result2)
    })
  })

  describe("getLightness", () => {
    it("should calculate lightness from hex color", () => {
      const whiteLightness = getLightness("#ffffff")
      const blackLightness = getLightness("#000000")
      const grayLightness = getLightness("#808080")

      expect(whiteLightness).toBeGreaterThan(blackLightness)
      expect(blackLightness).toBeCloseTo(0, 1)
      expect(grayLightness).toBeGreaterThan(blackLightness)
      expect(grayLightness).toBeLessThan(whiteLightness)
    })
  })

  describe("isTree and isBlob", () => {
    const mockTree: GitTreeObject = {
      type: "tree",
      name: "dir",
      path: "dir",
      children: [],
      hash: "abc123"
    }

    const mockBlob: GitBlobObject = {
      type: "blob",
      name: "file.txt",
      path: "file.txt",
      sizeInBytes: 100,
      hash: "def456"
    }

    it("isTree should return true for tree objects", () => {
      expect(isTree(mockTree)).toBe(true)
      expect(isTree(mockBlob)).toBe(false)
      expect(isTree(null)).toBe(false)
      expect(isTree(undefined)).toBe(false)
    })

    it("isBlob should return true for blob objects", () => {
      expect(isBlob(mockBlob)).toBe(true)
      expect(isBlob(mockTree)).toBe(false)
      expect(isBlob(null)).toBe(false)
      expect(isBlob(undefined)).toBe(false)
    })
  })
})
