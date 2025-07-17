// Create src/components/AuthorSelector.tsx
import React, { useState, useMemo } from 'react'
import { useData } from "../contexts/DataContext"
import { useOptions } from '~/contexts/OptionsContext'
import { Icon } from '@mdi/react'
import { mdiMagnify, mdiClose, mdiChevronDown } from '@mdi/js'

export function AuthorSelector() {
  const { databaseInfo } = useData()
  const { selectedAuthorNames, setSelectedAuthorNames } = useOptions()
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Get all authors from the database
  const allAuthors = useMemo(() => {
    return databaseInfo.authors.sort()
  }, [databaseInfo.authors])

  // Filter authors based on search term
  const filteredAuthors = useMemo(() => {
    return allAuthors.filter(author => 
      author.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [allAuthors, searchTerm])

  const handleAuthorToggle = (authorName: string) => {
    if (selectedAuthorNames.includes(authorName)) {
      setSelectedAuthorNames(selectedAuthorNames.filter(name => name !== authorName))
    } else {
      setSelectedAuthorNames([...selectedAuthorNames, authorName])
    }
  }

  const handleRemoveAuthor = (authorName: string) => {
    setSelectedAuthorNames(selectedAuthorNames.filter(name => name !== authorName))
  }

  const clearAllAuthors = () => {
    setSelectedAuthorNames([])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Authors</h3>
        {selectedAuthorNames.length > 0 && (
          <button
            onClick={clearAllAuthors}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Selected authors display */}
      {selectedAuthorNames.length > 0 && (
        <div className="space-y-1">
          {selectedAuthorNames.map(authorName => (
            <div
              key={authorName}
              className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded text-xs"
            >
              <span className="truncate flex-1" title={authorName}>
                {authorName}
              </span>
              <button
                onClick={() => handleRemoveAuthor(authorName)}
                className="ml-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
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
            placeholder="Search authors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            className="w-full pl-7 pr-8 py-2 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
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
            {filteredAuthors.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No authors found</div>
            ) : (
              filteredAuthors.map(authorName => (
                <div
                  key={authorName}
                  onClick={() => handleAuthorToggle(authorName)}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    selectedAuthorNames.includes(authorName) 
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                      : ''
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedAuthorNames.includes(authorName)}
                      onChange={() => {}} // Handled by parent onClick
                      className="mr-2"
                    />
                    <span className="truncate" title={authorName}>
                      {authorName}
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