// Location service for GPS-based country/currency detection

import { logger } from './logger';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationInfo {
  country: string;
  countryCode: string;
  city?: string;
  state?: string;
}

// Country code to currency mapping
// ISO 3166-1 alpha-2 country codes to ISO 4217 currency codes
export const countryToCurrency: Record<string, string> = {
  // South Asia
  IN: 'INR', // India
  PK: 'PKR', // Pakistan
  BD: 'BDT', // Bangladesh
  LK: 'LKR', // Sri Lanka
  NP: 'NPR', // Nepal
  
  // Americas
  US: 'USD', // United States
  CA: 'CAD', // Canada
  MX: 'MXN', // Mexico
  BR: 'BRL', // Brazil
  
  // Europe
  GB: 'GBP', // United Kingdom
  DE: 'EUR', // Germany
  FR: 'EUR', // France
  IT: 'EUR', // Italy
  ES: 'EUR', // Spain
  NL: 'EUR', // Netherlands
  BE: 'EUR', // Belgium
  AT: 'EUR', // Austria
  IE: 'EUR', // Ireland
  PT: 'EUR', // Portugal
  GR: 'EUR', // Greece
  FI: 'EUR', // Finland
  SE: 'SEK', // Sweden
  CH: 'CHF', // Switzerland
  RU: 'RUB', // Russia
  
  // Middle East
  AE: 'AED', // UAE
  SA: 'SAR', // Saudi Arabia (not in our list but common)
  
  // Asia Pacific
  SG: 'SGD', // Singapore
  AU: 'AUD', // Australia
  NZ: 'NZD', // New Zealand
  JP: 'JPY', // Japan
  CN: 'CNY', // China
  HK: 'HKD', // Hong Kong
  KR: 'KRW', // South Korea
  TH: 'THB', // Thailand
  MY: 'MYR', // Malaysia
  ID: 'IDR', // Indonesia
  PH: 'PHP', // Philippines
  VN: 'VND', // Vietnam
  
  // Africa
  ZA: 'ZAR', // South Africa
};

// Default currency if country not found
const DEFAULT_CURRENCY = 'USD';

/**
 * Check if geolocation is supported in the browser
 */
export function isGeolocationSupported(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Request and get current GPS coordinates
 * Returns null if permission denied or error
 */
export async function getCurrentPosition(): Promise<LocationCoordinates | null> {
  if (!isGeolocationSupported()) {
    logger.warn('Geolocation is not supported by this browser');
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        logger.warn('Geolocation error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false, // Don't need high accuracy, just country level
        timeout: 10000, // 10 seconds
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  });
}

/**
 * Reverse geocode coordinates to get location info
 * Uses BigDataCloud free API (no API key needed for basic reverse geocoding)
 * Includes retry logic for reliability
 */
export async function reverseGeocode(coords: LocationCoordinates, retries = 2): Promise<LocationInfo | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`,
        { 
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        }
      );

      if (!response.ok) {
        throw new Error(`Reverse geocode failed with status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.countryCode) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
          continue;
        }
        return null;
      }

      return {
        country: data.countryName || '',
        countryCode: data.countryCode || '',
        city: data.city || data.locality || '',
        state: data.principalSubdivision || '',
      };
    } catch {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Get currency code from country code
 */
export function getCurrencyFromCountry(countryCode: string): string {
  return countryToCurrency[countryCode.toUpperCase()] || DEFAULT_CURRENCY;
}

/**
 * Detection failure reasons
 */
export type DetectionFailureReason =
  | 'geolocation_not_supported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'reverse_geocode_failed'
  | 'country_not_found'
  | 'unknown_error';

/**
 * Result of currency detection
 */
export interface CurrencyDetectionResult {
  currency: string;
  country: string | null;
  detected: boolean;
  failureReason?: DetectionFailureReason;
}

/**
 * Request and get current GPS coordinates with detailed error information
 * Returns coordinates or error details
 */
export async function getCurrentPositionWithDetails(): Promise<{
  coords: LocationCoordinates | null;
  error?: DetectionFailureReason;
}> {
  if (!isGeolocationSupported()) {
    logger.warn('Geolocation is not supported by this browser');
    return { coords: null, error: 'geolocation_not_supported' };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        logger.info('Geolocation success:', {
          lat: position.coords.latitude.toFixed(4),
          lng: position.coords.longitude.toFixed(4),
        });
        resolve({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      (error) => {
        logger.warn('Geolocation error:', {
          code: error.code,
          message: error.message,
        });
        
        // Map error codes to our failure reasons
        let failureReason: DetectionFailureReason;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            failureReason = 'permission_denied';
            break;
          case error.POSITION_UNAVAILABLE:
            failureReason = 'position_unavailable';
            break;
          case error.TIMEOUT:
            failureReason = 'timeout';
            break;
          default:
            failureReason = 'unknown_error';
        }
        
        resolve({ coords: null, error: failureReason });
      },
      {
        enableHighAccuracy: false, // Don't need high accuracy, just country level
        timeout: 15000, // Increased to 15 seconds for slower connections
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  });
}

/**
 * Detect user's currency based on GPS location
 * This is the main function to call
 * Returns detailed information about success/failure
 */
export async function detectCurrencyFromLocation(): Promise<CurrencyDetectionResult> {
  try {
    const { coords, error: positionError } = await getCurrentPositionWithDetails();
    
    if (!coords) {
      logger.warn('Currency detection failed: could not get position', { reason: positionError });
      return {
        currency: DEFAULT_CURRENCY,
        country: null,
        detected: false,
        failureReason: positionError,
      };
    }

    const locationInfo = await reverseGeocode(coords);
    
    if (!locationInfo) {
      logger.warn('Currency detection failed: reverse geocode returned null');
      return {
        currency: DEFAULT_CURRENCY,
        country: null,
        detected: false,
        failureReason: 'reverse_geocode_failed',
      };
    }
    
    if (!locationInfo.countryCode) {
      logger.warn('Currency detection failed: no country code in response', locationInfo);
      return {
        currency: DEFAULT_CURRENCY,
        country: locationInfo.country || null,
        detected: false,
        failureReason: 'country_not_found',
      };
    }

    const currency = getCurrencyFromCountry(locationInfo.countryCode);
    
    logger.info('Currency detection success:', {
      country: locationInfo.country,
      countryCode: locationInfo.countryCode,
      currency,
    });
    
    return {
      currency,
      country: locationInfo.country,
      detected: true,
    };
  } catch (error) {
    logger.error('Failed to detect currency from location:', error);
    return {
      currency: DEFAULT_CURRENCY,
      country: null,
      detected: false,
      failureReason: 'unknown_error',
    };
  }
}

/**
 * Check if location permission was already granted
 */
export async function checkLocationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!navigator.permissions) {
    return 'prompt'; // Can't check, will need to try
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'prompt';
  }
}

/**
 * Place search result from Nominatim
 */
export interface PlaceSearchResult {
  placeId: string;
  displayName: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

/**
 * Search for places using OpenStreetMap Nominatim API (free, no API key needed)
 * Returns a list of matching places with coordinates
 */
export async function searchPlaces(query: string, limit = 5): Promise<PlaceSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          // Nominatim requires a User-Agent header
          'User-Agent': 'DigiTransac/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Place search failed with status: ${response.status}`);
    }

    const data = await response.json();

    return data.map((place: {
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        country?: string;
      };
    }) => ({
      placeId: String(place.place_id),
      displayName: place.display_name,
      city: place.address?.city || place.address?.town || place.address?.village || place.address?.municipality,
      country: place.address?.country,
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
    }));
  } catch (error) {
    logger.error('Place search failed:', error);
    return [];
  }
}
