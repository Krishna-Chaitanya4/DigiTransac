using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Validators;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace DigiTransac.Tests.Validators;

public class CreateBudgetRequestValidatorTests
{
    private readonly CreateBudgetRequestValidator _validator = new();

    private static CreateBudgetRequest ValidRequest() => new(
        Name: "Groceries",
        Description: "Monthly groceries",
        Amount: 500m,
        Currency: "USD",
        Period: "Monthly",
        StartDate: DateTime.UtcNow,
        EndDate: null,
        LabelIds: null,
        AccountIds: null,
        Alerts: null,
        Color: "#FF5733",
        Icon: null
    );

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Empty_Name_Should_Fail(string? name)
    {
        var request = ValidRequest() with { Name = name! };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Name_Exceeds_100_Should_Fail()
    {
        var request = ValidRequest() with { Name = new string('A', 101) };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Amount_Zero_Should_Fail()
    {
        var request = ValidRequest() with { Amount = 0 };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Amount_Negative_Should_Fail()
    {
        var request = ValidRequest() with { Amount = -100 };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Theory]
    [InlineData("Weekly")]
    [InlineData("Monthly")]
    [InlineData("Quarterly")]
    [InlineData("Yearly")]
    [InlineData("Custom")]
    public void Valid_Periods_Should_Pass(string period)
    {
        var request = ValidRequest() with { Period = period };
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Period);
    }

    [Fact]
    public void Invalid_Period_Should_Fail()
    {
        var request = ValidRequest() with { Period = "Biweekly" };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Period);
    }

    [Fact]
    public void Custom_Period_Without_EndDate_Should_Fail()
    {
        var request = ValidRequest() with { Period = "Custom", EndDate = null };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void EndDate_Before_StartDate_Should_Fail()
    {
        var now = DateTime.UtcNow;
        var request = ValidRequest() with { StartDate = now, EndDate = now.AddDays(-1) };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.EndDate);
    }

    [Fact]
    public void Currency_Not_3_Letters_Should_Fail()
    {
        var request = ValidRequest() with { Currency = "US" };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Currency);
    }

    [Fact]
    public void Invalid_Hex_Color_Should_Fail()
    {
        var request = ValidRequest() with { Color = "red" };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Color);
    }

    [Theory]
    [InlineData("#FF5733")]
    [InlineData("#000000")]
    [InlineData("#aabbcc")]
    public void Valid_Hex_Colors_Should_Pass(string color)
    {
        var request = ValidRequest() with { Color = color };
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Color);
    }

    [Fact]
    public void Description_Exceeds_500_Should_Fail()
    {
        var request = ValidRequest() with { Description = new string('D', 501) };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Description);
    }
}

public class BudgetAlertRequestValidatorTests
{
    private readonly BudgetAlertRequestValidator _validator = new();

    [Theory]
    [InlineData(1)]
    [InlineData(50)]
    [InlineData(100)]
    [InlineData(200)]
    public void Valid_Threshold_Should_Pass(int threshold)
    {
        var result = _validator.TestValidate(new BudgetAlertRequest(threshold));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(201)]
    public void Invalid_Threshold_Should_Fail(int threshold)
    {
        var result = _validator.TestValidate(new BudgetAlertRequest(threshold));
        result.ShouldHaveValidationErrorFor(x => x.ThresholdPercent);
    }
}

public class UpdateBudgetRequestValidatorTests
{
    private readonly UpdateBudgetRequestValidator _validator = new();

    [Fact]
    public void Empty_Update_Should_Pass()
    {
        var request = new UpdateBudgetRequest(null, null, null, null, null, null, null, null, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Amount_Zero_When_Provided_Should_Fail()
    {
        var request = new UpdateBudgetRequest(null, null, 0m, null, null, null, null, null, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Invalid_Period_When_Provided_Should_Fail()
    {
        var request = new UpdateBudgetRequest(null, null, null, null, "Daily", null, null, null, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Period);
    }
}
