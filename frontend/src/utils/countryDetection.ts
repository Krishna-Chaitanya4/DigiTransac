/**
 * Country Detection Utility
 * Detects user's country code from timezone/locale for phone number input
 */

/**
 * Detect country code from browser timezone and locale
 * Returns ISO 3166-1 alpha-2 country code (e.g., "IN", "US")
 */
export const detectCountry = (): string => {
  try {
    // METHOD 1: Timezone-based detection
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const timezoneToCountry: Record<string, string> = {
        // Asia
        'Asia/Kolkata': 'IN',
        'Asia/Calcutta': 'IN',
        'Asia/Mumbai': 'IN',
        'Asia/Delhi': 'IN',
        'Asia/Tokyo': 'JP',
        'Asia/Shanghai': 'CN',
        'Asia/Hong_Kong': 'HK',
        'Asia/Singapore': 'SG',
        'Asia/Seoul': 'KR',
        'Asia/Bangkok': 'TH',
        'Asia/Jakarta': 'ID',
        'Asia/Manila': 'PH',
        'Asia/Kuala_Lumpur': 'MY',
        'Asia/Dubai': 'AE',
        'Asia/Riyadh': 'SA',
        'Asia/Tel_Aviv': 'IL',
        'Asia/Istanbul': 'TR',
        // Americas
        'America/New_York': 'US',
        'America/Chicago': 'US',
        'America/Denver': 'US',
        'America/Los_Angeles': 'US',
        'America/Toronto': 'CA',
        'America/Vancouver': 'CA',
        'America/Mexico_City': 'MX',
        'America/Sao_Paulo': 'BR',
        'America/Buenos_Aires': 'AR',
        // Europe
        'Europe/London': 'GB',
        'Europe/Paris': 'FR',
        'Europe/Berlin': 'DE',
        'Europe/Rome': 'IT',
        'Europe/Madrid': 'ES',
        'Europe/Amsterdam': 'NL',
        'Europe/Brussels': 'BE',
        'Europe/Vienna': 'AT',
        'Europe/Zurich': 'CH',
        'Europe/Moscow': 'RU',
        'Europe/Warsaw': 'PL',
        // Oceania
        'Australia/Sydney': 'AU',
        'Australia/Melbourne': 'AU',
        'Pacific/Auckland': 'NZ',
        // Africa
        'Africa/Johannesburg': 'ZA',
        'Africa/Lagos': 'NG',
        'Africa/Nairobi': 'KE',
      };

      if (timezoneToCountry[timezone]) {
        return timezoneToCountry[timezone];
      }
    } catch {
      // Continue to fallback
    }

    // METHOD 2: Locale-based detection
    const languages = navigator.languages || [navigator.language];

    for (const lang of languages) {
      // Extract country code from locale (e.g., "en-IN" → "IN")
      if (lang.includes('-')) {
        const countryCode = lang.split('-')[1]?.toUpperCase();
        if (countryCode && countryCode.length === 2) {
          return countryCode;
        }
      }
    }

    // Fallback to US
    return 'US';
  } catch {
    return 'US';
  }
};
