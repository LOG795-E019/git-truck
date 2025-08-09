import React, { useState, useMemo } from 'react'
import { useData } from "../contexts/DataContext"
import { useOptions } from '~/contexts/OptionsContext'
import type { FileGroup } from '~/contexts/OptionsContext'
import { Icon } from '@mdi/react'
import { mdiMagnify, mdiClose, mdiChevronDown, mdiRegex, mdiFileMultiple } from '@mdi/js'

export function FileSelector() {
  const { databaseInfo } = useData()
  const { 
    fileGroups = [], 
    setFileGroups, 
    selectedFilePaths = [], 
    setSelectedFilePaths,
    fileAuthorMode,
    setFileAuthorMode 
  } = useOptions()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [patternInput, setPatternInput] = useState('')
  const [groupName, setGroupName] = useState('')

  // Get all files from the database
  const allFiles = useMemo(() => {
    if (!databaseInfo?.authorsFilesStats) return []
    
    const files = new Set<string>()
    Object.values(databaseInfo.authorsFilesStats).forEach(authorStats => {
      if (authorStats && typeof authorStats === 'object') {
        Object.keys(authorStats).forEach(filePath => {
          if (filePath && typeof filePath === 'string') {
            files.add(filePath)
          }
        })
      }
    })
    
    return Array.from(files).sort()
  }, [databaseInfo])

  // Handle mode switching with cleanup
  const handleModeSwitch = (newMode: 'groups' | 'individual') => {
    if (newMode !== fileAuthorMode) {
      // Clear the data from the previous mode
      if (fileAuthorMode === 'groups') {
        setFileGroups([]) // Clear groups when switching to individual
      } else {
        setSelectedFilePaths([]) // Clear individual selections when switching to groups
      }
      
      setFileAuthorMode(newMode)
      setIsDropdownOpen(false)
    }
  }

  // Pattern matching function with proper error handling
  const getFilesFromPattern = (pattern: string): string[] => {
    if (!pattern?.trim()) return []
    
    try {
      // Expand brace patterns first
      const expandBraces = (pat: string): string[] => {
        const braceMatch = pat.match(/\{([^}]+)\}/)
        if (!braceMatch) return [pat]
        
        const options = braceMatch[1].split(',').map(opt => opt.trim())
        const beforeBrace = pat.substring(0, braceMatch.index!)
        const afterBrace = pat.substring(braceMatch.index! + braceMatch[0].length)
        
        const results: string[] = []
        options.forEach(option => {
          const expanded = beforeBrace + option + afterBrace
          results.push(...expandBraces(expanded))
        })
        return results
      }
      
      const expandedFromBraces = expandBraces(pattern)
      
      // Split by commas and process each pattern
      const allPatterns: string[] = []
      expandedFromBraces.forEach(pat => {
        allPatterns.push(...pat.split(',').map(p => p.trim()).filter(Boolean))
      })
      
      const matchedFiles = new Set<string>()
      
      allPatterns.forEach(pat => {
        // Convert glob pattern to regex
        let regexPattern = pat
          .replace(/\*\*/g, '__DOUBLE_STAR__')
          .replace(/\./g, '\\.')
          .replace(/\*/g, '[^/]*')
          .replace(/__DOUBLE_STAR__/g, '.*')
        
        const regex = new RegExp(`^${regexPattern}$`, 'i')
        
        allFiles.forEach(file => {
          if (regex.test(file)) {
            matchedFiles.add(file)
          }
        })
      })
      
      return Array.from(matchedFiles).sort()
    } catch (error) {
      console.warn('Invalid pattern:', pattern, error)
      return []
    }
  }

  // Create group handler with proper validation
  const handleCreateGroup = () => {
    const matchedFiles = getFilesFromPattern(patternInput)
    if (matchedFiles.length > 0 && groupName.trim()) {
      const newGroup: FileGroup = {
        id: Date.now().toString(),
        name: groupName.trim(),
        pattern: patternInput,
        filePaths: matchedFiles
      }
      
      setFileGroups([...fileGroups, newGroup])
      
      // Clear inputs
      setPatternInput('')
      setGroupName('')
      setIsDropdownOpen(false)
    }
  }

  // Handle individual file selection
  const handleFileSelect = (filePath: string) => {
    const isSelected = selectedFilePaths.includes(filePath)
    if (isSelected) {
      setSelectedFilePaths(selectedFilePaths.filter(path => path !== filePath))
    } else {
      setSelectedFilePaths([...selectedFilePaths, filePath])
    }
  }

  // Individual file search with safe filtering
  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return allFiles.slice(0, 100)
    
    return allFiles
      .filter(file => file.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 100)
  }, [allFiles, searchTerm])

  // Preview files with error handling
  const previewFiles = useMemo(() => {
    if (!patternInput.trim()) return []
    return getFilesFromPattern(patternInput)
  }, [patternInput, allFiles])

  const commonPatterns = [
    { name: 'Test Files', pattern: '**/*.{test.*,spec.*}', icon: '🧪' },
    { name: 'TypeScript/JavaScript', pattern: '**/*.{ts,tsx,js,jsx}', icon: '📘' },
    { name: 'Stylesheets', pattern: '**/*.{css,scss,sass,less,styl}', icon: '🎨' },
    { name: 'Config Files', pattern: '**/*.{json,yaml,yml,toml,ini}', icon: '⚙️' },
    { name: 'Source Code', pattern: '**/src/**', icon: '📁' },
    { name: 'Components', pattern: '**/components/**,**/ui/**', icon: '🧩' },
    { name: 'Documentation', pattern: '**/docs/**,**/*.{md,txt,rst}', icon: '📚' },
    { name: 'Backend Languages', pattern: '**/*.{py,rb,go,rs,java,kt}', icon: '⚡' },
    { name: 'Database Files', pattern: '**/migrations/**,**/schema/**', icon: '🗄️' },
    { name: 'Static Assets', pattern: '**/assets/**,**/static/**,**/*.{png,jpg,svg,ico}', icon: '🖼️' },
    { name: 'Build Output', pattern: '**/build/**,**/dist/**,**/target/**', icon: '📦' },
    { name: 'Docker Files', pattern: '**/{Dockerfile,docker-compose.*,*.dockerfile}', icon: '🐳' }
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">File Author Analysis</h3>
        {/* Show appropriate clear button based on mode */}
        {fileAuthorMode === 'groups' && fileGroups.length > 0 && (
          <button
            onClick={() => setFileGroups([])}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear all groups ({fileGroups.length})
          </button>
        )}
        {fileAuthorMode === 'individual' && selectedFilePaths.length > 0 && (
          <button
            onClick={() => setSelectedFilePaths([])}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear selection ({selectedFilePaths.length})
          </button>
        )}
      </div>

      {/* Show active items for current mode */}
      {fileAuthorMode === 'groups' && fileGroups.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Active Groups ({fileGroups.length})
          </div>
          {fileGroups.map(group => (
            <div
              key={group.id}
              className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 px-2 py-2 rounded text-xs"
            >
              <div className="flex-1">
                <div className="font-medium text-green-700 dark:text-green-300">
                  {group.name}
                </div>
                <div className="text-green-600 dark:text-green-400 text-xs">
                  {group.filePaths.length} files • {group.pattern}
                </div>
              </div>
              <button
                onClick={() => setFileGroups(fileGroups.filter(g => g.id !== group.id))}
                className="ml-2 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
              >
                <Icon path={mdiClose} size={0.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {fileAuthorMode === 'individual' && selectedFilePaths.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Selected Files ({selectedFilePaths.length})
          </div>
          <div className="space-y-1">
            {selectedFilePaths.map(filePath => (
              <div
                key={filePath}
                className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-xs"
              >
                <span className="flex-1 truncate text-blue-700 dark:text-blue-300">
                  {filePath}
                </span>
                <button
                  onClick={() => handleFileSelect(filePath)}
                  className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                >
                  <Icon path={mdiClose} size={0.4} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded p-1">
        <button
          onClick={() => handleModeSwitch('individual')}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            fileAuthorMode === 'individual' 
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400' 
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <Icon path={mdiFileMultiple} size={0.5} className="inline mr-1" />
          Individual Files
        </button>
        <button
          onClick={() => handleModeSwitch('groups')}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            fileAuthorMode === 'groups' 
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400' 
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          <Icon path={mdiRegex} size={0.5} className="inline mr-1" />
          Pattern Groups
        </button>
      </div>

      {/* Content based on mode */}
      <div className="relative">
        {fileAuthorMode === 'individual' ? (
          /* Individual File Search */
          <div className="relative">
            <Icon path={mdiMagnify} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={0.75} />
            <input
              type="text"
              placeholder="Search files to add to analysis..."
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
          /* Pattern Input for Groups - same as before */
          <div className="space-y-2 border rounded p-3 bg-gray-50 dark:bg-gray-800">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Create New Group
            </div>
            
            {/* Group Name Input */}
            <input
              type="text"
              placeholder="Group name (e.g., 'Frontend Files', 'Test & Config')"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            
            {/* Pattern Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Pattern (e.g., **/*.{test.*,ts,tsx,json})"
                value={patternInput}
                onChange={(e) => setPatternInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button
                onClick={handleCreateGroup}
                disabled={!patternInput.trim() || !groupName.trim() || previewFiles.length === 0}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create Group
              </button>
            </div>
            
            {/* Pattern Preview */}
            {patternInput && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {previewFiles.length > 0 ? (
                  <span className="text-green-600">✓ Matches {previewFiles.length} files</span>
                ) : (
                  <span className="text-red-600">✗ No files match this pattern</span>
                )}
              </div>
            )}
            
            {/* Common Patterns for quick use */}
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
              {commonPatterns.map((pattern, index) => (
                <button
                  key={index}
                  onClick={() => setPatternInput(pattern.pattern)}
                  className="text-left px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title={pattern.pattern}
                >
                  {pattern.icon} {pattern.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dropdown for Individual Mode */}
      {fileAuthorMode === 'individual' && isDropdownOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">No files found</div>
          ) : (
            filteredFiles.map(filePath => {
              const isSelected = selectedFilePaths.includes(filePath)
              return (
                <div
                  key={filePath}
                  onClick={() => {
                    handleFileSelect(filePath)
                    setSearchTerm('')
                  }}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : ''
                  }`}
                >
                  <span className="flex-1 truncate">{filePath}</span>
                  {isSelected && (
                    <Icon path={mdiClose} size={0.4} className="ml-2 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Help text based on mode */}
      {fileAuthorMode === 'individual' ? (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <div><strong>Individual mode:</strong> Select specific files to see their individual author bubbles</div>
        </div>
      ) : (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <div><strong>Pattern mode:</strong> Create groups that aggregate author contributions across multiple files</div>
          <div className="mt-1 space-y-0.5">
            <div><strong>Example patterns:</strong></div>
            <div><code>**/*.&#123;test.*,spec.*&#125;</code> - All test files</div>
            <div><code>**/*.&#123;ts,tsx,js,jsx&#125;</code> - All TypeScript and JavaScript files</div>
            <div><code>**/*.&#123;css,scss,sass,less,styl&#125;</code> - All stylesheet files</div>
            <div><code>**/*.&#123;json,yaml,yml,toml,ini&#125;</code> - All config files</div>
            <div><code>**/src/**</code> - All source files</div>
            <div><code>**/components/**,**/ui/**</code> - All component files</div>
            <div><code>**/docs/**,**/*.&#123;md,txt,rst&#125;</code> - All documentation</div>
            <div><code>**/*.&#123;py,rb,go,rs,java,kt&#125;</code> - Backend language files</div>
            <div><code>**/migrations/**,**/schema/**</code> - Database files</div>
            <div><code>**/assets/**,**/static/**</code> - Static asset files</div>
            <div><code>**/build/**,**/dist/**,**/target/**</code> - Build output files</div>
            <div><code>**/&#123;Dockerfile,docker-compose.*,*.dockerfile&#125;</code> - Docker files</div>
          </div>
        </div>
      )}

      {/* Click outside handler */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  )
}