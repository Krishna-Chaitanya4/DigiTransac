using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Transactions;
using FluentAssertions;
using Moq;

namespace DigiTransac.Tests.Services;

public class TransactionMapperServiceTests
{
    private readonly Mock<IUserRepository> _userRepoMock;
    private readonly Mock<IKeyManagementService> _keyManagementServiceMock;
    private readonly Mock<IDekCacheService> _dekCacheServiceMock;
    private readonly Mock<IEncryptionService> _encryptionServiceMock;
    private readonly TransactionMapperService _sut;
    private const string UserId = "user-123";
    private readonly byte[] _testDek = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 };

    public TransactionMapperServiceTests()
    {
        _userRepoMock = new Mock<IUserRepository>();
        _keyManagementServiceMock = new Mock<IKeyManagementService>();
        _dekCacheServiceMock = new Mock<IDekCacheService>();
        _encryptionServiceMock = new Mock<IEncryptionService>();

        // Default: encrypt returns "encrypted_" + value, decrypt returns "decrypted_" + value
        _encryptionServiceMock.Setup(x => x.Encrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
            .Returns((string val, byte[] _) => $"encrypted_{val}");
        _encryptionServiceMock.Setup(x => x.Decrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
            .Returns((string val, byte[] _) => $"decrypted_{val}");

        _sut = new TransactionMapperService(
            _userRepoMock.Object,
            _keyManagementServiceMock.Object,
            _dekCacheServiceMock.Object,
            _encryptionServiceMock.Object);
    }

    // ========================================================================
    // GetUserDekAsync
    // ========================================================================

    [Fact]
    public async Task GetUserDekAsync_CacheHit_ReturnsCachedDek()
    {
        _dekCacheServiceMock.Setup(x => x.GetDek(UserId)).Returns(_testDek);

        var result = await _sut.GetUserDekAsync(UserId);

        result.Should().BeSameAs(_testDek);
        _userRepoMock.Verify(x => x.GetByIdAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task GetUserDekAsync_CacheMiss_UnwrapsAndCachesKey()
    {
        var wrappedDek = new byte[] { 10, 20, 30 };
        var unwrappedDek = new byte[] { 1, 2, 3 };

        _dekCacheServiceMock.Setup(x => x.GetDek(UserId)).Returns((byte[]?)null);
        _userRepoMock.Setup(x => x.GetByIdAsync(UserId))
            .ReturnsAsync(new User { Id = UserId, WrappedDek = wrappedDek });
        _keyManagementServiceMock.Setup(x => x.UnwrapKeyAsync(wrappedDek))
            .ReturnsAsync(unwrappedDek);

        var result = await _sut.GetUserDekAsync(UserId);

        result.Should().BeEquivalentTo(unwrappedDek);
        _dekCacheServiceMock.Verify(x => x.SetDek(UserId, unwrappedDek), Times.Once);
    }

    [Fact]
    public async Task GetUserDekAsync_UserNotFound_ReturnsNull()
    {
        _dekCacheServiceMock.Setup(x => x.GetDek(UserId)).Returns((byte[]?)null);
        _userRepoMock.Setup(x => x.GetByIdAsync(UserId)).ReturnsAsync((User?)null);

        var result = await _sut.GetUserDekAsync(UserId);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetUserDekAsync_UserWithoutWrappedDek_GeneratesNewDek()
    {
        var newDek = new byte[] { 5, 6, 7 };
        var wrappedNewDek = new byte[] { 50, 60, 70 };

        _dekCacheServiceMock.Setup(x => x.GetDek(UserId)).Returns((byte[]?)null);
        _userRepoMock.Setup(x => x.GetByIdAsync(UserId))
            .ReturnsAsync(new User { Id = UserId, WrappedDek = null });
        _keyManagementServiceMock.Setup(x => x.GenerateDek()).Returns(newDek);
        _keyManagementServiceMock.Setup(x => x.WrapKeyAsync(newDek)).ReturnsAsync(wrappedNewDek);

        var result = await _sut.GetUserDekAsync(UserId);

        result.Should().BeEquivalentTo(newDek);
        _userRepoMock.Verify(x => x.UpdateAsync(It.Is<User>(u => u.WrappedDek == wrappedNewDek)), Times.Once);
        _dekCacheServiceMock.Verify(x => x.SetDek(UserId, newDek), Times.Once);
    }

    // ========================================================================
    // EncryptIfNotEmpty / DecryptIfNotEmpty
    // ========================================================================

    [Fact]
    public void EncryptIfNotEmpty_NullInput_ReturnsNull()
    {
        var result = _sut.EncryptIfNotEmpty(null, _testDek);
        result.Should().BeNull();
    }

    [Fact]
    public void EncryptIfNotEmpty_EmptyString_ReturnsEmpty()
    {
        var result = _sut.EncryptIfNotEmpty("", _testDek);
        result.Should().BeEmpty();
    }

    [Fact]
    public void EncryptIfNotEmpty_ValidValue_ReturnsEncrypted()
    {
        var result = _sut.EncryptIfNotEmpty("secret", _testDek);
        result.Should().Be("encrypted_secret");
    }

    [Fact]
    public void DecryptIfNotEmpty_NullInput_ReturnsNull()
    {
        var result = _sut.DecryptIfNotEmpty(null, _testDek);
        result.Should().BeNull();
    }

    [Fact]
    public void DecryptIfNotEmpty_EmptyString_ReturnsEmpty()
    {
        var result = _sut.DecryptIfNotEmpty("", _testDek);
        result.Should().BeEmpty();
    }

    [Fact]
    public void DecryptIfNotEmpty_ValidValue_ReturnsDecrypted()
    {
        var result = _sut.DecryptIfNotEmpty("ciphertext", _testDek);
        result.Should().Be("decrypted_ciphertext");
    }

    [Fact]
    public void DecryptIfNotEmpty_DecryptionFails_ReturnsOriginalValue()
    {
        _encryptionServiceMock.Setup(x => x.Decrypt("bad-data", It.IsAny<byte[]>()))
            .Throws(new Exception("Decryption error"));

        var result = _sut.DecryptIfNotEmpty("bad-data", _testDek);
        result.Should().Be("bad-data"); // Falls back to original
    }

    // ========================================================================
    // MapToResponse
    // ========================================================================

    [Fact]
    public void MapToResponse_BasicTransaction_MapsAllFields()
    {
        var transaction = CreateTransaction("txn-1");
        var accounts = new Dictionary<string, Account>
        {
            { "acc-1", new Account { Id = "acc-1", Name = "Savings", Currency = "INR" } }
        };
        var labels = new Dictionary<string, Label>
        {
            { "label-1", new Label { Id = "label-1", Name = "Food", Color = "#ff0000", Icon = "food-icon" } }
        };
        var tags = new Dictionary<string, Tag>();

        var result = _sut.MapToResponse(transaction, _testDek, accounts, labels, tags);

        result.Id.Should().Be("txn-1");
        result.AccountId.Should().Be("acc-1");
        result.AccountName.Should().Be("Savings");
        result.Type.Should().Be("Send");
        result.Amount.Should().Be(100m);
        result.Currency.Should().Be("INR");
        result.Title.Should().Be("Lunch");
    }

    [Fact]
    public void MapToResponse_WithEncryptedFields_DecryptsPayeeAndNotes()
    {
        var transaction = CreateTransaction("txn-1");
        transaction.EncryptedPayee = "enc_payee";
        transaction.EncryptedNotes = "enc_notes";

        var accounts = new Dictionary<string, Account>();
        var labels = new Dictionary<string, Label>();
        var tags = new Dictionary<string, Tag>();

        var result = _sut.MapToResponse(transaction, _testDek, accounts, labels, tags);

        result.Payee.Should().Be("decrypted_enc_payee");
        result.Notes.Should().Be("decrypted_enc_notes");
    }

    [Fact]
    public void MapToResponse_NullDek_DoesNotDecrypt()
    {
        var transaction = CreateTransaction("txn-1");
        transaction.EncryptedPayee = "enc_payee";

        var accounts = new Dictionary<string, Account>();
        var labels = new Dictionary<string, Label>();
        var tags = new Dictionary<string, Tag>();

        var result = _sut.MapToResponse(transaction, null, accounts, labels, tags);

        result.Payee.Should().BeNull();
        result.Notes.Should().BeNull();
    }

    [Fact]
    public void MapToResponse_WithTags_MapsTagInfo()
    {
        var transaction = CreateTransaction("txn-1");
        transaction.TagIds = new List<string> { "tag-1", "tag-2" };

        var accounts = new Dictionary<string, Account>();
        var labels = new Dictionary<string, Label>();
        var tags = new Dictionary<string, Tag>
        {
            { "tag-1", new Tag { Id = "tag-1", Name = "Important", Color = "#00ff00" } },
            { "tag-2", new Tag { Id = "tag-2", Name = "Business", Color = "#0000ff" } }
        };

        var result = _sut.MapToResponse(transaction, _testDek, accounts, labels, tags);

        result.Tags.Should().HaveCount(2);
        result.Tags[0].Name.Should().Be("Important");
        result.Tags[1].Name.Should().Be("Business");
    }

    [Fact]
    public void MapToResponse_UnknownTag_SetsNameToUnknown()
    {
        var transaction = CreateTransaction("txn-1");
        transaction.TagIds = new List<string> { "missing-tag" };

        var accounts = new Dictionary<string, Account>();
        var labels = new Dictionary<string, Label>();
        var tags = new Dictionary<string, Tag>();

        var result = _sut.MapToResponse(transaction, _testDek, accounts, labels, tags);

        result.Tags.Should().HaveCount(1);
        result.Tags[0].Name.Should().Be("Unknown");
    }

    [Fact]
    public void MapToResponse_WithCounterpartyUserId_ResolvesEmailAndRole()
    {
        var transaction = CreateTransaction("txn-1");
        transaction.CounterpartyUserId = "other-user";
        transaction.Type = TransactionType.Send;

        var accounts = new Dictionary<string, Account>();
        var labels = new Dictionary<string, Label>();
        var tags = new Dictionary<string, Tag>();
        var counterpartyUsers = new Dictionary<string, User>
        {
            { "other-user", new User { Id = "other-user", Email = "other@test.com" } }
        };

        var result = _sut.MapToResponse(transaction, _testDek, accounts, labels, tags, counterpartyUsers);

        result.CounterpartyEmail.Should().Be("other@test.com");
        result.Role.Should().Be("Sender");
    }

    [Fact]
    public void MapToResponse_ReceiverType_SetsRoleReceiver()
    {
        var transaction = CreateTransaction("txn-1");
        transaction.CounterpartyUserId = "other-user";
        transaction.Type = TransactionType.Receive;

        var accounts = new Dictionary<string, Account>();
        var labels = new Dictionary<string, Label>();
        var tags = new Dictionary<string, Tag>();
        var counterpartyUsers = new Dictionary<string, User>
        {
            { "other-user", new User { Id = "other-user", Email = "other@test.com" } }
        };

        var result = _sut.MapToResponse(transaction, _testDek, accounts, labels, tags, counterpartyUsers);

        result.Role.Should().Be("Receiver");
    }

    [Fact]
    public void MapToResponse_NoCounterparty_RoleIsNull()
    {
        var transaction = CreateTransaction("txn-1");
        transaction.CounterpartyUserId = null;

        var accounts = new Dictionary<string, Account>();
        var labels = new Dictionary<string, Label>();
        var tags = new Dictionary<string, Tag>();

        var result = _sut.MapToResponse(transaction, _testDek, accounts, labels, tags);

        result.Role.Should().BeNull();
    }

    [Fact]
    public void MapToResponse_WithTransferAccount_MapsTransferName()
    {
        var transaction = CreateTransaction("txn-1");
        transaction.TransferToAccountId = "acc-2";

        var accounts = new Dictionary<string, Account>
        {
            { "acc-1", new Account { Id = "acc-1", Name = "Savings" } },
            { "acc-2", new Account { Id = "acc-2", Name = "Checking" } }
        };
        var labels = new Dictionary<string, Label>();
        var tags = new Dictionary<string, Tag>();

        var result = _sut.MapToResponse(transaction, _testDek, accounts, labels, tags);

        result.TransferToAccountName.Should().Be("Checking");
    }

    // ========================================================================
    // MapSplitToResponse
    // ========================================================================

    [Fact]
    public void MapSplitToResponse_WithLabel_MapsLabelInfo()
    {
        var split = new TransactionSplit { LabelId = "label-1", Amount = 50m, Notes = "half" };
        var labels = new Dictionary<string, Label>
        {
            { "label-1", new Label { Id = "label-1", Name = "Food", Color = "#ff0000", Icon = "food-icon" } }
        };

        var result = _sut.MapSplitToResponse(split, _testDek, labels);

        result.LabelId.Should().Be("label-1");
        result.LabelName.Should().Be("Food");
        result.LabelColor.Should().Be("#ff0000");
        result.Amount.Should().Be(50m);
    }

    [Fact]
    public void MapSplitToResponse_UnknownLabel_SetsNullName()
    {
        var split = new TransactionSplit { LabelId = "missing", Amount = 100m };
        var labels = new Dictionary<string, Label>();

        var result = _sut.MapSplitToResponse(split, _testDek, labels);

        result.LabelName.Should().BeNull();
    }

    // ========================================================================
    // MapLocationToResponse
    // ========================================================================

    [Fact]
    public void MapLocationToResponse_NullLocation_ReturnsNull()
    {
        var result = _sut.MapLocationToResponse(null, _testDek);
        result.Should().BeNull();
    }

    [Fact]
    public void MapLocationToResponse_ValidLocation_DecryptsFields()
    {
        _encryptionServiceMock.Setup(x => x.Decrypt("enc_lng", It.IsAny<byte[]>())).Returns("77.5946");
        _encryptionServiceMock.Setup(x => x.Decrypt("enc_place", It.IsAny<byte[]>())).Returns("MG Road");

        var location = new TransactionLocation
        {
            Latitude = 12.9716,
            EncryptedLongitude = "enc_lng",
            EncryptedPlaceName = "enc_place",
            City = "Bangalore",
            Country = "India"
        };

        var result = _sut.MapLocationToResponse(location, _testDek);

        result.Should().NotBeNull();
        result!.Latitude.Should().Be(12.9716);
        result.Longitude.Should().BeApproximately(77.5946, 0.001);
        result.PlaceName.Should().Be("MG Road");
        result.City.Should().Be("Bangalore");
        result.Country.Should().Be("India");
    }

    [Fact]
    public void MapLocationToResponse_NullDek_DoesNotDecrypt()
    {
        var location = new TransactionLocation
        {
            Latitude = 12.9716,
            EncryptedLongitude = "enc_lng",
            City = "Bangalore"
        };

        var result = _sut.MapLocationToResponse(location, null);

        result.Should().NotBeNull();
        result!.Longitude.Should().Be(0); // Not decrypted
        result.PlaceName.Should().BeNull();
    }

    // ========================================================================
    // MapToRecurringResponse
    // ========================================================================

    [Fact]
    public void MapToRecurringResponse_MapsRuleFields()
    {
        var nextOccurrence = DateTime.UtcNow.AddDays(7);
        var transaction = CreateTransaction("txn-1");
        transaction.IsRecurringTemplate = true;
        transaction.RecurringRule = new RecurringRule
        {
            Frequency = RecurrenceFrequency.Weekly,
            Interval = 2,
            EndDate = DateTime.UtcNow.AddMonths(6),
            NextOccurrence = nextOccurrence
        };

        var accounts = new Dictionary<string, Account>
        {
            { "acc-1", new Account { Id = "acc-1", Name = "Savings" } }
        };
        var labels = new Dictionary<string, Label>
        {
            { "label-1", new Label { Id = "label-1", Name = "Food", Color = "#ff0000", Icon = "food-icon" } }
        };

        var result = _sut.MapToRecurringResponse(transaction, _testDek, accounts, labels);

        result.Id.Should().Be("txn-1");
        result.AccountName.Should().Be("Savings");
        result.RecurringRule.Frequency.Should().Be("Weekly");
        result.RecurringRule.Interval.Should().Be(2);
        result.RecurringRule.NextOccurrence.Should().Be(nextOccurrence);
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private static Transaction CreateTransaction(string id) => new()
    {
        Id = id,
        UserId = UserId,
        AccountId = "acc-1",
        Type = TransactionType.Send,
        Amount = 100m,
        Currency = "INR",
        Date = DateTime.UtcNow,
        Title = "Lunch",
        Splits = new List<TransactionSplit>
        {
            new() { LabelId = "label-1", Amount = 100m }
        },
        TagIds = new List<string>(),
        Status = TransactionStatus.Confirmed,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };
}
