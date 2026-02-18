using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Validators;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace DigiTransac.Tests.Validators;

public class CreateTransactionRequestValidatorTests
{
    private readonly CreateTransactionRequestValidator _validator = new();

    private static CreateTransactionRequest ValidRequest() => new(
        AccountId: "acc1",
        Type: "Send",
        Amount: 100m,
        Date: DateTime.UtcNow,
        Title: "Lunch",
        Payee: "Restaurant",
        Notes: null,
        Splits: new List<TransactionSplitRequest> { new("label1", 100m, null) },
        TagIds: null,
        Location: null,
        TransferToAccountId: null,
        RecurringRule: null,
        CounterpartyEmail: null,
        CounterpartyAmount: null
    );

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_AccountId_Should_Fail()
    {
        var request = ValidRequest() with { AccountId = "" };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.AccountId);
    }

    [Theory]
    [InlineData("Send")]
    [InlineData("Receive")]
    public void Valid_Types_Should_Pass(string type)
    {
        var request = ValidRequest() with { Type = type };
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Invalid_Type_Should_Fail()
    {
        var request = ValidRequest() with { Type = "Transfer" };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Type);
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
        var request = ValidRequest() with { Amount = -50m };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Title_Exceeds_200_Should_Fail()
    {
        var request = ValidRequest() with { Title = new string('T', 201) };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void Payee_Exceeds_200_Should_Fail()
    {
        var request = ValidRequest() with { Payee = new string('P', 201) };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Payee);
    }

    [Fact]
    public void Notes_Exceeds_1000_Should_Fail()
    {
        var request = ValidRequest() with { Notes = new string('N', 1001) };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Notes);
    }

    [Fact]
    public void TransferToSameAccount_Should_Fail()
    {
        var request = ValidRequest() with { TransferToAccountId = "acc1" };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.TransferToAccountId);
    }

    [Fact]
    public void SplitSum_NotEqual_Amount_Should_Fail()
    {
        var request = ValidRequest() with
        {
            Amount = 100m,
            Splits = new List<TransactionSplitRequest>
            {
                new("label1", 60m, null),
                new("label2", 30m, null) // sum = 90, not 100
            }
        };
        var result = _validator.TestValidate(request);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void SplitSum_Equal_Amount_Should_Pass()
    {
        var request = ValidRequest() with
        {
            Amount = 100m,
            Splits = new List<TransactionSplitRequest>
            {
                new("label1", 60m, null),
                new("label2", 40m, null) // sum = 100
            }
        };
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_Splits_Should_Fail()
    {
        var request = ValidRequest() with { Splits = new List<TransactionSplitRequest>() };
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Splits);
    }

    [Fact]
    public void Location_Invalid_Latitude_Should_Fail()
    {
        var request = ValidRequest() with
        {
            Location = new TransactionLocationRequest(91, 0, null, null, null)
        };
        var result = _validator.TestValidate(request);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void Location_Invalid_Longitude_Should_Fail()
    {
        var request = ValidRequest() with
        {
            Location = new TransactionLocationRequest(0, 181, null, null, null)
        };
        var result = _validator.TestValidate(request);
        result.ShouldHaveAnyValidationError();
    }

    [Fact]
    public void Location_Valid_Coordinates_Should_Pass()
    {
        var request = ValidRequest() with
        {
            Location = new TransactionLocationRequest(40.7, -74.0, "NYC", "New York", "US")
        };
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void RecurringRule_Valid_Should_Pass()
    {
        var request = ValidRequest() with
        {
            RecurringRule = new RecurringRuleRequest("Monthly", 1, null)
        };
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void RecurringRule_Invalid_Frequency_Should_Fail()
    {
        var request = ValidRequest() with
        {
            RecurringRule = new RecurringRuleRequest("Hourly", 1, null)
        };
        var result = _validator.TestValidate(request);
        result.ShouldHaveAnyValidationError();
    }
}

public class TransactionSplitRequestValidatorTests
{
    private readonly TransactionSplitRequestValidator _validator = new();

    [Fact]
    public void Valid_Split_Should_Pass()
    {
        var result = _validator.TestValidate(new TransactionSplitRequest("label1", 50m, null));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_LabelId_Should_Fail()
    {
        var result = _validator.TestValidate(new TransactionSplitRequest("", 50m, null));
        result.ShouldHaveValidationErrorFor(x => x.LabelId);
    }

    [Fact]
    public void Amount_Zero_Should_Fail()
    {
        var result = _validator.TestValidate(new TransactionSplitRequest("label1", 0m, null));
        result.ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Notes_Exceeds_500_Should_Fail()
    {
        var result = _validator.TestValidate(new TransactionSplitRequest("label1", 50m, new string('N', 501)));
        result.ShouldHaveValidationErrorFor(x => x.Notes);
    }
}

public class TransactionFilterRequestValidatorTests
{
    private readonly TransactionFilterRequestValidator _validator = new();

    [Fact]
    public void Empty_Filter_Should_Pass()
    {
        var request = new TransactionFilterRequest(null, null, null, null, null, null, null, null, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void StartDate_After_EndDate_Should_Fail()
    {
        var now = DateTime.UtcNow;
        var request = new TransactionFilterRequest(now, now.AddDays(-1), null, null, null, null, null, null, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.StartDate);
    }

    [Fact]
    public void MinAmount_Negative_Should_Fail()
    {
        var request = new TransactionFilterRequest(null, null, null, null, null, null, -1m, null, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.MinAmount);
    }

    [Fact]
    public void MaxAmount_Less_Than_MinAmount_Should_Fail()
    {
        var request = new TransactionFilterRequest(null, null, null, null, null, null, 100m, 50m, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.MaxAmount);
    }

    [Fact]
    public void Page_Zero_Should_Fail()
    {
        var request = new TransactionFilterRequest(null, null, null, null, null, null, null, null, null, null, null, 0, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Page);
    }

    [Fact]
    public void PageSize_Zero_Should_Fail()
    {
        var request = new TransactionFilterRequest(null, null, null, null, null, null, null, null, null, null, null, null, 0);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.PageSize);
    }

    [Fact]
    public void PageSize_Over_100_Should_Fail()
    {
        var request = new TransactionFilterRequest(null, null, null, null, null, null, null, null, null, null, null, null, 101);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.PageSize);
    }

    [Fact]
    public void Invalid_Type_In_Types_Should_Fail()
    {
        var request = new TransactionFilterRequest(null, null, null, new List<string> { "Invalid" }, null, null, null, null, null, null, null, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveAnyValidationError();
    }
}

public class BatchOperationRequestValidatorTests
{
    private readonly BatchOperationRequestValidator _validator = new();

    [Fact]
    public void Valid_Delete_Should_Pass()
    {
        var request = new BatchOperationRequest(new List<string> { "id1", "id2" }, "delete", null);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_Ids_Should_Fail()
    {
        var request = new BatchOperationRequest(new List<string>(), "delete", null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Ids);
    }

    [Fact]
    public void More_Than_100_Ids_Should_Fail()
    {
        var ids = Enumerable.Range(1, 101).Select(i => $"id{i}").ToList();
        var request = new BatchOperationRequest(ids, "delete", null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Ids);
    }

    [Fact]
    public void Invalid_Action_Should_Fail()
    {
        var request = new BatchOperationRequest(new List<string> { "id1" }, "archive", null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Action);
    }

    [Theory]
    [InlineData("delete")]
    [InlineData("markconfirmed")]
    [InlineData("markcleared")]
    [InlineData("markpending")]
    [InlineData("markdeclined")]
    [InlineData("updatecategory")]
    public void Valid_Actions_Should_Pass(string action)
    {
        var labelId = action == "updatecategory" ? "label1" : null;
        var request = new BatchOperationRequest(new List<string> { "id1" }, action, labelId);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Action);
    }

    [Fact]
    public void UpdateCategory_Without_LabelId_Should_Fail()
    {
        var request = new BatchOperationRequest(new List<string> { "id1" }, "updatecategory", null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.LabelId);
    }
}

public class SendMoneyRequestValidatorTests
{
    private readonly SendMoneyRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var request = new SendMoneyRequest("acc1", "Send", 100m, "Payment", null, new List<TransactionSplitRequest> { new("label1", 100m, null) });
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_AccountId_Should_Fail()
    {
        var request = new SendMoneyRequest("", "Send", 100m, null, null, new List<TransactionSplitRequest> { new("l1", 100m, null) });
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.AccountId);
    }

    [Fact]
    public void Amount_Zero_Should_Fail()
    {
        var request = new SendMoneyRequest("acc1", "Send", 0, null, null, new List<TransactionSplitRequest> { new("l1", 0, null) });
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void Empty_Splits_Should_Fail()
    {
        var request = new SendMoneyRequest("acc1", "Send", 100m, null, null, new List<TransactionSplitRequest>());
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Splits);
    }

    [Fact]
    public void Title_Exceeds_200_Should_Fail()
    {
        var request = new SendMoneyRequest("acc1", "Send", 100m, new string('T', 201), null, new List<TransactionSplitRequest> { new("l1", 100m, null) });
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Title);
    }
}

public class CurrencyValidatorTests
{
    private readonly UpdatePrimaryCurrencyRequestValidator _validator = new();

    [Fact]
    public void Valid_Currency_Should_Pass()
    {
        var result = _validator.TestValidate(new UpdatePrimaryCurrencyRequest("USD"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Empty_Currency_Should_Pass_Due_To_When_Guard(string? currency)
    {
        // The .When(x => !string.IsNullOrEmpty(x.Currency)) guard skips the entire
        // rule chain (including NotEmpty) when currency is null/empty.
        var result = _validator.TestValidate(new UpdatePrimaryCurrencyRequest(currency!));
        result.ShouldNotHaveValidationErrorFor(x => x.Currency);
    }

    [Fact]
    public void Invalid_Currency_Code_Should_Fail()
    {
        var result = _validator.TestValidate(new UpdatePrimaryCurrencyRequest("XYZ"));
        result.ShouldHaveValidationErrorFor(x => x.Currency);
    }

    [Fact]
    public void Currency_Wrong_Length_Should_Fail()
    {
        var result = _validator.TestValidate(new UpdatePrimaryCurrencyRequest("US"));
        result.ShouldHaveValidationErrorFor(x => x.Currency);
    }

    [Theory]
    [InlineData("INR")]
    [InlineData("EUR")]
    [InlineData("GBP")]
    public void Supported_Currencies_Should_Pass(string currency)
    {
        var result = _validator.TestValidate(new UpdatePrimaryCurrencyRequest(currency));
        result.ShouldNotHaveAnyValidationErrors();
    }
}
