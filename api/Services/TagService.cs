using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

public interface ITagService
{
    Task<List<TagResponse>> GetAllAsync(string userId);
    Task<TagResponse?> GetByIdAsync(string id, string userId);
    Task<(bool Success, string Message, TagResponse? Tag)> CreateAsync(string userId, CreateTagRequest request);
    Task<(bool Success, string Message, TagResponse? Tag)> UpdateAsync(string id, string userId, UpdateTagRequest request);
    Task<(bool Success, string Message)> DeleteAsync(string id, string userId);
    Task<(bool Success, string Message, int TransactionCount)> DeleteWithConfirmationAsync(string id, string userId, bool confirmed);
    Task<int> GetTransactionCountAsync(string id, string userId);
}

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

    public async Task<List<TagResponse>> GetAllAsync(string userId)
    {
        var tags = await _tagRepository.GetByUserIdAsync(userId);
        return tags.Select(MapToResponse).ToList();
    }

    public async Task<TagResponse?> GetByIdAsync(string id, string userId)
    {
        var tag = await _tagRepository.GetByIdAndUserIdAsync(id, userId);
        return tag != null ? MapToResponse(tag) : null;
    }

    public async Task<(bool Success, string Message, TagResponse? Tag)> CreateAsync(string userId, CreateTagRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return (false, "Name is required", null);
        }

        // Check for duplicate name
        var existing = await _tagRepository.GetByNameAndUserIdAsync(request.Name.Trim(), userId);
        if (existing != null)
        {
            return (false, "Tag with this name already exists", null);
        }

        var tag = new Tag
        {
            UserId = userId,
            Name = request.Name.Trim(),
            Color = request.Color
        };

        await _tagRepository.CreateAsync(tag);
        _logger.LogInformation("Created tag {TagId} for user {UserId}", tag.Id, userId);

        return (true, "Tag created successfully", MapToResponse(tag));
    }

    public async Task<(bool Success, string Message, TagResponse? Tag)> UpdateAsync(string id, string userId, UpdateTagRequest request)
    {
        var tag = await _tagRepository.GetByIdAndUserIdAsync(id, userId);
        if (tag == null)
        {
            return (false, "Tag not found", null);
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return (false, "Name is required", null);
        }

        // Check for duplicate name (excluding current tag)
        var existing = await _tagRepository.GetByNameAndUserIdAsync(request.Name.Trim(), userId);
        if (existing != null && existing.Id != id)
        {
            return (false, "Tag with this name already exists", null);
        }

        tag.Name = request.Name.Trim();
        tag.Color = request.Color;

        await _tagRepository.UpdateAsync(tag);
        _logger.LogInformation("Updated tag {TagId} for user {UserId}", id, userId);

        return (true, "Tag updated successfully", MapToResponse(tag));
    }

    public async Task<(bool Success, string Message)> DeleteAsync(string id, string userId)
    {
        var tag = await _tagRepository.GetByIdAndUserIdAsync(id, userId);
        if (tag == null)
        {
            return (false, "Tag not found");
        }

        // Check if tag is used in transactions - require confirmation
        var transactionCount = await _transactionRepository.GetCountByTagIdAsync(id, userId);
        if (transactionCount > 0)
        {
            return (false, $"This tag is used in {transactionCount} transaction(s). Please confirm to remove it from all transactions.");
        }

        var deleted = await _tagRepository.DeleteAsync(id, userId);
        if (!deleted)
        {
            return (false, "Failed to delete tag");
        }

        _logger.LogInformation("Deleted tag {TagId} for user {UserId}", id, userId);
        return (true, "Tag deleted successfully");
    }

    public async Task<int> GetTransactionCountAsync(string id, string userId)
    {
        return await _transactionRepository.GetCountByTagIdAsync(id, userId);
    }

    public async Task<(bool Success, string Message, int TransactionCount)> DeleteWithConfirmationAsync(string id, string userId, bool confirmed)
    {
        var tag = await _tagRepository.GetByIdAndUserIdAsync(id, userId);
        if (tag == null)
        {
            return (false, "Tag not found", 0);
        }

        var transactionCount = await _transactionRepository.GetCountByTagIdAsync(id, userId);
        
        if (transactionCount > 0 && !confirmed)
        {
            // Return count so frontend can show confirmation
            return (false, $"This tag is used in {transactionCount} transaction(s). Confirm to remove it from all.", transactionCount);
        }

        if (transactionCount > 0)
        {
            // Remove tag from all transactions
            await _transactionRepository.RemoveTagFromAllAsync(id, userId);
            _logger.LogInformation("Removed tag {TagId} from {Count} transactions", id, transactionCount);
        }

        var deleted = await _tagRepository.DeleteAsync(id, userId);
        if (!deleted)
        {
            return (false, "Failed to delete tag", 0);
        }

        _logger.LogInformation("Deleted tag {TagId} for user {UserId}", id, userId);
        return (true, $"Tag deleted successfully. Removed from {transactionCount} transaction(s).", transactionCount);
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
