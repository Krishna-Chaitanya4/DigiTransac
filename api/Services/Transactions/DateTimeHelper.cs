using System.Text.RegularExpressions;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Helper class for timezone-aware date/time operations.
/// Ensures Date (UTC) is always derived from DateLocal + TimeLocal + DateTimezone.
/// </summary>
public static class DateTimeHelper
{
    // Regex patterns for input validation
    private static readonly Regex DateLocalPattern = new(@"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$", RegexOptions.Compiled);
    private static readonly Regex TimeLocalPattern = new(@"^([01]\d|2[0-3]):([0-5]\d)$", RegexOptions.Compiled);
    
    /// <summary>
    /// Validates DateLocal format (YYYY-MM-DD).
    /// </summary>
    /// <param name="dateLocal">Date string to validate</param>
    /// <returns>True if valid format, false otherwise</returns>
    public static bool IsValidDateLocal(string? dateLocal)
    {
        if (string.IsNullOrEmpty(dateLocal))
            return false;
        
        return DateLocalPattern.IsMatch(dateLocal);
    }
    
    /// <summary>
    /// Validates TimeLocal format (HH:mm).
    /// </summary>
    /// <param name="timeLocal">Time string to validate</param>
    /// <returns>True if valid format, false otherwise</returns>
    public static bool IsValidTimeLocal(string? timeLocal)
    {
        if (string.IsNullOrEmpty(timeLocal))
            return false;
        
        return TimeLocalPattern.IsMatch(timeLocal);
    }
    
    /// <summary>
    /// Validates and parses DateLocal, returning the parsed date or null if invalid.
    /// </summary>
    public static DateTime? TryParseDateLocal(string? dateLocal)
    {
        if (!IsValidDateLocal(dateLocal))
            return null;
        
        if (DateTime.TryParseExact(dateLocal, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out var date))
            return date;
        
        return null;
    }
    
    /// <summary>
    /// Validates and parses TimeLocal, returning the (hour, minute) or null if invalid.
    /// </summary>
    public static (int Hour, int Minute)? TryParseTimeLocal(string? timeLocal)
    {
        if (!IsValidTimeLocal(timeLocal))
            return null;
        
        var parts = timeLocal!.Split(':');
        if (int.TryParse(parts[0], out var hour) && int.TryParse(parts[1], out var minute))
            return (hour, minute);
        
        return null;
    }

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
            // Parse the local date with validation
            var parsedDate = TryParseDateLocal(dateLocal);
            if (!parsedDate.HasValue)
            {
                return fallbackDate;
            }
            var localDate = parsedDate.Value;

            // Parse time (HH:mm format) with validation - default to noon if not provided/invalid
            int hour = 12, minute = 0;
            var parsedTime = TryParseTimeLocal(timeLocal);
            if (parsedTime.HasValue)
            {
                hour = parsedTime.Value.Hour;
                minute = parsedTime.Value.Minute;
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
        // Validate and normalize DateLocal - use request date if not provided or invalid
        string dateLocal;
        if (IsValidDateLocal(requestDateLocal))
        {
            dateLocal = requestDateLocal!;
        }
        else
        {
            dateLocal = requestDate.ToString("yyyy-MM-dd");
        }
        
        // Validate and normalize TimeLocal - use current time if not provided or invalid
        string timeLocal;
        if (IsValidTimeLocal(requestTimeLocal))
        {
            timeLocal = requestTimeLocal!;
        }
        else
        {
            timeLocal = DateTime.UtcNow.ToString("HH:mm");
        }
        
        // Normalize DateTimezone - use local timezone if not provided
        var dateTimezone = requestDateTimezone ?? TimeZoneInfo.Local.Id;
        
        // Derive Date (UTC) from the local fields
        var derivedDate = DeriveUtcDate(dateLocal, timeLocal, dateTimezone, requestDate);
        
        return (derivedDate, dateLocal, timeLocal, dateTimezone);
    }
    
    /// <summary>
    /// Validates date/time inputs and returns validation errors if any.
    /// </summary>
    /// <param name="dateLocal">DateLocal to validate</param>
    /// <param name="timeLocal">TimeLocal to validate</param>
    /// <returns>List of validation error messages (empty if all valid)</returns>
    public static List<string> ValidateInputs(string? dateLocal, string? timeLocal)
    {
        var errors = new List<string>();
        
        if (!string.IsNullOrEmpty(dateLocal) && !IsValidDateLocal(dateLocal))
        {
            errors.Add("DateLocal must be in YYYY-MM-DD format (e.g., 2024-01-31)");
        }
        
        if (!string.IsNullOrEmpty(timeLocal) && !IsValidTimeLocal(timeLocal))
        {
            errors.Add("TimeLocal must be in HH:mm format (e.g., 14:30)");
        }
        
        return errors;
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