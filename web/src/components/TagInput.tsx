import { useState, useRef, useEffect } from 'react';
import type { Tag } from '../types/labels';
import { logger } from '../services/logger';

interface TagInputProps {
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  tags: Tag[];
  onCreateTag?: (name: string) => Promise<Tag | null>;
}

export function TagInput({
  selectedTagIds,
  onToggleTag,
  tags,
  onCreateTag,
}: TagInputProps) {
  const [tagSearch, setTagSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter tags based on search
  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(tagSearch.toLowerCase()) &&
    !selectedTagIds.includes(tag.id)
  );

  const showCreateOption = tagSearch.trim() && 
    !tags.some(t => t.name.toLowerCase() === tagSearch.toLowerCase().trim()) &&
    onCreateTag;

  const dropdownItemCount = filteredTags.length + (showCreateOption ? 1 : 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setTagSearch('');
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateTag = async () => {
    if (!tagSearch.trim() || !onCreateTag) return;
    
    setIsCreatingTag(true);
    try {
      const newTag = await onCreateTag(tagSearch.trim());
      if (newTag) {
        onToggleTag(newTag.id);
        setTagSearch('');
        setIsDropdownOpen(false);
      }
    } catch (error) {
      logger.error('Failed to create tag:', error);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < dropdownItemCount - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : dropdownItemCount - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredTags.length) {
        onToggleTag(filteredTags[highlightedIndex].id);
        setTagSearch('');
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      } else if (highlightedIndex === filteredTags.length && showCreateOption) {
        handleCreateTag();
      } else if (highlightedIndex === -1 && tagSearch.trim()) {
        const exactMatch = filteredTags.find(
          t => t.name.toLowerCase() === tagSearch.trim().toLowerCase()
        );
        if (exactMatch) {
          onToggleTag(exactMatch.id);
          setTagSearch('');
          setIsDropdownOpen(false);
        } else if (showCreateOption) {
          handleCreateTag();
        } else if (filteredTags.length === 1) {
          onToggleTag(filteredTags[0].id);
          setTagSearch('');
          setIsDropdownOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setTagSearch('');
      setHighlightedIndex(-1);
    } else if (e.key === 'Backspace' && !tagSearch && selectedTagIds.length > 0) {
      onToggleTag(selectedTagIds[selectedTagIds.length - 1]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Tags
      </label>
      
      <div className="relative" ref={dropdownRef}>
        <div 
          className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 min-h-[42px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent cursor-text"
          onClick={() => tagInputRef.current?.focus()}
          role="combobox"
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
        >
          {/* Selected tags as tokens */}
          {selectedTagIds.map((tagId) => {
            const tag = tags.find(t => t.id === tagId);
            if (!tag) return null;
            return (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-medium rounded-full bg-blue-500 text-white"
                style={tag.color ? { backgroundColor: tag.color } : undefined}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTag(tag.id);
                  }}
                  aria-label={`Remove ${tag.name} tag`}
                  className="flex items-center justify-center w-4 h-4 ml-0.5 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            );
          })}
          
          {/* Search input */}
          <input
            ref={tagInputRef}
            type="text"
            value={tagSearch}
            onChange={(e) => {
              setTagSearch(e.target.value);
              setIsDropdownOpen(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => {
              setIsDropdownOpen(true);
              setHighlightedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedTagIds.length === 0 ? "Search or create tag..." : ""}
            aria-label="Search tags"
            className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        
        {/* Dropdown */}
        {isDropdownOpen && (filteredTags.length > 0 || showCreateOption) && (
          <div 
            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            role="listbox"
          >
            {filteredTags.map((tag, index) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  onToggleTag(tag.id);
                  setTagSearch('');
                  setIsDropdownOpen(false);
                  setHighlightedIndex(-1);
                }}
                role="option"
                aria-selected={index === highlightedIndex}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 ${
                  index === highlightedIndex 
                    ? 'bg-blue-50 dark:bg-blue-900/30' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tag.color && (
                  <span 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span className="text-gray-900 dark:text-white">{tag.name}</span>
              </button>
            ))}
            
            {showCreateOption && (
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={isCreatingTag}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 text-blue-600 dark:text-blue-400 ${
                  filteredTags.length > 0 ? 'border-t border-gray-200 dark:border-gray-600' : ''
                } ${
                  highlightedIndex === filteredTags.length 
                    ? 'bg-blue-50 dark:bg-blue-900/30' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {isCreatingTag ? 'Creating...' : `Create "${tagSearch.trim()}"`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
