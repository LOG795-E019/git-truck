// Mock latest-version to avoid ESM issues in Jest
jest.mock("latest-version", () => ({
  default: jest.fn().mockResolvedValue("1.0.0")
}))

// Mock DB to avoid file locking issues in tests
jest.mock("./DB.server", () => {
  return jest.fn().mockImplementation(() => ({
    disconnect: jest.fn().mockResolvedValue(undefined)
  }))
})

// Mock MetadataDB to avoid file locking issues
jest.mock("./MetadataDB", () => {
  return jest.fn().mockImplementation(() => ({}))
})

import InstanceManager from "./InstanceManager.server"
import ServerInstance from "./ServerInstance.server"
import MetadataDB from "./MetadataDB"

describe("InstanceManager", () => {
  beforeEach(() => {
    // Reset the singleton state before each test
    InstanceManager["instances"] = new Map()
    InstanceManager["metadataDB"] = undefined as any
  })

  afterEach(async () => {
    // Clean up all instances
    await InstanceManager.closeAllDBConnections()
  })

  describe("getOrCreateMetadataDB", () => {
    it("should create a new MetadataDB on first call", () => {
      const db = InstanceManager.getOrCreateMetadataDB()

      expect(db).toBeDefined()
      expect(db).toBeTruthy()
    })

    it("should return the same MetadataDB instance on subsequent calls", () => {
      const db1 = InstanceManager.getOrCreateMetadataDB()
      const db2 = InstanceManager.getOrCreateMetadataDB()

      expect(db1).toBe(db2)
    })
  })

  describe("getOrCreateInstance", () => {
    it("should create a new ServerInstance for a repo and branch", () => {
      const instance = InstanceManager.getOrCreateInstance("test-repo", "main", "/fake/path")

      expect(instance).toBeInstanceOf(ServerInstance)
      expect(instance.repo).toBe("test-repo")
      expect(instance.branch).toBe("main")
      expect(instance.path).toBe("/fake/path")
    })

    it("should return the same instance for the same repo and branch", () => {
      const instance1 = InstanceManager.getOrCreateInstance("test-repo", "main", "/fake/path")
      const instance2 = InstanceManager.getOrCreateInstance("test-repo", "main", "/fake/path")

      expect(instance1).toBe(instance2)
    })

    it("should create different instances for different branches", () => {
      const mainInstance = InstanceManager.getOrCreateInstance("test-repo", "main", "/fake/path")
      const devInstance = InstanceManager.getOrCreateInstance("test-repo", "develop", "/fake/path")

      expect(mainInstance).not.toBe(devInstance)
      expect(mainInstance.branch).toBe("main")
      expect(devInstance.branch).toBe("develop")
    })

    it("should create different instances for different repos", () => {
      const repo1Instance = InstanceManager.getOrCreateInstance("repo1", "main", "/fake/path1")
      const repo2Instance = InstanceManager.getOrCreateInstance("repo2", "main", "/fake/path2")

      expect(repo1Instance).not.toBe(repo2Instance)
      expect(repo1Instance.repo).toBe("repo1")
      expect(repo2Instance.repo).toBe("repo2")
    })

    it("should handle multiple repos with multiple branches", () => {
      const repo1Main = InstanceManager.getOrCreateInstance("repo1", "main", "/fake/path1")
      const repo1Dev = InstanceManager.getOrCreateInstance("repo1", "develop", "/fake/path1")
      const repo2Main = InstanceManager.getOrCreateInstance("repo2", "main", "/fake/path2")
      const repo2Dev = InstanceManager.getOrCreateInstance("repo2", "develop", "/fake/path2")

      // All instances should be different
      expect(repo1Main).not.toBe(repo1Dev)
      expect(repo1Main).not.toBe(repo2Main)
      expect(repo1Main).not.toBe(repo2Dev)
      expect(repo1Dev).not.toBe(repo2Main)
      expect(repo1Dev).not.toBe(repo2Dev)
      expect(repo2Main).not.toBe(repo2Dev)

      // But getting the same repo/branch should return same instance
      expect(InstanceManager.getOrCreateInstance("repo1", "main", "/fake/path1")).toBe(repo1Main)
      expect(InstanceManager.getOrCreateInstance("repo2", "develop", "/fake/path2")).toBe(repo2Dev)
    })
  })

  describe("getInstance", () => {
    it("should return undefined for non-existent instance", () => {
      const instance = InstanceManager.getInstance("non-existent", "main")

      expect(instance).toBeUndefined()
    })

    it("should return existing instance", () => {
      const created = InstanceManager.getOrCreateInstance("test-repo", "main", "/fake/path")
      const retrieved = InstanceManager.getInstance("test-repo", "main")

      expect(retrieved).toBe(created)
    })

    it("should return undefined for existing repo but different branch", () => {
      InstanceManager.getOrCreateInstance("test-repo", "main", "/fake/path")
      const retrieved = InstanceManager.getInstance("test-repo", "develop")

      expect(retrieved).toBeUndefined()
    })
  })

  describe("closeAllDBConnections", () => {
    it("should disconnect all instances", async () => {
      const instance1 = InstanceManager.getOrCreateInstance("repo1", "main", "/fake/path1")
      const instance2 = InstanceManager.getOrCreateInstance("repo2", "main", "/fake/path2")

      // Mock the disconnect method
      const disconnectSpy1 = jest.spyOn(instance1.db, "disconnect").mockResolvedValue()
      const disconnectSpy2 = jest.spyOn(instance2.db, "disconnect").mockResolvedValue()

      await InstanceManager.closeAllDBConnections()

      expect(disconnectSpy1).toHaveBeenCalledTimes(1)
      expect(disconnectSpy2).toHaveBeenCalledTimes(1)
    })

    it("should clear the instances map after closing connections", async () => {
      InstanceManager.getOrCreateInstance("repo1", "main", "/fake/path1")
      InstanceManager.getOrCreateInstance("repo2", "main", "/fake/path2")

      await InstanceManager.closeAllDBConnections()

      // After closing, getInstance should return undefined
      expect(InstanceManager.getInstance("repo1", "main")).toBeUndefined()
      expect(InstanceManager.getInstance("repo2", "main")).toBeUndefined()
    })

    it("should handle empty instances map gracefully", async () => {
      // Should not throw even if there are no instances
      await expect(InstanceManager.closeAllDBConnections()).resolves.not.toThrow()
    })

    it("should disconnect instances from multiple branches", async () => {
      const instance1 = InstanceManager.getOrCreateInstance("repo1", "main", "/fake/path1")
      const instance2 = InstanceManager.getOrCreateInstance("repo1", "develop", "/fake/path1")

      const disconnectSpy1 = jest.spyOn(instance1.db, "disconnect").mockResolvedValue()
      const disconnectSpy2 = jest.spyOn(instance2.db, "disconnect").mockResolvedValue()

      await InstanceManager.closeAllDBConnections()

      expect(disconnectSpy1).toHaveBeenCalledTimes(1)
      expect(disconnectSpy2).toHaveBeenCalledTimes(1)
    })
  })
})
