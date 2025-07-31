import React, { useState, useMemo } from 'react'
import { useData } from "../contexts/DataContext"
import { useOptions } from '~/contexts/OptionsContext'
import { Icon } from '@mdi/react'
import { mdiMagnify, mdiClose, mdiChevronDown, mdiRegex, mdiFileMultiple } from '@mdi/js'

export function FileSelector() {
  const { databaseInfo } = useData()
  const { selectedFilePaths, setSelectedFilePaths } = useOptions()
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchMode, setSearchMode] = useState<'individual' | 'pattern'>('individual')
  const [patternInput, setPatternInput] = useState('')

  // Get all files from the database
  const allFiles = useMemo(() => {
    if (!databaseInfo) return []
    
    const files = new Set<string>()
    
    // Extract files from authorsFilesStats
    Object.values(databaseInfo.authorsFilesStats).forEach(authorStats => {
      Object.keys(authorStats).forEach(filePath => {
        files.add(filePath)
      })
    })
    
    const fileArray = Array.from(files).sort()
    console.log('Sample files from database:', fileArray.slice(0, 10))
    console.log('File format example:', fileArray[0])
    
    return fileArray
  }, [databaseInfo])

  // Pattern matching for files (FIXED - expand braces BEFORE comma splitting)
  const getFilesFromPattern = (pattern: string): string[] => {
    if (!pattern.trim()) return []
    
    console.log('Pattern:', pattern)
    console.log('Available files sample:', allFiles.slice(0, 10))
    console.log('Total files:', allFiles.length)
    
    try {
      // FIRST: Expand brace patterns in the entire string
      const expandBraces = (pat: string): string[] => {
        const braceMatch = pat.match(/\{([^}]+)\}/)
        if (!braceMatch) return [pat]
        
        const options = braceMatch[1].split(',').map(opt => opt.trim())
        const beforeBrace = pat.substring(0, braceMatch.index!)
        const afterBrace = pat.substring(braceMatch.index! + braceMatch[0].length)
        
        // Recursively expand in case there are multiple brace patterns
        const results: string[] = []
        options.forEach(option => {
          const expanded = beforeBrace + option + afterBrace
          results.push(...expandBraces(expanded))
        })
        return results
      }
      
      // Expand braces FIRST, then split by commas
      const expandedFromBraces = expandBraces(pattern)
      
      // NOW split each expanded pattern by commas
      const allPatterns: string[] = []
      expandedFromBraces.forEach(pat => {
        allPatterns.push(...pat.split(',').map(p => p.trim()).filter(Boolean))
      })
      
      console.log('Expanded patterns:', allPatterns)
      
      const matchedFiles = new Set<string>()
      
      allPatterns.forEach(pat => {
        console.log('Processing pattern:', pat)
        
        // Convert glob pattern to regex (FIXED ORDER)
        let regexPattern = pat
          // 1. Replace ** FIRST with a placeholder to avoid conflicts
          .replace(/\*\*/g, '__DOUBLE_STAR__')
          // 2. Escape dots (but our placeholder is safe)
          .replace(/\./g, '\\.')
          // 3. Replace single * with [^/]*
          .replace(/\*/g, '[^/]*')
          // 4. Replace our placeholder with .* (matches everything)
          .replace(/__DOUBLE_STAR__/g, '.*')
        
        console.log('Regex pattern:', regexPattern)
        
        const regex = new RegExp(`^${regexPattern}$`, 'i') // Case insensitive
        
        let matches = 0
        allFiles.forEach(file => {
          if (regex.test(file)) {
            matchedFiles.add(file)
            matches++
          }
        })
        
        console.log('Matches for pattern:', pat, '=', matches)
      })
      
      const result = Array.from(matchedFiles).sort()
      console.log('Final matches:', result.slice(0, 5))
      return result
    } catch (error) {
      console.warn('Invalid pattern:', pattern, error)
      return []
    }
  }

  // Update the commonPatterns array:

  const commonPatterns = [
    { name: 'All Test Files', pattern: '**/test/**,**/*.test.*,**/*.spec.*', icon: '🧪' },
    { name: 'All TypeScript Files', pattern: '**/*.{ts,tsx}', icon: '📘' },
    { name: 'All JavaScript Files', pattern: '**/*.{js,jsx}', icon: '📙' },
    { name: 'All CSS/Style Files', pattern: '**/*.{css,scss,sass,less}', icon: '🎨' },
    { name: 'All Config Files', pattern: '**/*.{json,yaml,yml,toml,ini}', icon: '⚙️' },
    { name: 'Component Files', pattern: '**/components/**', icon: '🧩' },
    { name: 'Source Files', pattern: '**/src/**', icon: '📁' },
    { name: 'Documentation', pattern: '**/*.{md,txt,rst}', icon: '📚' }
  ]

  // Filter files based on search term (for individual mode)
  const filteredFiles = useMemo(() => {
    if (searchMode === 'pattern') return []
    return allFiles.filter(file => 
      file.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [allFiles, searchTerm, searchMode])

  const handleFileToggle = (filePath: string) => {
    if (selectedFilePaths.includes(filePath)) {
      setSelectedFilePaths(selectedFilePaths.filter(path => path !== filePath))
    } else {
      setSelectedFilePaths([...selectedFilePaths, filePath])
    }
  }

  const handleRemoveFile = (filePath: string) => {
    setSelectedFilePaths(selectedFilePaths.filter(path => path !== filePath))
  }

  const clearAllFiles = () => {
    setSelectedFilePaths([])
  }

  const handlePatternApply = () => {
    const matchedFiles = getFilesFromPattern(patternInput)
    if (matchedFiles.length > 0) {
      setSelectedFilePaths([...new Set([...selectedFilePaths, ...matchedFiles])])
      setPatternInput('')
      setIsDropdownOpen(false)
    }
  }

  const handleCommonPatternClick = (pattern: string) => {
    const matchedFiles = getFilesFromPattern(pattern)
    if (matchedFiles.length > 0) {
      setSelectedFilePaths([...new Set([...selectedFilePaths, ...matchedFiles])])
      setIsDropdownOpen(false)
    }
  }

  const previewFiles = patternInput ? getFilesFromPattern(patternInput) : []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Files</h3>
        {selectedFilePaths.length > 0 && (
          <button
            onClick={clearAllFiles}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear all ({selectedFilePaths.length})
          </button>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded p-1">
        <button
          onClick={() => setSearchMode('individual')}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            searchMode === 'individual' 
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400' 
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <Icon path={mdiFileMultiple} size={0.5} className="inline mr-1" />
          Individual Files
        </button>
        <button
          onClick={() => setSearchMode('pattern')}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            searchMode === 'pattern' 
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400' 
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <Icon path={mdiRegex} size={0.5} className="inline mr-1" />
          Pattern Matching
        </button>
      </div>

      {/* Selected files display */}
      {selectedFilePaths.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {selectedFilePaths.map(filePath => (
            <div
              key={filePath}
              className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-xs"
            >
              <span className="truncate flex-1" title={filePath}>
                {filePath.split('/').pop()}
              </span>
              <button
                onClick={() => handleRemoveFile(filePath)}
                className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <Icon path={mdiClose} size={0.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Interface */}
      <div className="relative">
        {searchMode === 'individual' ? (
          /* Individual File Search */
          <div className="relative">
            <Icon path={mdiMagnify} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={0.75} />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsDropdownOpen(true)}
              className="w-full pl-7 pr-8 py-2 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Icon path={mdiChevronDown} size={0.75} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        ) : (
          /* Pattern Input */
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter pattern (e.g., **/*.test.*, **/components/**)"
                value={patternInput}
                onChange={(e) => setPatternInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              />
              <button
                onClick={handlePatternApply}
                disabled={!patternInput.trim() || previewFiles.length === 0}
                className="px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add ({previewFiles.length})
              </button>
            </div>
            
            {/* Pattern Preview */}
            {patternInput && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {previewFiles.length > 0 ? (
                  <span>Matches {previewFiles.length} files</span>
                ) : (
                  <span>No files match this pattern</span>
                )}
              </div>
            )}
            
            {/* Common Patterns */}
            <div className="grid grid-cols-2 gap-1">
              {commonPatterns.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleCommonPatternClick(item.pattern)}
                  className="text-left px-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title={item.pattern}
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dropdown for Individual Mode */}
        {searchMode === 'individual' && isDropdownOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
            {filteredFiles.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No files found</div>
            ) : (
              filteredFiles.map(filePath => (
                <div
                  key={filePath}
                  onClick={() => handleFileToggle(filePath)}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    selectedFilePaths.includes(filePath) 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                      : ''
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedFilePaths.includes(filePath)}
                      onChange={() => {}} // Handled by parent onClick
                      className="mr-2"
                    />
                    <span className="truncate" title={filePath}>
                      {filePath}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Pattern Help */}
      {searchMode === 'pattern' && (
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div><strong>Pattern examples (click to copy):</strong></div>
          <div className="space-y-1">
            {[
              { pattern: '**/*.test.*', description: 'All test files' },
              { pattern: '**/*.{ts,tsx}', description: 'All TypeScript files' },
              { pattern: '**/components/**', description: 'All files in components folders' },
              { pattern: 'src/**/*.js,lib/**/*.js', description: 'Multiple patterns (comma-separated)' },
              { pattern: '**/*.{json,yaml,yml}', description: 'All config files' },
              { pattern: '**/src/**', description: 'All files in src directories' }
            ].map((example, index) => (
              <div key={index} className="flex items-center gap-2">
                <code 
                  className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(example.pattern)
                    setPatternInput(example.pattern)
                  }}
                  title="Click to copy and use"
                >
                  {example.pattern}
                </code>
                <span className="text-gray-400">- {example.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {isDropdownOpen && searchMode === 'individual' && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  )
}