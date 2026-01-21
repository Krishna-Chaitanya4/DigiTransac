using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

public interface ILabelService
{
    Task<List<LabelResponse>> GetAllAsync(string userId);
    Task<List<LabelTreeResponse>> GetTreeAsync(string userId);
    Task<LabelResponse?> GetByIdAsync(string id, string userId);
    Task<(bool Success, string Message, LabelResponse? Label)> CreateAsync(string userId, CreateLabelRequest request);
    Task<(bool Success, string Message, LabelResponse? Label)> UpdateAsync(string id, string userId, UpdateLabelRequest request);
    Task<(bool Success, string Message)> DeleteAsync(string id, string userId);
    Task<(bool Success, string Message, int TransactionCount)> DeleteWithReassignmentAsync(string id, string userId, string? reassignToLabelId);
    Task<int> GetTransactionCountAsync(string id, string userId);
    Task<(bool Success, string Message)> ReorderAsync(string userId, ReorderLabelsRequest request);
    Task CreateDefaultLabelsAsync(string userId);
}

public class LabelService : ILabelService
{
    private readonly ILabelRepository _labelRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ILogger<LabelService> _logger;

    public LabelService(ILabelRepository labelRepository, ITransactionRepository transactionRepository, ILogger<LabelService> logger)
    {
        _labelRepository = labelRepository;
        _transactionRepository = transactionRepository;
        _logger = logger;
    }

    public async Task<List<LabelResponse>> GetAllAsync(string userId)
    {
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        return labels.Select(MapToResponse).ToList();
    }

    public async Task<List<LabelTreeResponse>> GetTreeAsync(string userId)
    {
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        return BuildTree(labels, null);
    }

    public async Task<LabelResponse?> GetByIdAsync(string id, string userId)
    {
        var label = await _labelRepository.GetByIdAndUserIdAsync(id, userId);
        return label != null ? MapToResponse(label) : null;
    }

    public async Task<(bool Success, string Message, LabelResponse? Label)> CreateAsync(string userId, CreateLabelRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return (false, "Name is required", null);
        }

        // Parse type
        if (!Enum.TryParse<LabelType>(request.Type, true, out var labelType))
        {
            return (false, "Invalid type. Must be 'Folder' or 'Category'", null);
        }

        // Validate parent exists if specified
        if (!string.IsNullOrEmpty(request.ParentId))
        {
            var parent = await _labelRepository.GetByIdAndUserIdAsync(request.ParentId, userId);
            if (parent == null)
            {
                return (false, "Parent not found", null);
            }
            if (parent.Type != LabelType.Folder)
            {
                return (false, "Parent must be a folder", null);
            }
        }

        var label = new Label
        {
            UserId = userId,
            Name = request.Name.Trim(),
            ParentId = request.ParentId,
            Type = labelType,
            Icon = request.Icon,
            Color = request.Color,
            Order = 0,
            IsSystem = false
        };

        await _labelRepository.CreateAsync(label);
        _logger.LogInformation("Created label {LabelId} for user {UserId}", label.Id, userId);

        return (true, "Label created successfully", MapToResponse(label));
    }

    public async Task<(bool Success, string Message, LabelResponse? Label)> UpdateAsync(string id, string userId, UpdateLabelRequest request)
    {
        var label = await _labelRepository.GetByIdAndUserIdAsync(id, userId);
        if (label == null)
        {
            return (false, "Label not found", null);
        }

        // System labels cannot be renamed or moved
        if (label.IsSystem)
        {
            if (request.Name?.Trim() != label.Name)
            {
                return (false, "System labels cannot be renamed", null);
            }
            if (request.ParentId != label.ParentId)
            {
                return (false, "System labels cannot be moved", null);
            }
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return (false, "Name is required", null);
        }

        // Validate parent if changing
        if (request.ParentId != label.ParentId && !string.IsNullOrEmpty(request.ParentId))
        {
            // Can't set self as parent
            if (request.ParentId == id)
            {
                return (false, "Cannot set label as its own parent", null);
            }

            var parent = await _labelRepository.GetByIdAndUserIdAsync(request.ParentId, userId);
            if (parent == null)
            {
                return (false, "Parent not found", null);
            }
            if (parent.Type != LabelType.Folder)
            {
                return (false, "Parent must be a folder", null);
            }

            // Check for circular reference (can't move folder under its own descendant)
            if (label.Type == LabelType.Folder && await IsDescendantAsync(request.ParentId, id, userId))
            {
                return (false, "Cannot move folder under its own descendant", null);
            }
        }

        label.Name = request.Name.Trim();
        label.ParentId = request.ParentId;
        label.Icon = request.Icon;
        label.Color = request.Color;
        if (request.Order.HasValue)
        {
            label.Order = request.Order.Value;
        }

        await _labelRepository.UpdateAsync(label);
        _logger.LogInformation("Updated label {LabelId} for user {UserId}", id, userId);

        return (true, "Label updated successfully", MapToResponse(label));
    }

    public async Task<(bool Success, string Message)> DeleteAsync(string id, string userId)
    {
        var label = await _labelRepository.GetByIdAndUserIdAsync(id, userId);
        if (label == null)
        {
            return (false, "Label not found");
        }

        // System labels cannot be deleted
        if (label.IsSystem)
        {
            return (false, "System labels cannot be deleted");
        }

        // Check if folder has children
        if (label.Type == LabelType.Folder)
        {
            var hasChildren = await _labelRepository.HasChildrenAsync(id, userId);
            if (hasChildren)
            {
                return (false, "Cannot delete folder with children. Delete or move children first.");
            }
        }

        // Check if label is used in transactions - require reassignment
        var transactionCount = await _transactionRepository.GetCountByLabelIdAsync(id, userId);
        if (transactionCount > 0)
        {
            return (false, $"Cannot delete label with {transactionCount} transaction(s). Please reassign them first.");
        }

        var deleted = await _labelRepository.DeleteAsync(id, userId);
        if (!deleted)
        {
            return (false, "Failed to delete label");
        }

        _logger.LogInformation("Deleted label {LabelId} for user {UserId}", id, userId);
        return (true, "Label deleted successfully");
    }

    public async Task<int> GetTransactionCountAsync(string id, string userId)
    {
        return await _transactionRepository.GetCountByLabelIdAsync(id, userId);
    }

    public async Task<(bool Success, string Message, int TransactionCount)> DeleteWithReassignmentAsync(string id, string userId, string? reassignToLabelId)
    {
        var label = await _labelRepository.GetByIdAndUserIdAsync(id, userId);
        if (label == null)
        {
            return (false, "Label not found", 0);
        }

        // System labels cannot be deleted
        if (label.IsSystem)
        {
            return (false, "System labels cannot be deleted", 0);
        }

        // Check if folder has children
        if (label.Type == LabelType.Folder)
        {
            var hasChildren = await _labelRepository.HasChildrenAsync(id, userId);
            if (hasChildren)
            {
                return (false, "Cannot delete folder with children. Delete or move children first.", 0);
            }
        }

        var transactionCount = await _transactionRepository.GetCountByLabelIdAsync(id, userId);
        
        if (transactionCount > 0)
        {
            if (string.IsNullOrEmpty(reassignToLabelId))
            {
                // Return count so frontend can show reassignment modal
                return (false, $"This label has {transactionCount} transaction(s). Please select a label to reassign them to.", transactionCount);
            }

            // Validate target label exists
            var targetLabel = await _labelRepository.GetByIdAndUserIdAsync(reassignToLabelId, userId);
            if (targetLabel == null)
            {
                return (false, "Target label not found", transactionCount);
            }

            if (targetLabel.Type != LabelType.Category)
            {
                return (false, "Can only reassign to a category, not a folder", transactionCount);
            }

            // Reassign all transactions to the target label
            await _transactionRepository.ReassignLabelAsync(id, reassignToLabelId, userId);
            _logger.LogInformation("Reassigned {Count} transactions from label {FromId} to {ToId}", transactionCount, id, reassignToLabelId);
        }

        var deleted = await _labelRepository.DeleteAsync(id, userId);
        if (!deleted)
        {
            return (false, "Failed to delete label", 0);
        }

        _logger.LogInformation("Deleted label {LabelId} for user {UserId}", id, userId);
        return (true, $"Label deleted successfully. {transactionCount} transaction(s) reassigned.", transactionCount);
    }

    public async Task<(bool Success, string Message)> ReorderAsync(string userId, ReorderLabelsRequest request)
    {
        foreach (var item in request.Items)
        {
            var label = await _labelRepository.GetByIdAndUserIdAsync(item.Id, userId);
            if (label != null)
            {
                label.Order = item.Order;
                await _labelRepository.UpdateAsync(label);
            }
        }

        return (true, "Labels reordered successfully");
    }

    public async Task CreateDefaultLabelsAsync(string userId)
    {
        var labels = new List<Label>();
        var order = 0;

        // Helper to create folder
        // Only root folders (parentId = null) are marked as system labels
        Label CreateFolder(string name, string? parentId = null, string? icon = null, string? color = null)
        {
            var folder = new Label
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                UserId = userId,
                Name = name,
                ParentId = parentId,
                Type = LabelType.Folder,
                Icon = icon,
                Color = color,
                Order = order++,
                IsSystem = parentId == null  // Only root folders are system labels
            };
            labels.Add(folder);
            return folder;
        }

        // Helper to create category (categories are never system labels)
        void CreateCategory(string name, string parentId, string? icon = null, string? color = null)
        {
            labels.Add(new Label
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                UserId = userId,
                Name = name,
                ParentId = parentId,
                Type = LabelType.Category,
                Icon = icon,
                Color = color,
                Order = order++,
                IsSystem = false
            });
        }

        // Expenses
        var expenses = CreateFolder("Expenses", null, "💸", "#ef4444");
        {
            var food = CreateFolder("Food & Dining", expenses.Id, "🍽️");
            CreateCategory("Restaurants", food.Id, "🍕");
            CreateCategory("Groceries", food.Id, "🛒");
            CreateCategory("Coffee & Snacks", food.Id, "☕");
            CreateCategory("Food Delivery", food.Id, "🛵");

            var transport = CreateFolder("Transport", expenses.Id, "🚗");
            CreateCategory("Fuel", transport.Id, "⛽");
            CreateCategory("Public Transport", transport.Id, "🚌");
            CreateCategory("Cab/Taxi", transport.Id, "🚕");
            CreateCategory("Parking", transport.Id, "🅿️");

            var shopping = CreateFolder("Shopping", expenses.Id, "🛍️");
            CreateCategory("Clothing", shopping.Id, "👕");
            CreateCategory("Electronics", shopping.Id, "💻");
            CreateCategory("Household", shopping.Id, "🏠");

            var bills = CreateFolder("Bills & Utilities", expenses.Id, "📄");
            CreateCategory("Electricity", bills.Id, "⚡");
            CreateCategory("Water", bills.Id, "💧");
            CreateCategory("Internet", bills.Id, "🌐");
            CreateCategory("Phone", bills.Id, "📱");
            CreateCategory("Rent", bills.Id, "🏢");

            var entertainment = CreateFolder("Entertainment", expenses.Id, "🎬");
            CreateCategory("Movies", entertainment.Id, "🎥");
            CreateCategory("Streaming", entertainment.Id, "📺");
            CreateCategory("Games", entertainment.Id, "🎮");

            var health = CreateFolder("Health", expenses.Id, "❤️");
            CreateCategory("Medical", health.Id, "🏥");
            CreateCategory("Pharmacy", health.Id, "💊");
            CreateCategory("Gym", health.Id, "🏋️");

            CreateCategory("Other Expenses", expenses.Id, "📦");
        }

        // Income
        var income = CreateFolder("Income", null, "💰", "#22c55e");
        {
            CreateCategory("Salary", income.Id, "💵");
            CreateCategory("Freelance", income.Id, "💼");
            CreateCategory("Interest", income.Id, "🏦");
            CreateCategory("Dividends", income.Id, "📈");
            CreateCategory("Bonus", income.Id, "🎁");
            CreateCategory("Other Income", income.Id, "💎");
        }

        // Investments
        var investments = CreateFolder("Investments", null, "📊", "#3b82f6");
        {
            CreateCategory("Stocks", investments.Id, "📉");
            CreateCategory("Mutual Funds", investments.Id, "📁");
            CreateCategory("Fixed Deposits", investments.Id, "🏛️");
            CreateCategory("Crypto", investments.Id, "₿");
            CreateCategory("Other Investments", investments.Id, "🎯");
        }

        // Gifts
        var gifts = CreateFolder("Gifts", null, "🎁", "#a855f7");
        {
            CreateCategory("Gift Given", gifts.Id, "🎀");
            CreateCategory("Gift Received", gifts.Id, "🎊");
        }

        // Transfers
        var transfers = CreateFolder("Transfers", null, "🔄", "#6b7280");
        {
            CreateCategory("Account Transfer", transfers.Id, "🔁");
        }

        await _labelRepository.CreateManyAsync(labels);
        _logger.LogInformation("Created {Count} default labels for user {UserId}", labels.Count, userId);
    }

    private async Task<bool> IsDescendantAsync(string potentialDescendantId, string ancestorId, string userId)
    {
        var current = await _labelRepository.GetByIdAndUserIdAsync(potentialDescendantId, userId);
        while (current != null && current.ParentId != null)
        {
            if (current.ParentId == ancestorId)
            {
                return true;
            }
            current = await _labelRepository.GetByIdAndUserIdAsync(current.ParentId, userId);
        }
        return false;
    }

    private List<LabelTreeResponse> BuildTree(List<Label> labels, string? parentId)
    {
        return labels
            .Where(l => l.ParentId == parentId)
            .OrderBy(l => l.Order)
            .ThenBy(l => l.Name)
            .Select(l => new LabelTreeResponse(
                l.Id,
                l.Name,
                l.ParentId,
                l.Type.ToString(),
                l.Icon,
                l.Color,
                l.Order,
                l.IsSystem,
                l.CreatedAt,
                BuildTree(labels, l.Id)
            ))
            .ToList();
    }

    private static LabelResponse MapToResponse(Label label)
    {
        return new LabelResponse(
            label.Id,
            label.Name,
            label.ParentId,
            label.Type.ToString(),
            label.Icon,
            label.Color,
            label.Order,
            label.IsSystem,
            label.CreatedAt
        );
    }
}
