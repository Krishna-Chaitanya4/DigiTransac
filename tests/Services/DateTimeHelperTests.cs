using DigiTransac.Api.Services.Transactions;
using FluentAssertions;

namespace DigiTransac.Tests.Services;

public class DateTimeHelperTests
{
    #region IsValidDateLocal Tests

    [Theory]
    [InlineData("2024-01-31", true)]
    [InlineData("2024-12-01", true)]
    [InlineData("2024-02-29", true)]  // Leap year
    [InlineData("2023-02-29", true)]  // Invalid date but valid format (format-only check)
    [InlineData("2024-1-31", false)]  // Missing leading zero
    [InlineData("2024-01-1", false)]  // Missing leading zero
    [InlineData("24-01-31", false)]   // Short year
    [InlineData("2024/01/31", false)] // Wrong separator
    [InlineData("01-31-2024", false)] // Wrong order
    [InlineData("2024-13-01", false)] // Invalid month
    [InlineData("2024-00-01", false)] // Invalid month
    [InlineData("2024-01-32", false)] // Invalid day
    [InlineData("2024-01-00", false)] // Invalid day
    [InlineData("", false)]
    [InlineData(null, false)]
    [InlineData("invalid", false)]
    public void IsValidDateLocal_ShouldValidateFormat(string? dateLocal, bool expected)
    {
        // Act
        var result = DateTimeHelper.IsValidDateLocal(dateLocal);

        // Assert
        result.Should().Be(expected);
    }

    #endregion

    #region IsValidTimeLocal Tests

    [Theory]
    [InlineData("00:00", true)]
    [InlineData("12:00", true)]
    [InlineData("23:59", true)]
    [InlineData("09:30", true)]
    [InlineData("14:45", true)]
    [InlineData("24:00", false)]  // Invalid hour
    [InlineData("12:60", false)]  // Invalid minute
    [InlineData("1:30", false)]   // Missing leading zero for hour
    [InlineData("12:5", false)]   // Missing leading zero for minute
    [InlineData("12", false)]     // No minutes
    [InlineData("12:30:00", false)] // Has seconds
    [InlineData("", false)]
    [InlineData(null, false)]
    [InlineData("invalid", false)]
    public void IsValidTimeLocal_ShouldValidateFormat(string? timeLocal, bool expected)
    {
        // Act
        var result = DateTimeHelper.IsValidTimeLocal(timeLocal);

        // Assert
        result.Should().Be(expected);
    }

    #endregion

    #region TryParseDateLocal Tests

    [Fact]
    public void TryParseDateLocal_WithValidDate_ShouldReturnParsedDate()
    {
        // Act
        var result = DateTimeHelper.TryParseDateLocal("2024-01-15");

        // Assert
        result.Should().NotBeNull();
        result!.Value.Year.Should().Be(2024);
        result.Value.Month.Should().Be(1);
        result.Value.Day.Should().Be(15);
    }

    [Fact]
    public void TryParseDateLocal_WithInvalidFormat_ShouldReturnNull()
    {
        // Act
        var result = DateTimeHelper.TryParseDateLocal("01/15/2024");

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void TryParseDateLocal_WithNull_ShouldReturnNull()
    {
        // Act
        var result = DateTimeHelper.TryParseDateLocal(null);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region TryParseTimeLocal Tests

    [Fact]
    public void TryParseTimeLocal_WithValidTime_ShouldReturnParsedTime()
    {
        // Act
        var result = DateTimeHelper.TryParseTimeLocal("14:30");

        // Assert
        result.Should().NotBeNull();
        result!.Value.Hour.Should().Be(14);
        result.Value.Minute.Should().Be(30);
    }

    [Fact]
    public void TryParseTimeLocal_WithMidnight_ShouldReturnZeroHour()
    {
        // Act
        var result = DateTimeHelper.TryParseTimeLocal("00:00");

        // Assert
        result.Should().NotBeNull();
        result!.Value.Hour.Should().Be(0);
        result.Value.Minute.Should().Be(0);
    }

    [Fact]
    public void TryParseTimeLocal_WithInvalidFormat_ShouldReturnNull()
    {
        // Act
        var result = DateTimeHelper.TryParseTimeLocal("2:30 PM");

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region DeriveUtcDate Tests

    [Fact]
    public void DeriveUtcDate_WithUtcTimezone_ShouldReturnSameTime()
    {
        // Arrange
        var dateLocal = "2024-01-15";
        var timeLocal = "12:00";
        var timezone = "UTC";
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, timeLocal, timezone, fallback);

        // Assert
        result.Should().Be(new DateTime(2024, 1, 15, 12, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void DeriveUtcDate_WithIndiaTimezone_ShouldConvertCorrectly()
    {
        // Arrange - India is UTC+5:30
        var dateLocal = "2024-01-15";
        var timeLocal = "17:30"; // 5:30 PM in India
        var timezone = "Asia/Kolkata";
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, timeLocal, timezone, fallback);

        // Assert - Should be 12:00 UTC (17:30 - 5:30)
        result.Year.Should().Be(2024);
        result.Month.Should().Be(1);
        result.Day.Should().Be(15);
        result.Hour.Should().Be(12);
        result.Minute.Should().Be(0);
    }

    [Fact]
    public void DeriveUtcDate_WithUSEasternTimezone_ShouldConvertCorrectly()
    {
        // Arrange - Eastern is UTC-5 in winter
        var dateLocal = "2024-01-15";
        var timeLocal = "07:00"; // 7 AM in New York
        var timezone = "America/New_York";
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, timeLocal, timezone, fallback);

        // Assert - Should be 12:00 UTC (07:00 + 5)
        result.Year.Should().Be(2024);
        result.Month.Should().Be(1);
        result.Day.Should().Be(15);
        result.Hour.Should().Be(12);
        result.Minute.Should().Be(0);
    }

    [Fact]
    public void DeriveUtcDate_CrossingMidnight_ShouldHandleDateChange()
    {
        // Arrange - Late night in India should be previous day UTC
        var dateLocal = "2024-01-15";
        var timeLocal = "02:30"; // 2:30 AM in India
        var timezone = "Asia/Kolkata";
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, timeLocal, timezone, fallback);

        // Assert - Should be 21:00 UTC on Jan 14 (02:30 - 5:30 = -3:00 = previous day 21:00)
        result.Year.Should().Be(2024);
        result.Month.Should().Be(1);
        result.Day.Should().Be(14);
        result.Hour.Should().Be(21);
        result.Minute.Should().Be(0);
    }

    [Fact]
    public void DeriveUtcDate_WithNoTimeLocal_ShouldDefaultToNoon()
    {
        // Arrange
        var dateLocal = "2024-01-15";
        var timezone = "UTC";
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, null, timezone, fallback);

        // Assert - Should default to 12:00
        result.Hour.Should().Be(12);
        result.Minute.Should().Be(0);
    }

    [Fact]
    public void DeriveUtcDate_WithNoDateLocal_ShouldReturnFallback()
    {
        // Arrange
        var fallback = new DateTime(2024, 6, 15, 10, 30, 0, DateTimeKind.Utc);

        // Act
        var result = DateTimeHelper.DeriveUtcDate(null, "12:00", "UTC", fallback);

        // Assert
        result.Should().Be(fallback);
    }

    [Fact]
    public void DeriveUtcDate_WithInvalidDateFormat_ShouldReturnFallback()
    {
        // Arrange
        var fallback = new DateTime(2024, 6, 15, 10, 30, 0, DateTimeKind.Utc);

        // Act
        var result = DateTimeHelper.DeriveUtcDate("invalid-date", "12:00", "UTC", fallback);

        // Assert
        result.Should().Be(fallback);
    }

    [Fact]
    public void DeriveUtcDate_WithInvalidTimeFormat_ShouldDefaultToNoon()
    {
        // Arrange
        var dateLocal = "2024-01-15";
        var timezone = "UTC";
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, "invalid", timezone, fallback);

        // Assert - Should default to 12:00
        result.Hour.Should().Be(12);
        result.Minute.Should().Be(0);
    }

    #endregion

    #region NormalizeDateTimeFields Tests

    [Fact]
    public void NormalizeDateTimeFields_WithAllFieldsProvided_ShouldUseProvidedValues()
    {
        // Arrange
        var requestDate = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var dateLocal = "2024-06-15";
        var timeLocal = "14:30";
        var timezone = "UTC";

        // Act
        var (date, resultDateLocal, resultTimeLocal, resultTimezone) = 
            DateTimeHelper.NormalizeDateTimeFields(requestDate, dateLocal, timeLocal, timezone);

        // Assert
        resultDateLocal.Should().Be("2024-06-15");
        resultTimeLocal.Should().Be("14:30");
        resultTimezone.Should().Be("UTC");
        date.Should().Be(new DateTime(2024, 6, 15, 14, 30, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void NormalizeDateTimeFields_WithMissingDateLocal_ShouldUseRequestDate()
    {
        // Arrange
        var requestDate = new DateTime(2024, 3, 20, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var (_, resultDateLocal, _, _) = 
            DateTimeHelper.NormalizeDateTimeFields(requestDate, null, "12:00", "UTC");

        // Assert
        resultDateLocal.Should().Be("2024-03-20");
    }

    [Fact]
    public void NormalizeDateTimeFields_WithInvalidDateLocal_ShouldUseRequestDate()
    {
        // Arrange
        var requestDate = new DateTime(2024, 3, 20, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var (_, resultDateLocal, _, _) = 
            DateTimeHelper.NormalizeDateTimeFields(requestDate, "invalid", "12:00", "UTC");

        // Assert
        resultDateLocal.Should().Be("2024-03-20");
    }

    [Fact]
    public void NormalizeDateTimeFields_WithInvalidTimeLocal_ShouldUseCurrentTime()
    {
        // Arrange
        var requestDate = new DateTime(2024, 3, 20, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var (_, _, resultTimeLocal, _) = 
            DateTimeHelper.NormalizeDateTimeFields(requestDate, "2024-03-20", "bad-time", "UTC");

        // Assert
        // Should be in HH:mm format
        resultTimeLocal.Should().MatchRegex(@"^\d{2}:\d{2}$");
    }

    [Fact]
    public void NormalizeDateTimeFields_WithMissingTimezone_ShouldUseLocalTimezone()
    {
        // Arrange
        var requestDate = new DateTime(2024, 3, 20, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var (_, _, _, resultTimezone) = 
            DateTimeHelper.NormalizeDateTimeFields(requestDate, "2024-03-20", "12:00", null);

        // Assert
        resultTimezone.Should().NotBeNullOrEmpty();
        resultTimezone.Should().Be(TimeZoneInfo.Local.Id);
    }

    #endregion

    #region ValidateInputs Tests

    [Fact]
    public void ValidateInputs_WithValidInputs_ShouldReturnEmptyList()
    {
        // Act
        var errors = DateTimeHelper.ValidateInputs("2024-01-15", "14:30");

        // Assert
        errors.Should().BeEmpty();
    }

    [Fact]
    public void ValidateInputs_WithInvalidDateLocal_ShouldReturnError()
    {
        // Act
        var errors = DateTimeHelper.ValidateInputs("invalid-date", "14:30");

        // Assert
        errors.Should().HaveCount(1);
        errors[0].Should().Contain("DateLocal");
        errors[0].Should().Contain("YYYY-MM-DD");
    }

    [Fact]
    public void ValidateInputs_WithInvalidTimeLocal_ShouldReturnError()
    {
        // Act
        var errors = DateTimeHelper.ValidateInputs("2024-01-15", "2:30 PM");

        // Assert
        errors.Should().HaveCount(1);
        errors[0].Should().Contain("TimeLocal");
        errors[0].Should().Contain("HH:mm");
    }

    [Fact]
    public void ValidateInputs_WithBothInvalid_ShouldReturnTwoErrors()
    {
        // Act
        var errors = DateTimeHelper.ValidateInputs("bad-date", "bad-time");

        // Assert
        errors.Should().HaveCount(2);
    }

    [Fact]
    public void ValidateInputs_WithNullInputs_ShouldReturnEmptyList()
    {
        // Null values are allowed (they get normalized elsewhere)
        // Act
        var errors = DateTimeHelper.ValidateInputs(null, null);

        // Assert
        errors.Should().BeEmpty();
    }

    [Fact]
    public void ValidateInputs_WithEmptyInputs_ShouldReturnEmptyList()
    {
        // Empty values are allowed (they get normalized elsewhere)
        // Act
        var errors = DateTimeHelper.ValidateInputs("", "");

        // Assert
        errors.Should().BeEmpty();
    }

    #endregion

    #region DST Handling Tests

    [Fact]
    public void DeriveUtcDate_DuringDSTTransition_SpringForward_ShouldHandleCorrectly()
    {
        // Arrange - March 10, 2024 is when DST starts in US (2 AM becomes 3 AM)
        // 2:30 AM doesn't exist on this day
        var dateLocal = "2024-03-10";
        var timeLocal = "03:30"; // Use 3:30 AM which exists
        var timezone = "America/New_York";
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, timeLocal, timezone, fallback);

        // Assert - 3:30 AM EDT = 7:30 AM UTC (UTC-4 during DST)
        result.Year.Should().Be(2024);
        result.Month.Should().Be(3);
        result.Day.Should().Be(10);
        result.Hour.Should().Be(7);
        result.Minute.Should().Be(30);
    }

    [Fact]
    public void DeriveUtcDate_DuringDSTTransition_FallBack_ShouldHandleCorrectly()
    {
        // Arrange - November 3, 2024 is when DST ends in US (2 AM becomes 1 AM)
        var dateLocal = "2024-11-03";
        var timeLocal = "06:00"; // 6 AM after DST ends
        var timezone = "America/New_York";
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, timeLocal, timezone, fallback);

        // Assert - 6:00 AM EST = 11:00 AM UTC (UTC-5 after DST)
        result.Year.Should().Be(2024);
        result.Month.Should().Be(11);
        result.Day.Should().Be(3);
        result.Hour.Should().Be(11);
        result.Minute.Should().Be(0);
    }

    [Fact]
    public void DeriveUtcDate_IndiaDoesNotObserveDST_ShouldBeConsistent()
    {
        // Arrange - India does not observe DST, so offset is always +5:30
        var winterDate = "2024-01-15";
        var summerDate = "2024-07-15";
        var timeLocal = "12:00";
        var timezone = "Asia/Kolkata";
        var fallback = DateTime.UtcNow;

        // Act
        var winterResult = DateTimeHelper.DeriveUtcDate(winterDate, timeLocal, timezone, fallback);
        var summerResult = DateTimeHelper.DeriveUtcDate(summerDate, timeLocal, timezone, fallback);

        // Assert - Both should have the same UTC hour (6:30)
        winterResult.Hour.Should().Be(6);
        winterResult.Minute.Should().Be(30);
        summerResult.Hour.Should().Be(6);
        summerResult.Minute.Should().Be(30);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void DeriveUtcDate_LeapYearFeb29_ShouldWork()
    {
        // Arrange
        var dateLocal = "2024-02-29"; // 2024 is a leap year
        var timeLocal = "12:00";
        var timezone = "UTC";
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, timeLocal, timezone, fallback);

        // Assert
        result.Year.Should().Be(2024);
        result.Month.Should().Be(2);
        result.Day.Should().Be(29);
    }

    [Fact]
    public void DeriveUtcDate_YearBoundary_ShouldHandleCorrectly()
    {
        // Arrange - 11 PM in UTC+13 should be previous day in UTC
        var dateLocal = "2024-01-01";
        var timeLocal = "00:30"; // Just after midnight in NZ
        var timezone = "Pacific/Auckland"; // UTC+13 in summer
        var fallback = DateTime.UtcNow;

        // Act
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, timeLocal, timezone, fallback);

        // Assert - Should be Dec 31, 2023 in UTC (00:30 - 13 hours)
        result.Year.Should().Be(2023);
        result.Month.Should().Be(12);
        result.Day.Should().Be(31);
    }

    [Fact]
    public void DeriveUtcDate_UnknownTimezone_ShouldFallbackToLocalTimezone()
    {
        // Arrange
        var dateLocal = "2024-01-15";
        var timeLocal = "12:00";
        var timezone = "Unknown/Timezone";
        var fallback = DateTime.UtcNow;

        // Act & Assert - Should not throw, should use local timezone
        var result = DateTimeHelper.DeriveUtcDate(dateLocal, timeLocal, timezone, fallback);
        result.Should().NotBe(fallback); // Should have parsed the date
    }

    #endregion
}