// Mock file system operations
jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}))

jest.mock("os", () => ({
  tmpdir: jest.fn().mockReturnValue("/tmp")
}))

import MetadataDB from "./MetadataDB"
import { promises as fs } from "fs"

const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>
const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>

describe("MetadataDB", () => {
  let metadataDB: MetadataDB

  beforeEach(() => {
    metadataDB = new MetadataDB()
    jest.clearAllMocks()
  })

  describe("readMetadata", () => {
    it("should return parsed metadata from file", async () => {
      const mockData = {
        completions: { "repo---branch": { hash: "abc123", time: 1234567890 } },
        authorcolors: { Alice: "#ff0000" }
      }
      mockReadFile.mockResolvedValue(JSON.stringify(mockData))

      const result = await metadataDB.readMetadata()

      expect(mockReadFile).toHaveBeenCalledWith("/tmp/git-truck-cache/metadata.json", "utf8")
      expect(result).toEqual(mockData)
    })

    it("should return default metadata when file doesn't exist", async () => {
      mockReadFile.mockRejectedValue(new Error("File not found"))

      const result = await metadataDB.readMetadata()

      expect(result).toEqual({ completions: {}, authorcolors: {} })
    })

    it("should return default metadata when JSON is invalid", async () => {
      mockReadFile.mockResolvedValue("invalid json")

      const result = await metadataDB.readMetadata()

      expect(result).toEqual({ completions: {}, authorcolors: {} })
    })
  })

  describe("setMetadata", () => {
    it("should write metadata to file", async () => {
      const metadata = {
        completions: { "repo---branch": { hash: "abc123", time: 1234567890 } },
        authorcolors: { Alice: "#ff0000" }
      }

      await metadataDB.setMetadata(metadata)

      expect(mockWriteFile).toHaveBeenCalledWith("/tmp/git-truck-cache/metadata.json", JSON.stringify(metadata), "utf8")
    })
  })

  describe("setCompletion", () => {
    it("should set completion data for repo and branch", async () => {
      const mockData = { completions: {}, authorcolors: {} }
      mockReadFile.mockResolvedValue(JSON.stringify(mockData))

      const repo = "test-repo"
      const branch = "main"
      const hash = "abc123"

      await metadataDB.setCompletion(repo, branch, hash)

      expect(mockWriteFile).toHaveBeenCalled()
      const writtenData = JSON.parse((mockWriteFile as jest.Mock).mock.calls[0][1])
      expect(writtenData.completions[`${repo}---${branch}`]).toEqual({
        hash,
        time: expect.any(Number)
      })
    })
  })

  describe("addAuthorColor", () => {
    it("should add author color", async () => {
      const mockData = { completions: {}, authorcolors: {} }
      mockReadFile.mockResolvedValue(JSON.stringify(mockData))

      await metadataDB.addAuthorColor("Alice", "#ff0000")

      expect(mockWriteFile).toHaveBeenCalled()
      const writtenData = JSON.parse((mockWriteFile as jest.Mock).mock.calls[0][1])
      expect(writtenData.authorcolors["Alice"]).toBe("#ff0000")
    })

    it("should remove author color when empty string is provided", async () => {
      const mockData = { completions: {}, authorcolors: { Alice: "#ff0000" } }
      mockReadFile.mockResolvedValue(JSON.stringify(mockData))

      await metadataDB.addAuthorColor("Alice", "")

      expect(mockWriteFile).toHaveBeenCalled()
      const writtenData = JSON.parse((mockWriteFile as jest.Mock).mock.calls[0][1])
      expect(writtenData.authorcolors["Alice"]).toBeUndefined()
    })
  })

  describe("getAuthorColors", () => {
    it("should return author colors with proper typing", async () => {
      const mockData = { completions: {}, authorcolors: { Alice: "#ff0000", Bob: "#00ff00" } }
      mockReadFile.mockResolvedValue(JSON.stringify(mockData))

      const result = await metadataDB.getAuthorColors()

      expect(result).toEqual({ Alice: "#ff0000", Bob: "#00ff00" })
    })
  })

  describe("getLastRun", () => {
    it("should return last run data for repo and branch", async () => {
      const mockData = {
        completions: { "test-repo---main": { hash: "abc123", time: 1234567890 } },
        authorcolors: {}
      }
      mockReadFile.mockResolvedValue(JSON.stringify(mockData))

      const result = await metadataDB.getLastRun("test-repo", "main")

      expect(result).toEqual({ hash: "abc123", time: 1234567890 })
    })

    it("should return undefined when no data exists", async () => {
      const mockData = { completions: {}, authorcolors: {} }
      mockReadFile.mockResolvedValue(JSON.stringify(mockData))

      const result = await metadataDB.getLastRun("test-repo", "main")

      expect(result).toBeUndefined()
    })
  })

  describe("getCompletedRepos", () => {
    it("should return list of completed repos", async () => {
      const mockData = {
        completions: {
          "repo1---main": { hash: "abc123", time: 1234567890 },
          "repo2---develop": { hash: "def456", time: 1234567891 }
        },
        authorcolors: {}
      }
      mockReadFile.mockResolvedValue(JSON.stringify(mockData))

      const result = await metadataDB.getCompletedRepos()

      expect(result).toEqual([
        { repo: "repo1", branch: "main", time: 1234567890 },
        { repo: "repo2", branch: "develop", time: 1234567891 }
      ])
    })

    it("should return empty array when no completions exist", async () => {
      const mockData = { completions: {}, authorcolors: {} }
      mockReadFile.mockResolvedValue(JSON.stringify(mockData))

      const result = await metadataDB.getCompletedRepos()

      expect(result).toEqual([])
    })
  })
})
