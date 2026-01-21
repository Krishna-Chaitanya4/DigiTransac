import { useState, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';

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

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      {/* Trigger area */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          id={id}
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
            bg-white text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span className={value ? 'text-2xl' : 'text-gray-400'}>
            {value || placeholder}
          </span>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-300"
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
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.LIGHT}
            searchPlaceHolder="Search emoji..."
            width={320}
            height={400}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
            lazyLoadEmojis
          />
        </div>
      )}
    </div>
  );
}
