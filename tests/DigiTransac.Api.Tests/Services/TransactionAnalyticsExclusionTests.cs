using DigiTransac.Api.Models;
using DigiTransac.Api.Services.Transactions;

namespace DigiTransac.Api.Tests.Services;

/// <summary>
/// Unit tests for the excludeFromAnalytics filtering logic in TransactionAnalyticsService.
/// Tests BuildExcludedLabelIds (internal static) for correctness of folder inheritance,
/// direct exclusion, and edge cases.
/// </summary>
public class TransactionAnalyticsExclusionTests
{
    #region BuildExcludedLabelIds Tests

    [Fact]
    public void BuildExcludedLabelIds_EmptyDictionary_ReturnsEmptySet()
    {
        var labels = new Dictionary<string, Label>();

        var result = TransactionAnalyticsService.BuildExcludedLabelIds(labels);

        result.Should().BeEmpty();
    }

    [Fact]
    public void BuildExcludedLabelIds_NoExcludedLabels_ReturnsEmptySet()
    {
        var labels = new Dictionary<string, Label>
        {
            ["1"] = CreateLabel("1", "Expenses", LabelType.Folder, excludeFromAnalytics: false),
            ["2"] = CreateLabel("2", "Groceries", LabelType.Category, parentId: "1", excludeFromAnalytics: false),
            ["3"] = CreateLabel("3", "Income", LabelType.Folder, excludeFromAnalytics: false),
        };

        var result = TransactionAnalyticsService.BuildExcludedLabelIds(labels);

        result.Should().BeEmpty();
    }

    [Fact]
    public void BuildExcludedLabelIds_DirectExclusion_IncludesLabel()
    {
        var labels = new Dictionary<string, Label>
        {
            ["1"] = CreateLabel("1", "Transfers", LabelType.Folder, excludeFromAnalytics: true),
            ["2"] = CreateLabel("2", "Expenses", LabelType.Folder, excludeFromAnalytics: false),
        };

        var result = TransactionAnalyticsService.BuildExcludedLabelIds(labels);

        result.Should().Contain("1");
        result.Should().NotContain("2");
    }

    [Fact]
    public void BuildExcludedLabelIds_FolderInheritance_ExcludesChildren()
    {
        var labels = new Dictionary<string, Label>
        {
            ["folder"] = CreateLabel("folder", "Transfers", LabelType.Folder, excludeFromAnalytics: true),
            ["child1"] = CreateLabel("child1", "Account Transfer", LabelType.Category, parentId: "folder", excludeFromAnalytics: false),
            ["child2"] = CreateLabel("child2", "Wire Transfer", LabelType.Category, parentId: "folder", excludeFromAnalytics: false),
        };

        var result = TransactionAnalyticsService.BuildExcludedLabelIds(labels);

        result.Should().HaveCount(3);
        result.Should().Contain("folder");
        result.Should().Contain("child1");
        result.Should().Contain("child2");
    }

    [Fact]
    public void BuildExcludedLabelIds_NestedFolderInheritance_ExcludesGrandchildren()
    {
        var labels = new Dictionary<string, Label>
        {
            ["root"] = CreateLabel("root", "Hidden", LabelType.Folder, excludeFromAnalytics: true),
            ["subfolder"] = CreateLabel("subfolder", "Sub", LabelType.Folder, parentId: "root", excludeFromAnalytics: false),
            ["leaf"] = CreateLabel("leaf", "Leaf", LabelType.Category, parentId: "subfolder", excludeFromAnalytics: false),
        };

        var result = TransactionAnalyticsService.BuildExcludedLabelIds(labels);

        result.Should().HaveCount(3);
        result.Should().Contain("root");
        result.Should().Contain("subfolder");
        result.Should().Contain("leaf");
    }

    [Fact]
    public void BuildExcludedLabelIds_ChildExcludedButParentNot_OnlyExcludesChild()
    {
        var labels = new Dictionary<string, Label>
        {
            ["folder"] = CreateLabel("folder", "Expenses", LabelType.Folder, excludeFromAnalytics: false),
            ["included"] = CreateLabel("included", "Groceries", LabelType.Category, parentId: "folder", excludeFromAnalytics: false),
            ["excluded"] = CreateLabel("excluded", "Special", LabelType.Category, parentId: "folder", excludeFromAnalytics: true),
        };

        var result = TransactionAnalyticsService.BuildExcludedLabelIds(labels);

        result.Should().HaveCount(1);
        result.Should().Contain("excluded");
        result.Should().NotContain("folder");
        result.Should().NotContain("included");
    }

    [Fact]
    public void BuildExcludedLabelIds_MixedExclusion_CorrectCombination()
    {
        var labels = new Dictionary<string, Label>
        {
            // Non-excluded tree
            ["expenses"] = CreateLabel("expenses", "Expenses", LabelType.Folder, excludeFromAnalytics: false),
            ["groceries"] = CreateLabel("groceries", "Groceries", LabelType.Category, parentId: "expenses", excludeFromAnalytics: false),
            // Excluded tree
            ["transfers"] = CreateLabel("transfers", "Transfers", LabelType.Folder, excludeFromAnalytics: true),
            ["acctTransfer"] = CreateLabel("acctTransfer", "Account Transfer", LabelType.Category, parentId: "transfers", excludeFromAnalytics: false),
            // Standalone excluded
            ["adjustments"] = CreateLabel("adjustments", "Adjustments", LabelType.Folder, excludeFromAnalytics: true),
            ["balAdj"] = CreateLabel("balAdj", "Balance Adjustment", LabelType.Category, parentId: "adjustments", excludeFromAnalytics: true),
        };

        var result = TransactionAnalyticsService.BuildExcludedLabelIds(labels);

        result.Should().HaveCount(4);
        result.Should().Contain("transfers");
        result.Should().Contain("acctTransfer");
        result.Should().Contain("adjustments");
        result.Should().Contain("balAdj");
        result.Should().NotContain("expenses");
        result.Should().NotContain("groceries");
    }

    [Fact]
    public void BuildExcludedLabelIds_OrphanedParentId_DoesNotThrow()
    {
        // Label references a parent that doesn't exist in the dictionary
        var labels = new Dictionary<string, Label>
        {
            ["child"] = CreateLabel("child", "Orphan", LabelType.Category, parentId: "nonexistent", excludeFromAnalytics: false),
        };

        var result = TransactionAnalyticsService.BuildExcludedLabelIds(labels);

        result.Should().BeEmpty();
    }

    [Fact]
    public void BuildExcludedLabelIds_RootLevelCategory_DirectExclusion()
    {
        var labels = new Dictionary<string, Label>
        {
            ["cat"] = CreateLabel("cat", "Standalone", LabelType.Category, excludeFromAnalytics: true),
        };

        var result = TransactionAnalyticsService.BuildExcludedLabelIds(labels);

        result.Should().HaveCount(1);
        result.Should().Contain("cat");
    }

    #endregion

    #region Helper Methods

    private static Label CreateLabel(
        string id,
        string name,
        LabelType type,
        string? parentId = null,
        bool excludeFromAnalytics = false,
        bool isSystem = false)
    {
        return new Label
        {
            Id = id,
            UserId = "test-user",
            Name = name,
            Type = type,
            ParentId = parentId,
            ExcludeFromAnalytics = excludeFromAnalytics,
            IsSystem = isSystem,
            Order = 0,
            CreatedAt = DateTime.UtcNow
        };
    }

    #endregion
}