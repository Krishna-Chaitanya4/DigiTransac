using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Validators;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace DigiTransac.Tests.Validators;

public class CreateAccountRequestValidatorTests
{
    private readonly CreateAccountRequestValidator _validator = new();

    private static CreateAccountRequest MakeRequest(
        string name = "Test", string type = "Bank", string? icon = null, string? color = null,
        string? currency = null, decimal? initialBalance = null, string? institution = null,
        string? accountNumber = null, string? notes = null, bool? includeInNetWorth = null)
        => new(name, type, icon, color, currency, initialBalance, institution, accountNumber, notes, includeInNetWorth);

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var request = MakeRequest("Savings", "Bank", currency: "USD", initialBalance: 1000m, institution: "Chase", accountNumber: "1234", notes: "My savings");
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Name_Empty_Should_Fail(string? name)
    {
        var request = MakeRequest(name: name!);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorMessage("Account name is required");
    }

    [Fact]
    public void Name_Exceeds_100_Characters_Should_Fail()
    {
        var request = MakeRequest(name: new string('A', 101));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Theory]
    [InlineData("Bank")]
    [InlineData("CreditCard")]
    [InlineData("Cash")]
    [InlineData("DigitalWallet")]
    [InlineData("Investment")]
    [InlineData("Loan")]
    public void Valid_AccountTypes_Should_Pass(string type)
    {
        var request = MakeRequest(type: type);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Invalid_AccountType_Should_Fail()
    {
        var request = MakeRequest(type: "Crypto");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Currency_Not_3_Letters_Should_Fail()
    {
        var request = MakeRequest(currency: "US");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Currency);
    }

    [Fact]
    public void Currency_Null_Should_Pass()
    {
        var request = MakeRequest();
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Currency);
    }

    [Fact]
    public void AccountNumber_Exceeds_50_Should_Fail()
    {
        var request = MakeRequest(accountNumber: new string('1', 51));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.AccountNumber);
    }

    [Fact]
    public void Institution_Exceeds_100_Should_Fail()
    {
        var request = MakeRequest(institution: new string('A', 101));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Institution);
    }

    [Fact]
    public void Notes_Exceeds_500_Should_Fail()
    {
        var request = MakeRequest(notes: new string('N', 501));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Notes);
    }
}

public class UpdateAccountRequestValidatorTests
{
    private readonly UpdateAccountRequestValidator _validator = new();

    [Fact]
    public void Valid_Update_Should_Pass()
    {
        var request = new UpdateAccountRequest("Updated Name", null, null, "EUR", null, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Name_Exceeds_100_Should_Fail()
    {
        var request = new UpdateAccountRequest(new string('A', 101), null, null, null, null, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Order_Negative_Should_Fail()
    {
        var request = new UpdateAccountRequest(null, null, null, null, null, null, null, null, null, -1);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Order);
    }

    [Fact]
    public void Order_Zero_Should_Pass()
    {
        var request = new UpdateAccountRequest(null, null, null, null, null, null, null, null, null, 0);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Order);
    }
}

public class ReorderAccountsRequestValidatorTests
{
    private readonly ReorderAccountsRequestValidator _validator = new();

    [Fact]
    public void Valid_Reorder_Should_Pass()
    {
        var request = new ReorderAccountsRequest(new List<AccountOrderItem>
        {
            new("id1", 0),
            new("id2", 1)
        });
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_Items_Should_Fail()
    {
        var request = new ReorderAccountsRequest(new List<AccountOrderItem>());
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Items);
    }

    [Fact]
    public void Item_With_Empty_Id_Should_Fail()
    {
        var request = new ReorderAccountsRequest(new List<AccountOrderItem> { new("", 0) });
        var result = _validator.TestValidate(request);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void Item_With_Negative_Order_Should_Fail()
    {
        var request = new ReorderAccountsRequest(new List<AccountOrderItem> { new("id1", -1) });
        var result = _validator.TestValidate(request);
        result.ShouldHaveAnyValidationError();
    }
}

public class AdjustBalanceRequestValidatorTests
{
    private readonly AdjustBalanceRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var request = new AdjustBalanceRequest(100m, "Correction");
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Notes_Exceeds_500_Should_Fail()
    {
        var request = new AdjustBalanceRequest(100m, new string('N', 501));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Notes);
    }
}
