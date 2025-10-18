import path from "path"

// Mock latest-version to avoid ESM issues in Jest
jest.mock("latest-version", () => ({
  default: jest.fn().mockResolvedValue("1.0.0")
}))

import ServerInstance from "../../analyzer/ServerInstance.server"
import { GitCaller } from "../../analyzer/git-caller.server"
import InstanceManager from "../../analyzer/InstanceManager.server"

describe("Git repository analysis integration tests", () => {
  afterAll(async () => {
    // Clean up all database connections
    await InstanceManager.closeAllDBConnections()
  })

  describe("analyze git-truck itself", () => {
    const repoPath = path.resolve(__dirname, "../../../")
    let instance: ServerInstance

    beforeAll(async () => {
      const isRepo = await GitCaller.isGitRepo(repoPath)
      if (!isRepo) {
        throw new Error("git-truck repository not found - this test analyzes the project itself")
      }

      const branch = await GitCaller._getRepositoryHead(repoPath)
      instance = InstanceManager.getOrCreateInstance("git-truck", branch, repoPath)
      await instance.loadRepoData()
      await instance.updateRenames()
      await instance.db.updateCachedResult()
    }, 60000)

    it("should load commit data from git-truck repository", async () => {
      const commitCount = await instance.db.getCommitCount()
      expect(commitCount).toBeGreaterThan(0)
    })

    it("should extract authors from git-truck repository", async () => {
      const authors = await instance.db.getAuthors()
      expect(authors.length).toBeGreaterThan(0)
      expect(Array.isArray(authors)).toBe(true)
    })

    it("should build file tree from git-truck repository", async () => {
      const { rootTree, fileCount } = await instance.analyzeTree()
      expect(rootTree).toBeDefined()
      expect(rootTree.type).toBe("tree")
      expect(rootTree.name).toBe("git-truck")
      expect(fileCount).toBeGreaterThan(0)
    })

    it("should calculate commit counts per file", async () => {
      const commitCounts = await instance.db.getCommitCountPerFile()
      expect(Object.keys(commitCounts).length).toBeGreaterThan(0)

      // Verify all counts are positive integers
      Object.values(commitCounts).forEach((count) => {
        expect(count).toBeGreaterThan(0)
        expect(Number.isInteger(count)).toBe(true)
      })
    })

    it("should calculate dominant author per file", async () => {
      const dominantAuthors = await instance.db.getDominantAuthorPerFile()
      expect(Object.keys(dominantAuthors).length).toBeGreaterThan(0)

      // Verify structure
      Object.values(dominantAuthors).forEach((data) => {
        expect(data.author).toBeDefined()
        expect(typeof data.author).toBe("string")
        expect(data.contribcount).toBeGreaterThan(0)
      })
    })

    it("should get time range from commits", async () => {
      const timeRange = await instance.db.getOverallTimeRange()
      expect(timeRange).toHaveLength(2)
      expect(timeRange[0]).toBeLessThan(timeRange[1])
      expect(timeRange[0]).toBeGreaterThan(0)
    })

    it("should calculate author statistics", async () => {
      const authorStats = await instance.db.getAuthorsTotalStats()
      expect(Object.keys(authorStats).length).toBeGreaterThan(0)

      Object.values(authorStats).forEach((stats) => {
        expect(stats.nb_commits).toBeGreaterThan(0)
        expect(stats.nb_line_change).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
