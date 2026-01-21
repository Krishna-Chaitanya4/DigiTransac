import { useState, useRef, useEffect } from 'react';
import type { TransactionLocationRequest } from '../types/transactions';
import { getCurrentPosition, reverseGeocode, searchPlaces, type PlaceSearchResult } from '../services/locationService';
import { logger } from '../services/logger';

interface LocationPickerProps {
  location: TransactionLocationRequest | null;
  onChange: (location: TransactionLocationRequest | null) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export function LocationPicker({ location, onChange, onLoadingChange }: LocationPickerProps) {
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [manualLocationMode, setManualLocationMode] = useState(false);
  const [manualPlaceName, setManualPlaceName] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [highlightedPlaceIndex, setHighlightedPlaceIndex] = useState(-1);
  const placeSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placeInputRef = useRef<HTMLInputElement>(null);
  const placeDropdownRef = useRef<HTMLDivElement>(null);

  // Debounced place search
  useEffect(() => {
    if (placeSearchTimeoutRef.current) {
      clearTimeout(placeSearchTimeoutRef.current);
    }

    if (manualPlaceName.trim().length < 2) {
      setPlaceSearchResults([]);
      setHighlightedPlaceIndex(-1);
      return;
    }

    placeSearchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const results = await searchPlaces(manualPlaceName.trim());
        setPlaceSearchResults(results);
        setHighlightedPlaceIndex(-1);
      } catch (error) {
        logger.error('Place search failed:', error);
        setPlaceSearchResults([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 300);

    return () => {
      if (placeSearchTimeoutRef.current) {
        clearTimeout(placeSearchTimeoutRef.current);
      }
    };
  }, [manualPlaceName]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (placeDropdownRef.current && !placeDropdownRef.current.contains(event.target as Node)) {
        setPlaceSearchResults([]);
        setHighlightedPlaceIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setLoading = (loading: boolean) => {
    setIsLoadingLocation(loading);
    onLoadingChange?.(loading);
  };

  const captureLocation = async () => {
    setLoading(true);
    try {
      const coords = await getCurrentPosition();
      if (coords) {
        const geoInfo = await reverseGeocode(coords);
        onChange({
          latitude: coords.latitude,
          longitude: coords.longitude,
          placeName: geoInfo?.city || undefined,
          city: geoInfo?.city,
          country: geoInfo?.country,
        });
      }
    } catch (error) {
      logger.error('Failed to capture location:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectPlace = (place: PlaceSearchResult) => {
    onChange({
      latitude: place.latitude,
      longitude: place.longitude,
      placeName: place.city || place.displayName.split(',')[0],
      city: place.city,
      country: place.country,
    });
    setManualLocationMode(false);
    setManualPlaceName('');
    setPlaceSearchResults([]);
    setHighlightedPlaceIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedPlaceIndex(prev => 
        prev < placeSearchResults.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedPlaceIndex(prev => 
        prev > 0 ? prev - 1 : placeSearchResults.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedPlaceIndex >= 0 && placeSearchResults[highlightedPlaceIndex]) {
        selectPlace(placeSearchResults[highlightedPlaceIndex]);
      } else if (placeSearchResults.length === 1) {
        selectPlace(placeSearchResults[0]);
      } else if (manualPlaceName.trim() && placeSearchResults.length === 0) {
        // Allow manual entry if no results
        const parts = manualPlaceName.split(',').map(p => p.trim());
        onChange({
          latitude: 0,
          longitude: 0,
          placeName: manualPlaceName.trim(),
          city: parts[0] || undefined,
          country: parts[1] || undefined,
        });
        setManualLocationMode(false);
        setManualPlaceName('');
      }
    } else if (e.key === 'Escape') {
      setManualLocationMode(false);
      setManualPlaceName('');
      setPlaceSearchResults([]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Location
        </label>
        {!location && !isLoadingLocation && !manualLocationMode && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setManualLocationMode(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              aria-label="Enter location manually"
            >
              ✏️ Enter manually
            </button>
            <button
              type="button"
              onClick={captureLocation}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              aria-label="Use current location"
            >
              📍 Use current
            </button>
          </div>
        )}
      </div>
      
      {/* Loading state */}
      {isLoadingLocation && !location && (
        <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" aria-hidden="true"></div>
          <span className="text-sm text-gray-600 dark:text-gray-300">Getting location...</span>
        </div>
      )}
      
      {/* Manual entry mode with autocomplete */}
      {manualLocationMode && !location && (
        <div className="mt-1 relative" ref={placeDropdownRef}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={placeInputRef}
                type="text"
                value={manualPlaceName}
                onChange={(e) => setManualPlaceName(e.target.value)}
                placeholder="Search for a place..."
                aria-label="Search for a place"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {isSearchingPlaces && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" aria-hidden="true"></div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setManualLocationMode(false);
                setManualPlaceName('');
                setPlaceSearchResults([]);
              }}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
          
          {/* Autocomplete dropdown */}
          {placeSearchResults.length > 0 && (
            <div 
              className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              role="listbox"
            >
              {placeSearchResults.map((place, index) => (
                <button
                  key={place.placeId}
                  type="button"
                  onClick={() => selectPlace(place)}
                  role="option"
                  aria-selected={index === highlightedPlaceIndex}
                  className={`w-full px-3 py-2 text-left text-sm ${
                    index === highlightedPlaceIndex 
                      ? 'bg-blue-50 dark:bg-blue-900/30' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5" aria-hidden="true">📍</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-900 dark:text-white truncate">
                        {place.city || place.displayName.split(',')[0]}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {place.displayName}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* No results hint */}
          {manualPlaceName.trim().length >= 2 && !isSearchingPlaces && placeSearchResults.length === 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              No places found. Press Enter to add "{manualPlaceName.trim()}" manually.
            </p>
          )}
        </div>
      )}
      
      {/* Location display */}
      {location && (
        <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            📍 {location.city || location.placeName || 'Location captured'}
            {location.country && `, ${location.country}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const currentPlace = location.city 
                  ? (location.country ? `${location.city}, ${location.country}` : location.city)
                  : location.placeName || '';
                setManualPlaceName(currentPlace);
                onChange(null);
                setManualLocationMode(true);
              }}
              className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
              title="Edit location"
              aria-label="Edit location"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
              title="Remove location"
              aria-label="Remove location"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
