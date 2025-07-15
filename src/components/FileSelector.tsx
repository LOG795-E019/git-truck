import React, { useState, useMemo } from 'react'
import { useData } from "../contexts/DataContext"
import { useOptions } from '~/contexts/OptionsContext'
import { Icon } from '@mdi/react'
import { mdiMagnify, mdiClose, mdiChevronDown } from '@mdi/js'

export function FileSelector() {
  const { databaseInfo } = useData()
  const { selectedFilePaths, setSelectedFilePaths } = useOptions()
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

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
    
    return Array.from(files).sort()
  }, [databaseInfo])

  // Filter files based on search term
  const filteredFiles = useMemo(() => {
    return allFiles.filter(file => 
      file.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [allFiles, searchTerm])

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Files</h3>
        {selectedFilePaths.length > 0 && (
          <button
            onClick={clearAllFiles}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Selected files display */}
      {selectedFilePaths.length > 0 && (
        <div className="space-y-1">
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

      {/* Search and dropdown */}
      <div className="relative">
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

        {/* Dropdown */}
        {isDropdownOpen && (
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

      {/* Click outside to close dropdown */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  )
}