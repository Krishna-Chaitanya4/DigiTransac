using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

public interface ITagService
{
    Task<List<TagResponse>> GetAllAsync(string userId, CancellationToken ct = default);
    Task<TagResponse?> GetByIdAsync(string id, string userId, CancellationToken ct = default);
    Task<Result<TagResponse>> CreateAsync(string userId, CreateTagRequest request, CancellationToken ct = default);
    Task<Result<TagResponse>> UpdateAsync(string id, string userId, UpdateTagRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(string id, string userId, CancellationToken ct = default);
    Task<Result<DeleteWithCountResponse>> DeleteWithConfirmationAsync(string id, string userId, bool confirmed, CancellationToken ct = default);
    Task<int> GetTransactionCountAsync(string id, string userId, CancellationToken ct = default);
}

/// <summary>
/// Response DTO for delete operations that include a transaction count
/// </summary>
public record DeleteWithCountResponse(string Message, int TransactionCount);

public class TagService : ITagService
{
    private readonly ITagRepository _tagRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ILogger<TagService> _logger;

    public TagService(ITagRepository tagRepository, ITransactionRepository transactionRepository, ILogger<TagService> logger)
    {
        _tagRepository = tagRepository;
        _transactionRepository = transactionRepository;
        _logger = logger;
    }

    public async Task<List<TagResponse>> GetAllAsync(string userId, CancellationToken ct = default)
    {
        var tags = await _tagRepository.GetByUserIdAsync(userId, ct);
        return tags.Select(MapToResponse).ToList();
    }

    public async Task<TagResponse?> GetByIdAsync(string id, string userId, CancellationToken ct = default)
    {
        var tag = await _tagRepository.GetByIdAndUserIdAsync(id, userId, ct);
        return tag != null ? MapToResponse(tag) : null;
    }

    public async Task<Result<TagResponse>> CreateAsync(string userId, CreateTagRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Error.Validation("Name is required");

        // Check for duplicate name
        var existing = await _tagRepository.GetByNameAndUserIdAsync(request.Name.Trim(), userId, ct);
        if (existing != null)
            return Error.Conflict("Tag with this name already exists");

        var tag = new Tag
        {
            UserId = userId,
            Name = request.Name.Trim(),
            Color = request.Color
        };

        await _tagRepository.CreateAsync(tag, ct);
        _logger.LogInformation("Created tag {TagId} for user {UserId}", tag.Id, userId);

        return MapToResponse(tag);
    }

    public async Task<Result<TagResponse>> UpdateAsync(string id, string userId, UpdateTagRequest request, CancellationToken ct = default)
    {
        var tag = await _tagRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (tag == null)
            return DomainErrors.Tag.NotFound(id);

        if (string.IsNullOrWhiteSpace(request.Name))
            return Error.Validation("Name is required");

        // Check for duplicate name (excluding current tag)
        var existing = await _tagRepository.GetByNameAndUserIdAsync(request.Name.Trim(), userId, ct);
        if (existing != null && existing.Id != id)
            return Error.Conflict("Tag with this name already exists");

        tag.Name = request.Name.Trim();
        tag.Color = request.Color;

        await _tagRepository.UpdateAsync(tag, ct);
        _logger.LogInformation("Updated tag {TagId} for user {UserId}", id, userId);

        return MapToResponse(tag);
    }

    public async Task<Result> DeleteAsync(string id, string userId, CancellationToken ct = default)
    {
        var tag = await _tagRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (tag == null)
            return DomainErrors.Tag.NotFound(id);

        // Check if tag is used in transactions - require confirmation
        var transactionCount = await _transactionRepository.GetCountByTagIdAsync(id, userId);
        if (transactionCount > 0)
            return DomainErrors.Tag.HasTransactions(transactionCount);

        var deleted = await _tagRepository.DeleteAsync(id, userId, ct);
        if (!deleted)
            return Error.InternalError("Failed to delete tag");

        _logger.LogInformation("Deleted tag {TagId} for user {UserId}", id, userId);
        return Result.Success();
    }

    public async Task<int> GetTransactionCountAsync(string id, string userId, CancellationToken ct = default)
    {
        return await _transactionRepository.GetCountByTagIdAsync(id, userId);
    }

    public async Task<Result<DeleteWithCountResponse>> DeleteWithConfirmationAsync(string id, string userId, bool confirmed, CancellationToken ct = default)
    {
        var tag = await _tagRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (tag == null)
            return DomainErrors.Tag.NotFound(id);

        var transactionCount = await _transactionRepository.GetCountByTagIdAsync(id, userId);
        
        if (transactionCount > 0 && !confirmed)
        {
            // Return count so frontend can show confirmation
            return Error.Conflict($"This tag is used in {transactionCount} transaction(s). Confirm to remove it from all.");
        }

        if (transactionCount > 0)
        {
            // Remove tag from all transactions
            await _transactionRepository.RemoveTagFromAllAsync(id, userId);
            _logger.LogInformation("Removed tag {TagId} from {Count} transactions", id, transactionCount);
        }

        var deleted = await _tagRepository.DeleteAsync(id, userId, ct);
        if (!deleted)
            return Error.InternalError("Failed to delete tag");

        _logger.LogInformation("Deleted tag {TagId} for user {UserId}", id, userId);
        return new DeleteWithCountResponse($"Tag deleted successfully. Removed from {transactionCount} transaction(s).", transactionCount);
    }

    private static TagResponse MapToResponse(Tag tag)
    {
        return new TagResponse(
            tag.Id,
            tag.Name,
            tag.Color,
            tag.CreatedAt
        );
    }
}
