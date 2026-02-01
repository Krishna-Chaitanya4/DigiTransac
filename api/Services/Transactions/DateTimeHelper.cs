namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Helper class for timezone-aware date/time operations.
/// Ensures Date (UTC) is always derived from DateLocal + TimeLocal + DateTimezone.
/// </summary>
public static class DateTimeHelper
{
    /// <summary>
    /// Derives UTC DateTime from local date, time, and timezone.
    /// This ensures Date is always calculated from the local fields, preventing discrepancies.
    /// </summary>
    /// <param name="dateLocal">Date in YYYY-MM-DD format</param>
    /// <param name="timeLocal">Time in HH:mm format</param>
    /// <param name="dateTimezone">IANA timezone identifier (e.g., "Asia/Kolkata")</param>
    /// <param name="fallbackDate">Fallback if parsing fails</param>
    /// <returns>UTC DateTime derived from local fields</returns>
    public static DateTime DeriveUtcDate(string? dateLocal, string? timeLocal, string? dateTimezone, DateTime fallbackDate)
    {
        // If no local date provided, return fallback
        if (string.IsNullOrEmpty(dateLocal))
            return fallbackDate;

        try
        {
            // Parse the local date
            if (!DateTime.TryParseExact(dateLocal, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out var localDate))
            {
                return fallbackDate;
            }

            // Parse time (HH:mm format) - default to noon if not provided
            int hour = 12, minute = 0;
            if (!string.IsNullOrEmpty(timeLocal))
            {
                var timeParts = timeLocal.Split(':');
                if (timeParts.Length >= 2 &&
                    int.TryParse(timeParts[0], out var h) && h >= 0 && h < 24 &&
                    int.TryParse(timeParts[1], out var m) && m >= 0 && m < 60)
                {
                    hour = h;
                    minute = m;
                }
            }

            var localDateTime = new DateTime(localDate.Year, localDate.Month, localDate.Day, hour, minute, 0, DateTimeKind.Unspecified);

            // Get TimeZoneInfo from IANA timezone identifier
            var tz = GetTimeZoneFromIana(dateTimezone ?? TimeZoneInfo.Local.Id);

            // Convert local time to UTC
            var utcDateTime = TimeZoneInfo.ConvertTimeToUtc(localDateTime, tz);
            return utcDateTime;
        }
        catch
        {
            return fallbackDate;
        }
    }

    /// <summary>
    /// Normalizes date/time fields for a transaction request.
    /// Ensures DateLocal, TimeLocal, DateTimezone are set and Date is derived from them.
    /// </summary>
    /// <param name="requestDate">The Date from the request</param>
    /// <param name="requestDateLocal">The DateLocal from the request (YYYY-MM-DD)</param>
    /// <param name="requestTimeLocal">The TimeLocal from the request (HH:mm)</param>
    /// <param name="requestDateTimezone">The DateTimezone from the request (IANA)</param>
    /// <returns>Normalized (Date, DateLocal, TimeLocal, DateTimezone) tuple</returns>
    public static (DateTime Date, string DateLocal, string TimeLocal, string DateTimezone) NormalizeDateTimeFields(
        DateTime requestDate,
        string? requestDateLocal,
        string? requestTimeLocal,
        string? requestDateTimezone)
    {
        // Normalize DateLocal - use request date if not provided
        var dateLocal = requestDateLocal ?? requestDate.ToString("yyyy-MM-dd");
        
        // Normalize TimeLocal - use current time if not provided
        var timeLocal = requestTimeLocal ?? DateTime.UtcNow.ToString("HH:mm");
        
        // Normalize DateTimezone - use local timezone if not provided
        var dateTimezone = requestDateTimezone ?? TimeZoneInfo.Local.Id;
        
        // Derive Date (UTC) from the local fields
        var derivedDate = DeriveUtcDate(dateLocal, timeLocal, dateTimezone, requestDate);
        
        return (derivedDate, dateLocal, timeLocal, dateTimezone);
    }

    /// <summary>
    /// Converts IANA timezone identifier to TimeZoneInfo.
    /// Uses .NET 6+ TimeZoneInfo.TryFindSystemTimeZoneById which supports both IANA and Windows IDs.
    /// Falls back to common timezone mapping if direct lookup fails.
    /// </summary>
    private static TimeZoneInfo GetTimeZoneFromIana(string ianaTimezone)
    {
        // .NET 6+ on Linux uses IANA IDs natively, on Windows it can convert them
        try
        {
            // First try direct lookup (works on Linux or if Windows ID is passed)
            if (TimeZoneInfo.TryFindSystemTimeZoneById(ianaTimezone, out var tz))
            {
                return tz;
            }

            // Try converting IANA to Windows ID (for Windows systems)
            if (TimeZoneInfo.TryConvertIanaIdToWindowsId(ianaTimezone, out var windowsId) &&
                TimeZoneInfo.TryFindSystemTimeZoneById(windowsId, out var windowsTz))
            {
                return windowsTz;
            }
        }
        catch
        {
            // Ignore exceptions, fall through to manual mapping
        }

        // Fallback mapping for common IANA timezones to Windows IDs
        var ianaToWindows = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Asia/Kolkata", "India Standard Time" },
            { "Asia/Calcutta", "India Standard Time" },
            { "America/New_York", "Eastern Standard Time" },
            { "America/Chicago", "Central Standard Time" },
            { "America/Denver", "Mountain Standard Time" },
            { "America/Los_Angeles", "Pacific Standard Time" },
            { "America/Phoenix", "US Mountain Standard Time" },
            { "America/Anchorage", "Alaskan Standard Time" },
            { "Pacific/Honolulu", "Hawaiian Standard Time" },
            { "Europe/London", "GMT Standard Time" },
            { "Europe/Paris", "Romance Standard Time" },
            { "Europe/Berlin", "W. Europe Standard Time" },
            { "Europe/Moscow", "Russian Standard Time" },
            { "Asia/Tokyo", "Tokyo Standard Time" },
            { "Asia/Shanghai", "China Standard Time" },
            { "Asia/Hong_Kong", "China Standard Time" },
            { "Asia/Singapore", "Singapore Standard Time" },
            { "Asia/Dubai", "Arabian Standard Time" },
            { "Australia/Sydney", "AUS Eastern Standard Time" },
            { "Australia/Melbourne", "AUS Eastern Standard Time" },
            { "Australia/Perth", "W. Australia Standard Time" },
            { "Pacific/Auckland", "New Zealand Standard Time" },
            { "America/Toronto", "Eastern Standard Time" },
            { "America/Vancouver", "Pacific Standard Time" },
            { "America/Sao_Paulo", "E. South America Standard Time" },
            { "Africa/Johannesburg", "South Africa Standard Time" },
            { "UTC", "UTC" },
            { "Etc/UTC", "UTC" }
        };

        if (ianaToWindows.TryGetValue(ianaTimezone, out var mappedWindowsId))
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(mappedWindowsId);
            }
            catch
            {
                // Fall through to local timezone
            }
        }

        // Final fallback: use local timezone
        return TimeZoneInfo.Local;
    }
}