using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

public interface ILabelService
{
    Task<List<LabelResponse>> GetAllAsync(string userId, CancellationToken ct = default);
    Task<List<LabelTreeResponse>> GetTreeAsync(string userId, CancellationToken ct = default);
    Task<LabelResponse?> GetByIdAsync(string id, string userId, CancellationToken ct = default);
    Task<Result<LabelResponse>> CreateAsync(string userId, CreateLabelRequest request, CancellationToken ct = default);
    Task<Result<LabelResponse>> UpdateAsync(string id, string userId, UpdateLabelRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(string id, string userId, CancellationToken ct = default);
    Task<Result<DeleteWithCountResponse>> DeleteWithReassignmentAsync(string id, string userId, string? reassignToLabelId, CancellationToken ct = default);
    Task<int> GetTransactionCountAsync(string id, string userId, CancellationToken ct = default);
    Task<Result> ReorderAsync(string userId, ReorderLabelsRequest request, CancellationToken ct = default);
    Task CreateDefaultLabelsAsync(string userId, CancellationToken ct = default);
    Task<Label> GetOrCreateAdjustmentsCategoryAsync(string userId, CancellationToken ct = default);
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

    public async Task<List<LabelResponse>> GetAllAsync(string userId, CancellationToken ct = default)
    {
        var labels = await _labelRepository.GetByUserIdAsync(userId, ct);
        return labels.Select(MapToResponse).ToList();
    }

    public async Task<List<LabelTreeResponse>> GetTreeAsync(string userId, CancellationToken ct = default)
    {
        var labels = await _labelRepository.GetByUserIdAsync(userId, ct);

        // Lazy migration: ensure system labels (Transfers/Adjustments) have excludeFromAnalytics=true
        await MigrateSystemLabelExclusionsAsync(labels, ct);

        return BuildTree(labels, null);
    }

    public async Task<LabelResponse?> GetByIdAsync(string id, string userId, CancellationToken ct = default)
    {
        var label = await _labelRepository.GetByIdAndUserIdAsync(id, userId, ct);
        return label != null ? MapToResponse(label) : null;
    }

    public async Task<Result<LabelResponse>> CreateAsync(string userId, CreateLabelRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Error.Validation("Name is required");

        // Parse type
        if (!Enum.TryParse<LabelType>(request.Type, true, out var labelType))
            return Error.Validation("Invalid type. Must be 'Folder' or 'Category'");

        // Validate parent exists if specified
        if (!string.IsNullOrEmpty(request.ParentId))
        {
            var parent = await _labelRepository.GetByIdAndUserIdAsync(request.ParentId, userId, ct);
            if (parent == null)
                return Error.NotFound("Parent");
            if (parent.Type != LabelType.Folder)
                return Error.Validation("Parent must be a folder");
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
            IsSystem = false,
            ExcludeFromAnalytics = request.ExcludeFromAnalytics ?? false
        };

        await _labelRepository.CreateAsync(label, ct);
        _logger.LogInformation("Created label {LabelId} for user {UserId}", label.Id, userId);

        return MapToResponse(label);
    }

    public async Task<Result<LabelResponse>> UpdateAsync(string id, string userId, UpdateLabelRequest request, CancellationToken ct = default)
    {
        var label = await _labelRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (label == null)
            return DomainErrors.Label.NotFound(id);

        // Full update (Name provided) — handle rename, reparent, icon, color
        if (request.Name is not null)
        {
            // System labels cannot be renamed or moved
            if (label.IsSystem)
            {
                if (request.Name.Trim() != label.Name)
                    return Error.InvalidOperation("System labels cannot be renamed");
                if (request.ParentId != label.ParentId)
                    return Error.InvalidOperation("System labels cannot be moved");
            }

            if (string.IsNullOrWhiteSpace(request.Name))
                return Error.Validation("Name is required");

            // Validate parent if changing
            if (request.ParentId != label.ParentId && !string.IsNullOrEmpty(request.ParentId))
            {
                // Can't set self as parent
                if (request.ParentId == id)
                    return Error.Validation("Cannot set label as its own parent");

                var parent = await _labelRepository.GetByIdAndUserIdAsync(request.ParentId, userId, ct);
                if (parent == null)
                    return Error.NotFound("Parent");
                if (parent.Type != LabelType.Folder)
                    return Error.Validation("Parent must be a folder");

                // Check for circular reference (can't move folder under its own descendant)
                if (label.Type == LabelType.Folder && await IsDescendantAsync(request.ParentId, id, userId))
                    return Error.Validation("Cannot move folder under its own descendant");
            }

            label.Name = request.Name.Trim();
            label.ParentId = request.ParentId;
            label.Icon = request.Icon;
            label.Color = request.Color;
        }

        // These fields support partial updates (independent of Name)
        if (request.Order.HasValue)
        {
            label.Order = request.Order.Value;
        }
        if (request.ExcludeFromAnalytics.HasValue)
        {
            label.ExcludeFromAnalytics = request.ExcludeFromAnalytics.Value;
        }

        await _labelRepository.UpdateAsync(label, ct);
        _logger.LogInformation("Updated label {LabelId} for user {UserId}", id, userId);

        return MapToResponse(label);
    }

    public async Task<Result> DeleteAsync(string id, string userId, CancellationToken ct = default)
    {
        var label = await _labelRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (label == null)
            return DomainErrors.Label.NotFound(id);

        // System labels cannot be deleted
        if (label.IsSystem)
            return DomainErrors.Label.CannotDeleteSystemLabel(label.Name);

        // Check if folder has children
        if (label.Type == LabelType.Folder)
        {
            var hasChildren = await _labelRepository.HasChildrenAsync(id, userId, ct);
            if (hasChildren)
                return Error.Validation("Cannot delete folder with children. Delete or move children first.");
        }

        // Check if label is used in transactions - require reassignment
        var transactionCount = await _transactionRepository.GetCountByLabelIdAsync(id, userId);
        if (transactionCount > 0)
            return DomainErrors.Label.HasTransactions(transactionCount);

        var deleted = await _labelRepository.DeleteAsync(id, userId, ct);
        if (!deleted)
            return Error.InternalError("Failed to delete label");

        _logger.LogInformation("Deleted label {LabelId} for user {UserId}", id, userId);
        return Result.Success();
    }

    public async Task<int> GetTransactionCountAsync(string id, string userId, CancellationToken ct = default)
    {
        return await _transactionRepository.GetCountByLabelIdAsync(id, userId);
    }

    public async Task<Result<DeleteWithCountResponse>> DeleteWithReassignmentAsync(string id, string userId, string? reassignToLabelId, CancellationToken ct = default)
    {
        var label = await _labelRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (label == null)
            return DomainErrors.Label.NotFound(id);

        // System labels cannot be deleted
        if (label.IsSystem)
            return DomainErrors.Label.CannotDeleteSystemLabel(label.Name);

        // Check if folder has children
        if (label.Type == LabelType.Folder)
        {
            var hasChildren = await _labelRepository.HasChildrenAsync(id, userId, ct);
            if (hasChildren)
                return Error.Validation("Cannot delete folder with children. Delete or move children first.");
        }

        var transactionCount = await _transactionRepository.GetCountByLabelIdAsync(id, userId);
        
        if (transactionCount > 0)
        {
            if (string.IsNullOrEmpty(reassignToLabelId))
            {
                // Return error so frontend can show reassignment modal
                return Error.Conflict($"This label has {transactionCount} transaction(s). Please select a label to reassign them to.");
            }

            // Validate target label exists
            var targetLabel = await _labelRepository.GetByIdAndUserIdAsync(reassignToLabelId, userId, ct);
            if (targetLabel == null)
                return Error.NotFound("Target label");

            if (targetLabel.Type != LabelType.Category)
                return Error.Validation("Can only reassign to a category, not a folder");

            // Reassign all transactions to the target label
            await _transactionRepository.ReassignLabelAsync(id, reassignToLabelId, userId);
            _logger.LogInformation("Reassigned {Count} transactions from label {FromId} to {ToId}", transactionCount, id, reassignToLabelId);
        }

        var deleted = await _labelRepository.DeleteAsync(id, userId, ct);
        if (!deleted)
            return Error.InternalError("Failed to delete label");

        _logger.LogInformation("Deleted label {LabelId} for user {UserId}", id, userId);
        return new DeleteWithCountResponse($"Label deleted successfully. {transactionCount} transaction(s) reassigned.", transactionCount);
    }

    public async Task<Result> ReorderAsync(string userId, ReorderLabelsRequest request, CancellationToken ct = default)
    {
        var orderMap = request.Items.ToDictionary(item => item.Id, item => item.Order);
        await _labelRepository.BulkUpdateOrderAsync(userId, orderMap, ct);

        return Result.Success();
    }

    public async Task CreateDefaultLabelsAsync(string userId, CancellationToken ct = default)
    {
        var labels = new List<Label>();
        var order = 0;

        // Helper to create folder
        Label CreateFolder(string name, string? parentId = null, string? icon = null, string? color = null, bool isSystem = false, bool excludeFromAnalytics = false)
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
                IsSystem = isSystem || parentId == null,  // Root folders are system by default
                ExcludeFromAnalytics = excludeFromAnalytics
            };
            labels.Add(folder);
            return folder;
        }

        // Helper to create category
        void CreateCategory(string name, string parentId, string? icon = null, string? color = null, bool isSystem = false, bool excludeFromAnalytics = false)
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
                IsSystem = isSystem,
                ExcludeFromAnalytics = excludeFromAnalytics
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

        // Transfers (system category - used automatically for account transfers)
        // Excluded from analytics by default since transfers are not real income/expenses
        var transfers = CreateFolder("Transfers", null, "🔄", "#6b7280", isSystem: true, excludeFromAnalytics: true);
        {
            CreateCategory("Account Transfer", transfers.Id, "🔁", isSystem: true, excludeFromAnalytics: true);
        }

        // Adjustments (system category for balance adjustments)
        // Excluded from analytics by default since adjustments are not real income/expenses
        var adjustments = CreateFolder("Adjustments", null, "⚖️", "#6b7280", isSystem: true, excludeFromAnalytics: true);
        {
            CreateCategory("Balance Adjustment", adjustments.Id, "⚖️", isSystem: true, excludeFromAnalytics: true);
        }

        await _labelRepository.CreateManyAsync(labels, ct);
        _logger.LogInformation("Created {Count} default labels for user {UserId}", labels.Count, userId);
    }

    /// <summary>
    /// Lazy migration: ensures "Transfers" and "Adjustments" system labels (and their children)
    /// have ExcludeFromAnalytics=true. This handles existing users created before this feature.
    /// Idempotent — only writes when a fix is needed.
    /// </summary>
    private async Task MigrateSystemLabelExclusionsAsync(List<Label> labels, CancellationToken ct)
    {
        var systemFolderNames = new HashSet<string> { "Transfers", "Adjustments" };
        var systemFolders = labels
            .Where(l => l.IsSystem && l.Type == LabelType.Folder && systemFolderNames.Contains(l.Name))
            .ToList();

        var labelsToUpdate = new List<Label>();

        foreach (var folder in systemFolders)
        {
            if (!folder.ExcludeFromAnalytics)
            {
                folder.ExcludeFromAnalytics = true;
                labelsToUpdate.Add(folder);
            }

            // Also fix children under this system folder
            var children = labels.Where(l => l.ParentId == folder.Id && !l.ExcludeFromAnalytics);
            foreach (var child in children)
            {
                child.ExcludeFromAnalytics = true;
                labelsToUpdate.Add(child);
            }
        }

        if (labelsToUpdate.Count > 0)
        {
            foreach (var label in labelsToUpdate)
            {
                await _labelRepository.UpdateAsync(label, ct);
            }
            _logger.LogInformation(
                "Migrated {Count} system labels to excludeFromAnalytics=true", labelsToUpdate.Count);
        }
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
                l.ExcludeFromAnalytics,
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
            label.ExcludeFromAnalytics,
            label.CreatedAt
        );
    }

    public async Task<Label> GetOrCreateAdjustmentsCategoryAsync(string userId, CancellationToken ct = default)
    {
        // First, try to find existing "Balance Adjustment" category
        var existingLabels = await _labelRepository.GetByUserIdAsync(userId, ct);
        var existingCategory = existingLabels.FirstOrDefault(l => 
            l.Name == "Balance Adjustment" && l.Type == LabelType.Category && l.IsSystem);
        
        if (existingCategory != null)
        {
            return existingCategory;
        }

        // Find or create the "Adjustments" system folder
        var adjustmentsFolder = existingLabels.FirstOrDefault(l => 
            l.Name == "Adjustments" && l.Type == LabelType.Folder && l.IsSystem);
        
        if (adjustmentsFolder == null)
        {
            // Create the "Adjustments" system folder
            var folderOrder = existingLabels
                .Where(l => l.ParentId == null)
                .Select(l => l.Order)
                .DefaultIfEmpty(-1)
                .Max() + 1;

            adjustmentsFolder = new Label
            {
                UserId = userId,
                Name = "Adjustments",
                Type = LabelType.Folder,
                Icon = "⚖️",
                Color = "#6B7280", // Gray color
                ParentId = null,
                Order = folderOrder,
                IsSystem = true,
                ExcludeFromAnalytics = true,
                CreatedAt = DateTime.UtcNow
            };
            await _labelRepository.CreateAsync(adjustmentsFolder, ct);
        }

        // Create the "Balance Adjustment" system category
        var categoryOrder = existingLabels
            .Where(l => l.ParentId == adjustmentsFolder.Id)
            .Select(l => l.Order)
            .DefaultIfEmpty(-1)
            .Max() + 1;

        var adjustmentCategory = new Label
        {
            UserId = userId,
            Name = "Balance Adjustment",
            Type = LabelType.Category,
            Icon = "⚖️",
            Color = "#6B7280", // Gray color
            ParentId = adjustmentsFolder.Id,
            Order = categoryOrder,
            IsSystem = true,
            ExcludeFromAnalytics = true,
            CreatedAt = DateTime.UtcNow
        };
        await _labelRepository.CreateAsync(adjustmentCategory, ct);

        return adjustmentCategory;
    }
}
