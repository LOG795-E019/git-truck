// Mock console methods
const mockConsole = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  log: jest.fn()
}

global.console = mockConsole as any

const originalEnv = process.env
beforeEach(() => {
  process.env = { ...originalEnv, COLOR: "0" }
  jest.clearAllMocks()
})

afterEach(() => {
  process.env = originalEnv
})

import { LOG_LEVEL, LOG_LEVEL_LABEL, getLogLevel, setLogLevel, error, warn, info, debug, raw, log } from "./log.server"

describe("LOG_LEVEL and LOG_LEVEL_LABEL", () => {
  it("should have correct enum values", () => {
    expect(LOG_LEVEL.SILENT).toBe(0)
    expect(LOG_LEVEL.ERROR).toBe(1)
    expect(LOG_LEVEL.WARN).toBe(2)
    expect(LOG_LEVEL.INFO).toBe(3)
    expect(LOG_LEVEL.DEBUG).toBe(4)

    expect(LOG_LEVEL_LABEL.SILENT).toBe("")
    expect(LOG_LEVEL_LABEL.ERROR).toBe("ERR")
    expect(LOG_LEVEL_LABEL.WARN).toBe("WRN")
    expect(LOG_LEVEL_LABEL.INFO).toBe("NFO")
    expect(LOG_LEVEL_LABEL.DEBUG).toBe("DBG")
  })
})

describe("setLogLevel", () => {
  it("should set log level for valid string", () => {
    setLogLevel("DEBUG")
    expect(getLogLevel()).toBe(LOG_LEVEL.DEBUG)

    setLogLevel("error")
    expect(getLogLevel()).toBe(LOG_LEVEL.ERROR)

    setLogLevel("  INFO  ")
    expect(getLogLevel()).toBe(LOG_LEVEL.INFO)
  })

  it("should throw error for invalid log level", () => {
    expect(() => setLogLevel("INVALID")).toThrow("Invalid log level: INVALID")
    expect(() => setLogLevel("")).toThrow("Invalid log level: ")
  })
})

describe("logging functions", () => {
  beforeEach(() => {
    setLogLevel("DEBUG")
  })

  describe("error", () => {
    it("should log error messages", () => {
      const testError = new Error("Test error")
      error(testError)

      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining("[ERR] Test error"))
    })

    it("should handle non-Error objects", () => {
      error("String error")

      expect(mockConsole.error).toHaveBeenCalledWith("[ERR] String error")
    })
  })

  describe("warn", () => {
    it("should log warning messages", () => {
      warn("Warning message")

      expect(mockConsole.warn).toHaveBeenCalledWith("[WRN] Warning message")
    })
  })

  describe("info", () => {
    it("should log info messages", () => {
      info("Info message")

      expect(mockConsole.info).toHaveBeenCalledWith("[NFO] Info message")
    })
  })

  describe("debug", () => {
    it("should log debug messages", () => {
      debug("Debug message")

      expect(mockConsole.debug).toHaveBeenCalledWith("[DBG] Debug message")
    })
  })

  describe("raw", () => {
    it("should log raw messages without prefix", () => {
      raw("Raw message")

      expect(mockConsole.info).toHaveBeenCalledWith("Raw message")
    })
  })
})

describe("log level filtering", () => {
  it("should not log when level is below threshold", () => {
    setLogLevel("ERROR")
    warn("Warning message")
    info("Info message")
    debug("Debug message")

    expect(mockConsole.warn).not.toHaveBeenCalled()
    expect(mockConsole.info).not.toHaveBeenCalled()
    expect(mockConsole.debug).not.toHaveBeenCalled()
  })

  it("should log when level is at or above threshold", () => {
    setLogLevel("WARN")

    error(new Error("Test error"))
    warn("Warning message")
    info("Info message")

    expect(mockConsole.error).toHaveBeenCalled()
    expect(mockConsole.warn).toHaveBeenCalled()
    expect(mockConsole.info).not.toHaveBeenCalled()
  })

  it("should not log anything when SILENT", () => {
    setLogLevel("SILENT")

    error(new Error("Test error"))
    warn("Warning message")
    info("Info message")
    debug("Debug message")
    raw("Raw message")

    expect(mockConsole.error).not.toHaveBeenCalled()
    expect(mockConsole.warn).not.toHaveBeenCalled()
    expect(mockConsole.info).not.toHaveBeenCalled()
    expect(mockConsole.debug).not.toHaveBeenCalled()
    expect(mockConsole.log).not.toHaveBeenCalled()
  })
})

describe("environment variable log level", () => {
  it("should set log level from string environment variable", () => {
    process.env.LOG_LEVEL = "INFO"
    jest.resetModules()
    const { getLogLevel: getLogLevel2 } = require("./log.server")

    expect(getLogLevel2()).toBe(LOG_LEVEL.INFO)
  })

  it("should set log level from numeric environment variable", () => {
    expect(typeof LOG_LEVEL.WARN).toBe("number")
  })

  it("should default to null when no environment variable", () => {
    delete process.env.LOG_LEVEL
    jest.resetModules()
    const { getLogLevel: getLogLevel2 } = require("./log.server")

    expect(getLogLevel2()).toBeNull()
  })
})

describe("log object", () => {
  it("should export log object with all methods", () => {
    expect(log.error).toBeDefined()
    expect(log.warn).toBeDefined()
    expect(log.info).toBeDefined()
    expect(log.debug).toBeDefined()
    expect(log.raw).toBeDefined()
  })
})
