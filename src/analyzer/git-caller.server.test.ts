// Mock latest-version to avoid ESM issues in Jest
jest.mock("latest-version", () => ({
  default: jest.fn().mockResolvedValue("1.0.0")
}))

import { GitCaller } from "./git-caller.server"

describe("GitCaller.parseRefs", () => {
  it("should parse standard branch refs", () => {
    const input = `abc123 refs/heads/main
def456 refs/heads/feature/new-feature
789ghi refs/heads/bugfix/fix-123`

    const result = GitCaller.parseRefs(input)

    expect(result.Branches).toEqual({
      main: "abc123",
      "feature/new-feature": "def456",
      "bugfix/fix-123": "789ghi"
    })
    expect(result.Tags).toEqual({})
  })

  it("should parse tag refs", () => {
    const input = `abc123 refs/tags/v1.0.0
def456 refs/tags/v2.0.0
789ghi refs/tags/v1.5.0`

    const result = GitCaller.parseRefs(input)

    expect(result.Tags).toEqual({
      "v1.0.0": "abc123",
      "v2.0.0": "def456",
      "v1.5.0": "789ghi"
    })
    expect(result.Branches).toEqual({})
  })

  it("should ignore remote refs", () => {
    const input = `abc123 refs/heads/main
def456 refs/remotes/origin/main
789ghi refs/remotes/origin/feature`

    const result = GitCaller.parseRefs(input)

    expect(result.Branches).toEqual({
      main: "abc123"
    })
    expect(result.Tags).toEqual({})
  })

  it("should parse mixed branches and tags", () => {
    const input = `abc123 refs/heads/main
def456 refs/tags/v1.0.0
789ghi refs/heads/develop
jkl012 refs/tags/v2.0.0`

    const result = GitCaller.parseRefs(input)

    expect(result.Branches.main).toBe("abc123")
    expect(result.Branches.develop).toBe("789ghi")
    expect(result.Tags["v1.0.0"]).toBe("def456")
    expect(result.Tags["v2.0.0"]).toBe("jkl012")
  })

  it("should handle empty input", () => {
    const result = GitCaller.parseRefs("")

    expect(result.Branches).toEqual({})
    expect(result.Tags).toEqual({})
  })

  it("should handle refs with special characters in names", () => {
    const input = `abc123 refs/heads/feature/add-new-feature_v2
def456 refs/tags/v1.0.0-alpha
789ghi refs/heads/hotfix/bug-#123`

    const result = GitCaller.parseRefs(input)

    expect(result.Branches["feature/add-new-feature_v2"]).toBe("abc123")
    expect(result.Branches["hotfix/bug-#123"]).toBe("789ghi")
    expect(result.Tags["v1.0.0-alpha"]).toBe("def456")
  })

  it("should handle malformed lines gracefully", () => {
    const input = `abc123 refs/heads/main
invalid line without proper format
def456 refs/tags/v1.0.0
another invalid line`

    const result = GitCaller.parseRefs(input)

    expect(result.Branches).toEqual({ main: "abc123" })
    expect(result.Tags).toEqual({ "v1.0.0": "def456" })
  })

  it("should sort branches with main/master first", () => {
    const input = `abc123 refs/heads/feature
def456 refs/heads/main
789ghi refs/heads/bugfix
jkl012 refs/heads/develop`

    const result = GitCaller.parseRefs(input)

    const branchNames = Object.keys(result.Branches)
    expect(branchNames[0]).toBe("main")
  })

  it("should sort tags by semver in descending order", () => {
    const input = `abc123 refs/tags/v1.0.0
def456 refs/tags/v2.1.0
789ghi refs/tags/v1.5.0
jkl012 refs/tags/v2.0.0`

    const result = GitCaller.parseRefs(input)

    const tagNames = Object.keys(result.Tags)
    expect(tagNames[0]).toBe("v2.1.0")
    expect(tagNames[tagNames.length - 1]).toBe("v1.0.0")
  })

  it("should handle refs with long hash values", () => {
    const longHash = "1234567890abcdef1234567890abcdef12345678"
    const input = `${longHash} refs/heads/main`

    const result = GitCaller.parseRefs(input)

    expect(result.Branches.main).toBe(longHash)
  })

  it("should handle multiple refs pointing to same hash", () => {
    const input = `abc123 refs/heads/main
abc123 refs/heads/stable
abc123 refs/tags/v1.0.0`

    const result = GitCaller.parseRefs(input)

    expect(result.Branches.main).toBe("abc123")
    expect(result.Branches.stable).toBe("abc123")
    expect(result.Tags["v1.0.0"]).toBe("abc123")
  })

  it("should handle refs with trailing/leading whitespace", () => {
    const input = `  abc123 refs/heads/main
  def456 refs/tags/v1.0.0  `

    const result = GitCaller.parseRefs(input)

    expect(result.Branches).toBeDefined()
    expect(result.Tags).toBeDefined()
  })

  it("should ignore unknown ref types", () => {
    const input = `abc123 refs/heads/main
def456 refs/unknown/something
789ghi refs/tags/v1.0.0`

    const result = GitCaller.parseRefs(input)

    expect(result.Branches).toEqual({ main: "abc123" })
    expect(result.Tags).toEqual({ "v1.0.0": "789ghi" })
  })
})
