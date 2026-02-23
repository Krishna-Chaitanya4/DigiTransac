import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import type { EmojiClickData, Theme } from 'emoji-picker-react';
import { useTheme } from '../context/ThemeContext';

// Lazy load the heavy emoji picker - only when dropdown is opened
const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface EmojiPickerInputProps {
  value: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
}

export function EmojiPickerInput({
  value,
  onChange,
  placeholder = 'Select an emoji',
  label,
  id,
}: EmojiPickerInputProps) {
  const { resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onChange(emojiData.emoji);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Accept typed/pasted emoji — extract only emoji characters
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    // Match emoji characters (including compound emojis with ZWJ, skin tones, flags, etc.)
    const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
    const emojis = text.match(emojiRegex);
    // Take only the last emoji entered (single emoji field)
    if (emojis && emojis.length > 0) {
      onChange(emojis[emojis.length - 1]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      
      {/* Trigger area */}
      <div className="flex items-center gap-1">
        <div className="flex-1 flex items-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
          <input
            type="text"
            id={id}
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 bg-transparent border-none outline-none text-2xl w-0 min-w-0 placeholder:text-base placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-2 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
            title="Pick from list"
          >
            <svg 
              className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
            title="Clear"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Emoji Picker Dropdown */}
      {isOpen && (
        <div 
          ref={pickerRef}
          className="absolute z-50 mt-1 left-0"
          style={{ maxWidth: '100vw' }}
        >
          <Suspense fallback={
            <div className="w-80 h-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          }>
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={resolvedTheme === 'dark' ? 'dark' as Theme : 'light' as Theme}
              searchPlaceHolder="Search emoji..."
              width={320}
              height={400}
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
              lazyLoadEmojis
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
