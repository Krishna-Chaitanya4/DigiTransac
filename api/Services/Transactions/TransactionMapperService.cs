using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Implementation of transaction mapping service.
/// Handles all DTO mapping and encryption/decryption operations.
/// </summary>
public class TransactionMapperService : ITransactionMapperService
{
    private readonly IUserRepository _userRepository;
    private readonly IKeyManagementService _keyManagementService;
    private readonly IDekCacheService _dekCacheService;
    private readonly IEncryptionService _encryptionService;

    public TransactionMapperService(
        IUserRepository userRepository,
        IKeyManagementService keyManagementService,
        IDekCacheService dekCacheService,
        IEncryptionService encryptionService)
    {
        _userRepository = userRepository;
        _keyManagementService = keyManagementService;
        _dekCacheService = dekCacheService;
        _encryptionService = encryptionService;
    }

    public async Task<byte[]?> GetUserDekAsync(string userId)
    {
        var cachedDek = _dekCacheService.GetDek(userId);
        if (cachedDek != null) return cachedDek;

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null) return null;

        // If user doesn't have a DEK, generate one (migration for existing users)
        if (user.WrappedDek == null)
        {
            var newDek = _keyManagementService.GenerateDek();
            var wrappedDek = await _keyManagementService.WrapKeyAsync(newDek);
            user.WrappedDek = wrappedDek;
            await _userRepository.UpdateAsync(user);
            _dekCacheService.SetDek(userId, newDek);
            return newDek;
        }

        var dek = await _keyManagementService.UnwrapKeyAsync(user.WrappedDek);
        _dekCacheService.SetDek(userId, dek);
        return dek;
    }

    public string? EncryptIfNotEmpty(string? value, byte[] dek)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return _encryptionService.Encrypt(value, dek);
    }

    public string? DecryptIfNotEmpty(string? value, byte[] dek)
    {
        if (string.IsNullOrEmpty(value)) return value;
        try { return _encryptionService.Decrypt(value, dek); }
        catch { return value; }
    }

    public TransactionResponse MapToResponse(
        Transaction t,
        byte[]? dek,
        Dictionary<string, Account> accounts,
        Dictionary<string, Label> labels,
        Dictionary<string, Tag> tags,
        Dictionary<string, User>? counterpartyUsers = null)
    {
        Account? account = null;
        if (!string.IsNullOrEmpty(t.AccountId))
            accounts.TryGetValue(t.AccountId, out account);
        accounts.TryGetValue(t.TransferToAccountId ?? "", out var transferToAccount);

        // Map tag IDs to tag info with names
        var tagInfos = t.TagIds
            .Select(tagId => tags.TryGetValue(tagId, out var tag)
                ? new TagInfo(tagId, tag.Name, tag.Color)
                : new TagInfo(tagId, "Unknown", null))
            .ToList();

        // Resolve counterparty email from UserId
        string? counterpartyEmail = null;
        if (!string.IsNullOrEmpty(t.CounterpartyUserId) && counterpartyUsers != null)
        {
            counterpartyUsers.TryGetValue(t.CounterpartyUserId, out var counterpartyUser);
            counterpartyEmail = counterpartyUser?.Email;
        }

        return new TransactionResponse(
            t.Id,
            t.AccountId,
            account?.Name,
            t.Type.ToString(),
            t.Amount,
            t.Currency,
            t.Date,
            t.Title,
            dek != null ? DecryptIfNotEmpty(t.EncryptedPayee, dek) : null,
            dek != null ? DecryptIfNotEmpty(t.EncryptedNotes, dek) : null,
            t.Splits.Select(s => MapSplitToResponse(s, dek, labels)).ToList(),
            t.TagIds,
            tagInfos,
            MapLocationToResponse(t.Location, dek),
            t.TransferToAccountId,
            transferToAccount?.Name,
            t.LinkedTransactionId,
            t.RecurringRule != null ? new RecurringRuleResponse(
                t.RecurringRule.Frequency.ToString(),
                t.RecurringRule.Interval,
                t.RecurringRule.EndDate,
                t.RecurringRule.NextOccurrence) : null,
            t.ParentTransactionId,
            t.IsRecurringTemplate,
            t.Status.ToString(),
            t.CreatedAt,
            t.UpdatedAt,
            t.TransactionLinkId,
            counterpartyEmail,
            t.CounterpartyUserId,
            // Derive role from type for P2P/transfer transactions (has counterparty)
            t.CounterpartyUserId != null
                ? (t.Type == TransactionType.Send ? "Sender" : "Receiver")
                : null,
            t.LastSyncedAt,
            t.ChatMessageId,
            // Timezone-aware date/time fields (for global travel support & analytics)
            t.DateLocal,
            t.TimeLocal,
            t.DateTimezone);
    }

    public RecurringTransactionResponse MapToRecurringResponse(
        Transaction t,
        byte[]? dek,
        Dictionary<string, Account> accounts,
        Dictionary<string, Label> labels)
    {
        Account? account = null;
        if (!string.IsNullOrEmpty(t.AccountId))
            accounts.TryGetValue(t.AccountId, out account);

        return new RecurringTransactionResponse(
            t.Id,
            t.AccountId,
            account?.Name,
            t.Type.ToString(),
            t.Amount,
            t.Currency,
            t.Title,
            dek != null ? DecryptIfNotEmpty(t.EncryptedPayee, dek) : null,
            t.Splits.Select(s => MapSplitToResponse(s, dek, labels)).ToList(),
            new RecurringRuleResponse(
                t.RecurringRule!.Frequency.ToString(),
                t.RecurringRule.Interval,
                t.RecurringRule.EndDate,
                t.RecurringRule.NextOccurrence),
            t.CreatedAt);
    }

    public TransactionSplitResponse MapSplitToResponse(
        TransactionSplit split,
        byte[]? dek,
        Dictionary<string, Label> labels)
    {
        labels.TryGetValue(split.LabelId, out var label);
        return new TransactionSplitResponse(
            split.LabelId,
            label?.Name,
            label?.Color,
            label?.Icon,
            split.Amount,
            split.Notes);
    }

    public TransactionLocationResponse? MapLocationToResponse(
        TransactionLocation? location,
        byte[]? dek)
    {
        if (location == null) return null;

        double longitude = 0;
        if (dek != null && !string.IsNullOrEmpty(location.EncryptedLongitude))
        {
            var decrypted = DecryptIfNotEmpty(location.EncryptedLongitude, dek);
            double.TryParse(decrypted, out longitude);
        }

        return new TransactionLocationResponse(
            location.Latitude,
            longitude,
            dek != null ? DecryptIfNotEmpty(location.EncryptedPlaceName, dek) : null,
            location.City,
            location.Country);
    }
}