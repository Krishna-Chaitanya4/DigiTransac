using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Transactions;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using Tag = DigiTransac.Api.Models.Tag;

namespace DigiTransac.Tests.Services;

public class TransactionImportServiceTests
{
    private readonly Mock<ITransactionRepository> _transactionRepo = new();
    private readonly Mock<IAccountRepository> _accountRepo = new();
    private readonly Mock<ILabelRepository> _labelRepo = new();
    private readonly Mock<ITagRepository> _tagRepo = new();
    private readonly Mock<ILabelService> _labelService = new();
    private readonly Mock<ITagService> _tagService = new();
    private readonly Mock<ITransactionMapperService> _mapperService = new();
    private readonly Mock<ILogger<TransactionImportService>> _logger = new();
    private readonly TransactionImportService _sut;

    private const string UserId = "user-1";
    private const string AccountId = "acc-1";

    public TransactionImportServiceTests()
    {
        _sut = new TransactionImportService(
            _transactionRepo.Object,
            _accountRepo.Object,
            _labelRepo.Object,
            _tagRepo.Object,
            _labelService.Object,
            _tagService.Object,
            _mapperService.Object,
            _logger.Object
        );

        // Default: account exists
        _accountRepo.Setup(r => r.GetByIdAndUserIdAsync(AccountId, UserId))
            .ReturnsAsync(new Account { Id = AccountId, UserId = UserId, Currency = "USD" });

        // Default: no existing labels/tags
        _labelRepo.Setup(r => r.GetByUserIdAsync(UserId)).ReturnsAsync(new List<Label>());
        _tagRepo.Setup(r => r.GetByUserIdAsync(UserId)).ReturnsAsync(new List<Tag>());

        // Default: no existing transactions for duplicate check
        _transactionRepo.Setup(r => r.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((new List<Transaction>(), 0));

        // Default: mapper returns null DEK (no encryption)
        _mapperService.Setup(m => m.GetUserDekAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);

        // Default: CreateAsync just sets an Id and returns the transaction
        _transactionRepo.Setup(r => r.CreateAsync(It.IsAny<Transaction>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Transaction t, MongoDB.Driver.IClientSessionHandle? _, CancellationToken _) =>
            {
                t.Id ??= Guid.NewGuid().ToString();
                return t;
            });

        // Also match calls without session parameter
        _transactionRepo.Setup(r => r.CreateAsync(It.IsAny<Transaction>(), It.IsAny<MongoDB.Driver.IClientSessionHandle>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Transaction t, MongoDB.Driver.IClientSessionHandle? _, CancellationToken _) =>
            {
                t.Id ??= Guid.NewGuid().ToString();
                return t;
            });
    }

    // ───────── ParseCsv ─────────

    [Fact]
    public void ParseCsv_EmptyContent_ReturnsEmpty()
    {
        var result = _sut.ParseCsv("");
        result.Should().BeEmpty();
    }

    [Fact]
    public void ParseCsv_HeaderOnly_ReturnsEmpty()
    {
        var csv = "date,amount,title";
        var result = _sut.ParseCsv(csv);
        result.Should().BeEmpty();
    }

    [Fact]
    public void ParseCsv_MissingRequiredColumns_Throws()
    {
        var csv = "name,value\nJohn,100";
        var act = () => _sut.ParseCsv(csv);
        act.Should().Throw<ArgumentException>()
            .WithMessage("*date*amount*");
    }

    [Fact]
    public void ParseCsv_SingleAmountColumn_PositiveIsReceive()
    {
        var csv = "date,amount,title\n2024-01-15,100.50,Salary";
        var result = _sut.ParseCsv(csv);

        result.Should().HaveCount(1);
        result[0].Type.Should().Be("Receive");
        result[0].Amount.Should().Be(100.50m);
        result[0].Date.Should().Be("2024-01-15");
        result[0].Title.Should().Be("Salary");
    }

    [Fact]
    public void ParseCsv_SingleAmountColumn_NegativeIsSend()
    {
        var csv = "date,amount,title\n2024-01-15,-50.00,Groceries";
        var result = _sut.ParseCsv(csv);

        result.Should().HaveCount(1);
        result[0].Type.Should().Be("Send");
        result[0].Amount.Should().Be(50.00m);
    }

    [Fact]
    public void ParseCsv_CreditDebitColumns()
    {
        var csv = "date,credit,debit,title\n2024-01-15,200,,Deposit\n2024-01-16,,75.50,Withdrawal";
        var result = _sut.ParseCsv(csv);

        result.Should().HaveCount(2);
        result[0].Type.Should().Be("Receive");
        result[0].Amount.Should().Be(200m);
        result[1].Type.Should().Be("Send");
        result[1].Amount.Should().Be(75.50m);
    }

    [Fact]
    public void ParseCsv_OptionalFieldMapping_Description_Memo()
    {
        var csv = "date,amount,description\n2024-01-15,10,Coffee";
        var result = _sut.ParseCsv(csv);

        result.Should().HaveCount(1);
        result[0].Title.Should().Be("Coffee");
    }

    [Fact]
    public void ParseCsv_PayeeAliases_Merchant_Vendor_Name()
    {
        var csv = "date,amount,merchant\n2024-01-15,10,Starbucks";
        var result = _sut.ParseCsv(csv);
        result[0].Payee.Should().Be("Starbucks");
    }

    [Fact]
    public void ParseCsv_CategoryMapsToLabel()
    {
        var csv = "date,amount,category\n2024-01-15,10,Food";
        var result = _sut.ParseCsv(csv);
        result[0].LabelName.Should().Be("Food");
    }

    [Fact]
    public void ParseCsv_TagsSplitBySemicolon()
    {
        var csv = "date,amount,tags\n2024-01-15,10,work;travel";
        var result = _sut.ParseCsv(csv);
        result[0].TagNames.Should().BeEquivalentTo(new[] { "work", "travel" });
    }

    [Fact]
    public void ParseCsv_QuotedFieldsWithCommas()
    {
        var csv = "date,amount,title\n2024-01-15,100,\"Rent, utilities\"";
        var result = _sut.ParseCsv(csv);
        result[0].Title.Should().Be("Rent, utilities");
    }

    [Fact]
    public void ParseCsv_EscapedQuotes()
    {
        var csv = "date,amount,title\n2024-01-15,100,\"He said \"\"hello\"\"\"";
        var result = _sut.ParseCsv(csv);
        result[0].Title.Should().Be("He said \"hello\"");
    }

    [Fact]
    public void ParseCsv_VariousDateFormats()
    {
        var csv = "date,amount\n01/15/2024,10\n15-01-2024,20\n20240115,30";
        var result = _sut.ParseCsv(csv);
        result.Should().HaveCount(3);
        result.Should().AllSatisfy(r => r.Date.Should().MatchRegex(@"\d{4}-\d{2}-\d{2}"));
    }

    [Fact]
    public void ParseCsv_AmountWithCurrencySymbols()
    {
        var csv = "date,amount\n2024-01-15,$100.50\n2024-01-16,€200\n2024-01-17,₹3000";
        var result = _sut.ParseCsv(csv);

        result.Should().HaveCount(3);
        result[0].Amount.Should().Be(100.50m);
        result[1].Amount.Should().Be(200m);
        result[2].Amount.Should().Be(3000m);
    }

    [Fact]
    public void ParseCsv_AmountParenthesesNegative()
    {
        var csv = "date,amount\n2024-01-15,(50.00)";
        var result = _sut.ParseCsv(csv);

        result.Should().HaveCount(1);
        result[0].Type.Should().Be("Send");
        result[0].Amount.Should().Be(50.00m);
    }

    [Fact]
    public void ParseCsv_SkipsBlankLines()
    {
        var csv = "date,amount\n2024-01-15,10\n\n2024-01-16,20\n   \n";
        var result = _sut.ParseCsv(csv);
        result.Should().HaveCount(2);
    }

    [Fact]
    public void ParseCsv_CaseInsensitiveHeaders()
    {
        var csv = "DATE,AMOUNT,TITLE\n2024-01-15,100,Test";
        var result = _sut.ParseCsv(csv);
        result.Should().HaveCount(1);
    }

    [Fact]
    public void ParseCsv_TruncatesLongTitle()
    {
        var longTitle = new string('A', 300);
        var csv = $"date,amount,title\n2024-01-15,10,{longTitle}";
        var result = _sut.ParseCsv(csv);
        result[0].Title!.Length.Should().Be(200);
    }

    [Fact]
    public void ParseCsv_InvalidDateRow_SkipsRow()
    {
        var csv = "date,amount\nnot-a-date,10\n2024-01-15,20";
        var result = _sut.ParseCsv(csv);
        // Invalid date row should be skipped (returns null from ParseRowToDtoFromCsv)
        result.Should().HaveCount(1);
        result[0].Amount.Should().Be(20m);
    }

    [Fact]
    public void ParseCsv_ZeroAmount_ReceiveType()
    {
        var csv = "date,amount\n2024-01-15,0";
        var result = _sut.ParseCsv(csv);
        result.Should().HaveCount(1);
        result[0].Type.Should().Be("Receive");
        result[0].Amount.Should().Be(0m);
    }

    // ───────── PreviewImportAsync ─────────

    [Fact]
    public async Task Preview_InvalidAccount_AllRowsInvalid()
    {
        _accountRepo.Setup(r => r.GetByIdAndUserIdAsync("bad-acc", UserId))
            .ReturnsAsync((Account?)null);

        var request = new ImportPreviewRequest(
            AccountId: "bad-acc",
            Transactions: new List<ImportTransactionRequest>
            {
                new("Receive", 100, "2024-01-15", "Salary", null, null, null, null)
            },
            CreateMissingLabels: false,
            CreateMissingTags: false,
            SkipDuplicates: false
        );

        var result = await _sut.PreviewImportAsync(UserId, request);

        result.TotalRows.Should().Be(1);
        result.ValidRows.Should().Be(0);
        result.InvalidRows.Should().Be(1);
        result.Rows[0].Errors.Should().Contain("Invalid account ID");
    }

    [Fact]
    public async Task Preview_ValidRow_MarkedValid()
    {
        var request = new ImportPreviewRequest(
            AccountId: AccountId,
            Transactions: new List<ImportTransactionRequest>
            {
                new("Receive", 100, "2024-01-15", "Salary", null, null, null, null)
            }
        );

        var result = await _sut.PreviewImportAsync(UserId, request);

        result.ValidRows.Should().Be(1);
        result.InvalidRows.Should().Be(0);
        result.Rows[0].IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Preview_InvalidType_ReportsError()
    {
        var request = new ImportPreviewRequest(
            AccountId: AccountId,
            Transactions: new List<ImportTransactionRequest>
            {
                new("InvalidType", 100, "2024-01-15", null, null, null, null, null)
            }
        );

        var result = await _sut.PreviewImportAsync(UserId, request);

        result.InvalidRows.Should().Be(1);
        result.Rows[0].Errors.Should().Contain(e => e.Contains("Type"));
    }

    [Fact]
    public async Task Preview_ZeroAmount_ReportsError()
    {
        var request = new ImportPreviewRequest(
            AccountId: AccountId,
            Transactions: new List<ImportTransactionRequest>
            {
                new("Receive", 0, "2024-01-15", null, null, null, null, null)
            }
        );

        var result = await _sut.PreviewImportAsync(UserId, request);
        result.Rows[0].Errors.Should().Contain(e => e.Contains("Amount"));
    }

    [Fact]
    public async Task Preview_InvalidDate_ReportsError()
    {
        var request = new ImportPreviewRequest(
            AccountId: AccountId,
            Transactions: new List<ImportTransactionRequest>
            {
                new("Receive", 100, "not-a-date", null, null, null, null, null)
            }
        );

        var result = await _sut.PreviewImportAsync(UserId, request);
        result.Rows[0].Errors.Should().Contain(e => e.Contains("Date"));
    }

    [Fact]
    public async Task Preview_MissingLabel_ReportsMissing()
    {
        var request = new ImportPreviewRequest(
            AccountId: AccountId,
            Transactions: new List<ImportTransactionRequest>
            {
                new("Receive", 100, "2024-01-15", null, null, null, "NonexistentLabel", null)
            },
            CreateMissingLabels: false
        );

        var result = await _sut.PreviewImportAsync(UserId, request);

        result.MissingLabels.Should().Contain("NonexistentLabel");
        result.Rows[0].Errors.Should().Contain(e => e.Contains("NonexistentLabel"));
    }

    [Fact]
    public async Task Preview_MissingLabel_CreateMissingLabels_NoError()
    {
        var request = new ImportPreviewRequest(
            AccountId: AccountId,
            Transactions: new List<ImportTransactionRequest>
            {
                new("Receive", 100, "2024-01-15", null, null, null, "NewLabel", null)
            },
            CreateMissingLabels: true
        );

        var result = await _sut.PreviewImportAsync(UserId, request);

        result.MissingLabels.Should().Contain("NewLabel");
        // No error because CreateMissingLabels is true
        result.Rows[0].Errors.Should().NotContain(e => e.Contains("NewLabel"));
        result.Rows[0].IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Preview_ExistingLabel_MapsLabelId()
    {
        _labelRepo.Setup(r => r.GetByUserIdAsync(UserId))
            .ReturnsAsync(new List<Label>
            {
                new() { Id = "lbl-1", Name = "Food", UserId = UserId }
            });

        var request = new ImportPreviewRequest(
            AccountId: AccountId,
            Transactions: new List<ImportTransactionRequest>
            {
                new("Receive", 100, "2024-01-15", null, null, null, "food", null) // lowercase
            }
        );

        var result = await _sut.PreviewImportAsync(UserId, request);

        result.Rows[0].LabelId.Should().Be("lbl-1");
    }

    [Fact]
    public async Task Preview_DuplicateDetection_SkipsDuplicates()
    {
        _transactionRepo.Setup(r => r.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((new List<Transaction>
            {
                new()
                {
                    Id = "existing",
                    Date = new DateTime(2024, 1, 15),
                    Amount = 100m,
                    Type = TransactionType.Receive,
                    UserId = UserId,
                    AccountId = AccountId
                }
            }, 1));

        var request = new ImportPreviewRequest(
            AccountId: AccountId,
            Transactions: new List<ImportTransactionRequest>
            {
                new("Receive", 100, "2024-01-15", null, null, null, null, null)
            },
            SkipDuplicates: true
        );

        var result = await _sut.PreviewImportAsync(UserId, request);

        result.DuplicateRows.Should().Be(1);
        result.Rows[0].IsDuplicate.Should().BeTrue();
        result.Rows[0].IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Preview_MissingTag_ReportsError()
    {
        var request = new ImportPreviewRequest(
            AccountId: AccountId,
            Transactions: new List<ImportTransactionRequest>
            {
                new("Receive", 100, "2024-01-15", null, null, null, null, new List<string> { "UnknownTag" })
            },
            CreateMissingTags: false
        );

        var result = await _sut.PreviewImportAsync(UserId, request);

        result.MissingTags.Should().Contain("UnknownTag");
        result.Rows[0].Errors.Should().Contain(e => e.Contains("UnknownTag"));
    }

    // ───────── ImportAsync ─────────

    [Fact]
    public async Task Import_TooManyRows_ReturnsError()
    {
        var transactions = Enumerable.Range(0, 1001)
            .Select(i => new ImportTransactionRequest("Receive", 10, "2024-01-15", null, null, null, null, null))
            .ToList();

        var request = new BulkImportRequest(AccountId, transactions);
        var result = await _sut.ImportAsync(UserId, request);

        result.SuccessCount.Should().Be(0);
        result.FailedCount.Should().Be(1001);
        result.Results[0].Error.Should().Contain("Maximum is 1000");
    }

    [Fact]
    public async Task Import_InvalidAccount_ReturnsError()
    {
        _accountRepo.Setup(r => r.GetByIdAndUserIdAsync("bad", UserId))
            .ReturnsAsync((Account?)null);

        var request = new BulkImportRequest(
            "bad",
            new List<ImportTransactionRequest>
            {
                new("Receive", 100, "2024-01-15", null, null, null, null, null)
            }
        );

        var result = await _sut.ImportAsync(UserId, request);

        result.SuccessCount.Should().Be(0);
        result.Results[0].Error.Should().Contain("Invalid account ID");
    }

    [Fact]
    public async Task Import_ValidRow_CreatesTransaction()
    {
        var request = new BulkImportRequest(
            AccountId,
            new List<ImportTransactionRequest>
            {
                new("Receive", 150.75m, "2024-01-15", "Salary", "Employer", "Monthly", null, null)
            }
        );

        var result = await _sut.ImportAsync(UserId, request);

        result.SuccessCount.Should().Be(1);
        result.FailedCount.Should().Be(0);
        result.Results[0].Success.Should().BeTrue();
        result.Results[0].TransactionId.Should().NotBeNullOrEmpty();

        _transactionRepo.Verify(r => r.CreateAsync(It.Is<Transaction>(t =>
            t.Amount == 150.75m &&
            t.Type == TransactionType.Receive &&
            t.Source == TransactionSource.Import &&
            t.Status == TransactionStatus.Confirmed
        )), Times.Once);
    }

    [Fact]
    public async Task Import_InvalidRow_SkipsAndContinues()
    {
        var request = new BulkImportRequest(
            AccountId,
            new List<ImportTransactionRequest>
            {
                new("BadType", 100, "2024-01-15", null, null, null, null, null),
                new("Receive", 200, "2024-01-16", null, null, null, null, null)
            }
        );

        var result = await _sut.ImportAsync(UserId, request);

        result.SuccessCount.Should().Be(1);
        result.FailedCount.Should().Be(1);
    }

    [Fact]
    public async Task Import_CreatesMissingLabels_WhenFlagSet()
    {
        _labelService.Setup(s => s.CreateAsync(UserId, It.IsAny<CreateLabelRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<LabelResponse>.Success(
                new LabelResponse("new-lbl", "Groceries", null, "Category", "📁", "#6B7280", 0, false, false, DateTime.UtcNow)
            ));

        var request = new BulkImportRequest(
            AccountId,
            new List<ImportTransactionRequest>
            {
                new("Receive", 50, "2024-01-15", null, null, null, "Groceries", null)
            },
            CreateMissingLabels: true
        );

        var result = await _sut.ImportAsync(UserId, request);

        result.CreatedLabels.Should().Contain("Groceries");
        _labelService.Verify(s => s.CreateAsync(UserId,
            It.Is<CreateLabelRequest>(r => r.Name == "Groceries"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Import_CreatesMissingTags_WhenFlagSet()
    {
        _tagService.Setup(s => s.CreateAsync(UserId, It.IsAny<CreateTagRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<TagResponse>.Success(
                new TagResponse("new-tag", "vacation", "#6B7280", DateTime.UtcNow)
            ));

        var request = new BulkImportRequest(
            AccountId,
            new List<ImportTransactionRequest>
            {
                new("Receive", 50, "2024-01-15", null, null, null, null, new List<string> { "vacation" })
            },
            CreateMissingTags: true
        );

        var result = await _sut.ImportAsync(UserId, request);

        result.CreatedTags.Should().Contain("vacation");
        _tagService.Verify(s => s.CreateAsync(UserId,
            It.Is<CreateTagRequest>(r => r.Name == "vacation"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Import_SkipsDuplicates_WhenFlagSet()
    {
        _transactionRepo.Setup(r => r.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((new List<Transaction>
            {
                new()
                {
                    Id = "existing",
                    Date = new DateTime(2024, 1, 15),
                    Amount = 100m,
                    Type = TransactionType.Receive,
                    UserId = UserId,
                    AccountId = AccountId
                }
            }, 1));

        var request = new BulkImportRequest(
            AccountId,
            new List<ImportTransactionRequest>
            {
                new("Receive", 100, "2024-01-15", null, null, null, null, null)
            },
            SkipDuplicates: true
        );

        var result = await _sut.ImportAsync(UserId, request);

        result.SkippedDuplicates.Should().Be(1);
        result.SuccessCount.Should().Be(0);
    }

    // ───────── ParseAndPreviewAsync ─────────

    [Fact]
    public async Task ParseAndPreview_CsvContent_ParsesAndPreviews()
    {
        var csv = "date,amount,title\n2024-01-15,100,Salary";

        var request = new CsvParseRequest(
            AccountId: AccountId,
            CsvContent: csv,
            Base64Content: null
        );

        var result = await _sut.ParseAndPreviewAsync(UserId, request);

        result.TotalRows.Should().Be(1);
        result.ValidRows.Should().Be(1);
    }

    [Fact]
    public async Task ParseAndPreview_Base64Content_DecodesAndPreviews()
    {
        var csv = "date,amount,title\n2024-01-15,50,Gift";
        var base64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(csv));

        var request = new CsvParseRequest(
            AccountId: AccountId,
            CsvContent: null,
            Base64Content: base64
        );

        var result = await _sut.ParseAndPreviewAsync(UserId, request);

        result.TotalRows.Should().Be(1);
        result.ValidRows.Should().Be(1);
    }

    [Fact]
    public async Task ParseAndPreview_InvalidBase64_ReturnsEmpty()
    {
        var request = new CsvParseRequest(
            AccountId: AccountId,
            CsvContent: null,
            Base64Content: "not-valid-base64!!!"
        );

        var result = await _sut.ParseAndPreviewAsync(UserId, request);

        result.TotalRows.Should().Be(0);
    }

    [Fact]
    public async Task ParseAndPreview_NeitherContent_ReturnsEmpty()
    {
        var request = new CsvParseRequest(
            AccountId: AccountId,
            CsvContent: null,
            Base64Content: null
        );

        var result = await _sut.ParseAndPreviewAsync(UserId, request);

        result.TotalRows.Should().Be(0);
    }

    [Fact]
    public async Task ParseAndPreview_EmptyCsvRows_ReturnsEmpty()
    {
        var request = new CsvParseRequest(
            AccountId: AccountId,
            CsvContent: "date,amount",
            Base64Content: null
        );

        var result = await _sut.ParseAndPreviewAsync(UserId, request);

        result.TotalRows.Should().Be(0);
    }
}
