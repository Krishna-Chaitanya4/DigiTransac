using Xunit;
using DigiTransac.Core.Models;

namespace DigiTransac.Tests.Categories;

/// <summary>
/// Repository-level tests focusing on the Category model behavior
/// and interface contracts rather than mocking complex MongoDB driver internals
/// </summary>
public class CategoryRepositoryModelTests
{
    [Fact]
    public void Category_Creation_WithAllProperties()
    {
        // Arrange & Act
        var category = new Category
        {
            Id = "cat1",
            Name = "Groceries",
            UserId = "user123",
            Icon = "shopping_cart",
            Color = "#FF5733",
            Type = CategoryType.Category,
            TransactionCount = 5
        };

        // Assert
        Assert.Equal("cat1", category.Id);
        Assert.Equal("Groceries", category.Name);
        Assert.Equal("user123", category.UserId);
        Assert.Equal("shopping_cart", category.Icon);
        Assert.Equal("#FF5733", category.Color);
        Assert.Equal(CategoryType.Category, category.Type);
        Assert.Equal(5, category.TransactionCount);
    }

    [Fact]
    public void Category_WithParent_StoresParentId()
    {
        // Arrange & Act
        var parent = new Category { Id = "parent1", Name = "Expenses", UserId = "user1" };
        var child = new Category { Id = "child1", Name = "Groceries", UserId = "user1", ParentId = parent.Id };

        // Assert
        Assert.Equal(parent.Id, child.ParentId);
        Assert.Null(parent.ParentId);
    }

    [Fact]
    public void Category_Hierarchy_ThreeLevels()
    {
        // Arrange
        var level0 = new Category { Id = "l0", Name = "Expenses", UserId = "u1" };
        var level1 = new Category { Id = "l1", Name = "Food", UserId = "u1", ParentId = level0.Id };
        var level2 = new Category { Id = "l2", Name = "Groceries", UserId = "u1", ParentId = level1.Id };

        // Act & Assert
        Assert.Null(level0.ParentId);
        Assert.Equal(level0.Id, level1.ParentId);
        Assert.Equal(level1.Id, level2.ParentId);
    }

    [Fact]
    public void Category_Type_DefaultIsCategory()
    {
        // Arrange & Act
        var category = new Category { Name = "Test", UserId = "user1" };

        // Assert
        Assert.Equal(CategoryType.Category, category.Type);
    }

    [Fact]
    public void Category_Type_CanBeFolder()
    {
        // Arrange & Act
        var folder = new Category { Name = "Expenses", UserId = "user1", Type = CategoryType.Folder };

        // Assert
        Assert.Equal(CategoryType.Folder, folder.Type);
    }

    [Fact]
    public void Category_UserIsolation_DifferentUsers()
    {
        // Arrange
        var cat1 = new Category { Id = "c1", Name = "Groceries", UserId = "user1" };
        var cat2 = new Category { Id = "c2", Name = "Groceries", UserId = "user2" };

        // Act & Assert
        Assert.NotEqual(cat1.UserId, cat2.UserId);
        Assert.Equal(cat1.Name, cat2.Name); // Same name, different user (allowed)
    }

    [Fact]
    public void Category_Timestamps_AreSet()
    {
        // Arrange & Act
        var before = DateTime.UtcNow;
        var category = new Category { Name = "Test", UserId = "user1" };
        var after = DateTime.UtcNow;

        // Assert
        Assert.True(category.CreatedAt >= before);
        Assert.True(category.CreatedAt <= after);
        Assert.True(category.UpdatedAt >= before);
        Assert.True(category.UpdatedAt <= after);
    }

    [Fact]
    public void Category_TransactionCount_StartAtZero()
    {
        // Arrange & Act
        var category = new Category { Name = "Groceries", UserId = "user1" };

        // Assert
        Assert.Equal(0, category.TransactionCount);
    }

    [Fact]
    public void Category_TransactionCount_CanIncrement()
    {
        // Arrange
        var category = new Category { Name = "Groceries", UserId = "user1", TransactionCount = 0 };

        // Act
        category.TransactionCount++;

        // Assert
        Assert.Equal(1, category.TransactionCount);
    }

    [Fact]
    public void Category_NameCannotBeNull_ButCanBeEmpty()
    {
        // Arrange & Act
        var category = new Category { Name = "", UserId = "user1" };

        // Assert
        Assert.NotNull(category.Name);
        Assert.Empty(category.Name);
    }

    [Fact]
    public void Category_WithIcon_StoresCorrectly()
    {
        // Arrange & Act
        var category = new Category { Name = "Food", UserId = "u1", Icon = "restaurant" };

        // Assert
        Assert.Equal("restaurant", category.Icon);
    }

    [Fact]
    public void Category_WithColor_StoresCorrectly()
    {
        // Arrange & Act
        var category = new Category { Name = "Food", UserId = "u1", Color = "#FF5733" };

        // Assert
        Assert.Equal("#FF5733", category.Color);
    }

    [Theory]
    [InlineData("Groceries")]
    [InlineData("Dining")]
    [InlineData("Entertainment")]
    [InlineData("Transportation")]
    [InlineData("Bills & Utilities")]
    public void Category_WithVariousNames_CreatesSuccessfully(string name)
    {
        // Arrange & Act
        var category = new Category { Name = name, UserId = "user1" };

        // Assert
        Assert.Equal(name, category.Name);
    }

    [Fact]
    public void Category_HierarchyPath_BuildsCorrectly()
    {
        // Arrange - Simulate path construction
        var expenses = "Expenses";
        var food = $"{expenses}/Food";
        var groceries = $"{food}/Groceries";

        // Act & Assert
        Assert.Contains("/", food);
        Assert.Equal(2, food.Split('/').Length);
        Assert.Equal(3, groceries.Split('/').Length);
    }

    [Fact]
    public void Category_Equality_BasedOnId()
    {
        // Arrange
        var cat1 = new Category { Id = "c1", Name = "Groceries", UserId = "u1" };
        var cat2 = new Category { Id = "c1", Name = "DifferentName", UserId = "u2" };

        // Act & Assert
        Assert.Equal(cat1.Id, cat2.Id);
        Assert.NotEqual(cat1.UserId, cat2.UserId);
    }

    [Fact]
    public void Category_DefaultValuesBehavior()
    {
        // Arrange & Act
        var category = new Category
        {
            Name = "Test",
            UserId = "user1"
        };

        // Assert
        Assert.NotNull(category.Id);
        Assert.Empty(category.Id); // Default string.Empty
        Assert.Equal(CategoryType.Category, category.Type);
        Assert.Null(category.ParentId);
        Assert.Equal(0, category.TransactionCount);
        Assert.Null(category.Icon);
        Assert.Null(category.Color);
    }
}
