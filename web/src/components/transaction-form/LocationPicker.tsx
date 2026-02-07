import { useState, useRef, useEffect } from 'react';
import type { TransactionLocationRequest } from '../../types/transactions';
import { getCurrentPosition, reverseGeocode, searchPlaces, checkLocationPermission, isGeolocationSupported, type PlaceSearchResult } from '../../services/locationService';
import { logger } from '../../services/logger';

interface LocationPickerProps {
  location: TransactionLocationRequest | null;
  onChange: (location: TransactionLocationRequest | null, includeLocation: boolean) => void;
  isLoading?: boolean;
  autoCapture?: boolean;  // Auto-capture location on mount
}

export function LocationPicker({ location, onChange, isLoading: externalLoading, autoCapture = false }: LocationPickerProps) {
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [manualLocationMode, setManualLocationMode] = useState(false);
  const [manualPlaceName, setManualPlaceName] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [highlightedPlaceIndex, setHighlightedPlaceIndex] = useState(-1);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [autoCaptureAttempted, setAutoCaptureAttempted] = useState(false);
  
  const placeSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placeInputRef = useRef<HTMLInputElement>(null);
  const placeDropdownRef = useRef<HTMLDivElement>(null);

  const isLoading = externalLoading || isLoadingLocation;

  // Auto-capture location on mount if enabled
  useEffect(() => {
    if (autoCapture && !location && !autoCaptureAttempted) {
      setAutoCaptureAttempted(true);
      captureLocationSilent();
    }
  }, [autoCapture, location, autoCaptureAttempted]);

  // Silent auto-capture (no error shown)
  const captureLocationSilent = async () => {
    setIsLoadingLocation(true);
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
        }, true);
      }
    } catch (error) {
      // Silent fail for auto-capture
      logger.info('Auto location capture failed:', error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Debounced place search
  useEffect(() => {
    if (!manualPlaceName || manualPlaceName.trim().length < 2) {
      setPlaceSearchResults([]);
      setHighlightedPlaceIndex(-1);
      return;
    }

    if (placeSearchTimeoutRef.current) {
      clearTimeout(placeSearchTimeoutRef.current);
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
    const handleClickOutside = (event: MouseEvent) => {
      if (
        placeDropdownRef.current && 
        !placeDropdownRef.current.contains(event.target as Node)
      ) {
        setPlaceSearchResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const captureLocation = async () => {
    setIsLoadingLocation(true);
    setLocationError(null);
    
    // Check if geolocation is supported
    if (!isGeolocationSupported()) {
      setLocationError('Location is not supported by your browser. Please enter location manually.');
      setIsLoadingLocation(false);
      return;
    }
    
    // Check permission status first
    const permissionStatus = await checkLocationPermission();
    
    if (permissionStatus === 'denied') {
      setLocationError('Location access was denied. Please enable it in your browser settings and try again.');
      setIsLoadingLocation(false);
      return;
    }
    
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
        }, true);
        setLocationError(null);
      } else {
        // Permission might have been denied during the request
        const newStatus = await checkLocationPermission();
        if (newStatus === 'denied') {
          setLocationError('Location access was denied. Please enable it in your browser settings and try again.');
        } else {
          setLocationError('Could not get location. Please try again or enter manually.');
        }
      }
    } catch (error) {
      logger.error('Failed to capture location:', error);
      setLocationError('Failed to get location. Please try again or enter manually.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const selectPlace = (place: PlaceSearchResult) => {
    onChange({
      latitude: place.latitude,
      longitude: place.longitude,
      placeName: place.displayName.split(',')[0],
      city: place.city,
      country: place.country,
    }, true);
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
        const parts = manualPlaceName.split(',').map(p => p.trim());
        onChange({
          latitude: 0,
          longitude: 0,
          placeName: manualPlaceName.trim(),
          city: parts[0] || undefined,
          country: parts[1] || undefined,
        }, true);
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
        {!location && !isLoading && !manualLocationMode && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setManualLocationMode(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ✏️ Enter manually
            </button>
            <button
              type="button"
              onClick={captureLocation}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              📍 Use current
            </button>
          </div>
        )}
      </div>
      
      {/* Loading state */}
      {isLoading && !location && (
        <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center gap-2">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-sm text-gray-600 dark:text-gray-300">Getting location...</span>
        </div>
      )}
      
      {/* Manual entry mode */}
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {isSearchingPlaces && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
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
              className="px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
          
          {/* Autocomplete dropdown */}
          {placeSearchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {placeSearchResults.map((place, index) => (
                <button
                  key={place.placeId}
                  type="button"
                  onClick={() => selectPlace(place)}
                  className={`w-full px-3 py-2 text-left text-sm ${
                    index === highlightedPlaceIndex 
                      ? 'bg-blue-50 dark:bg-blue-900/30' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 dark:text-gray-500 mt-0.5">📍</span>
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
          
          {manualPlaceName.trim().length >= 2 && !isSearchingPlaces && placeSearchResults.length === 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              No places found. Press Enter to add "{manualPlaceName.trim()}" manually.
            </p>
          )}
        </div>
      )}
      
      {/* Location error with helpful guidance */}
    {locationError && !location && !manualLocationMode && (
      <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-amber-700 dark:text-amber-300">{locationError}</p>
            <button
              type="button"
              onClick={() => {
                setLocationError(null);
                setManualLocationMode(true);
              }}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Enter location manually instead →
            </button>
          </div>
        </div>
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
                onChange(null, false);
                setManualLocationMode(true);
              }}
              className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"
              title="Edit location"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onChange(null, false)}
              className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
              title="Remove location"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
