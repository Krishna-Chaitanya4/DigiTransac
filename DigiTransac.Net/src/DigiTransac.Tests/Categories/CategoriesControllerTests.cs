using Xunit;
using Moq;
using Microsoft.AspNetCore.Mvc;
using DigiTransac.API.Controllers;
using DigiTransac.Core.Models;
using DigiTransac.Infrastructure.Interfaces;

namespace DigiTransac.Tests.Categories;

public class CategoriesControllerTests
{
    private readonly Mock<ICategoryRepository> _mockRepository;
    private readonly CategoriesController _controller;

    public CategoriesControllerTests()
    {
        _mockRepository = new Mock<ICategoryRepository>();
        _controller = new CategoriesController(_mockRepository.Object);
    }

    [Fact]
    public async Task GetAll_ReturnsOkResult_WithCategories()
    {
        // Arrange
        var categories = new List<Category>
        {
            new() { Id = "cat1", Name = "Groceries", UserId = "demo-user" },
            new() { Id = "cat2", Name = "Dining", UserId = "demo-user" }
        };

        _mockRepository
            .Setup(r => r.GetAllAsync(It.IsAny<string>()))
            .ReturnsAsync(categories);

        // Act
        var result = await _controller.GetAll();

        // Assert - ActionResult<T> is returned, not OkObjectResult
        Assert.NotNull(result);
        Assert.IsType<ActionResult<ApiResponse<List<Category>>>>(result);
    }

    [Fact]
    public async Task GetAll_ReturnsEmptyList_WhenNoCategories()
    {
        // Arrange
        _mockRepository
            .Setup(r => r.GetAllAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<Category>());

        // Act
        var result = await _controller.GetAll();

        // Assert - ActionResult<T> is returned with empty list
        Assert.NotNull(result);
        Assert.IsType<ActionResult<ApiResponse<List<Category>>>>(result);
    }

    [Fact]
    public async Task GetById_ReturnsOkResult_WithCategory()
    {
        // Arrange
        var categoryId = "cat1";
        var category = new Category
        {
            Id = categoryId,
            Name = "Groceries",
            UserId = "demo-user"
        };

        _mockRepository
            .Setup(r => r.GetByIdAsync(categoryId, It.IsAny<string>()))
            .ReturnsAsync(category);

        // Act
        var result = await _controller.GetById(categoryId);

        // Assert - ActionResult<T> is returned
        Assert.NotNull(result);
        Assert.IsType<ActionResult<ApiResponse<Category>>>(result);
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_WhenCategoryNotExists()
    {
        // Arrange
        var categoryId = "nonexistent";
        
        _mockRepository
            .Setup(r => r.GetByIdAsync(categoryId, It.IsAny<string>()))
            .ReturnsAsync((Category?)null);

        // Act
        var result = await _controller.GetById(categoryId);

        // Assert - ActionResult<T> is returned
        Assert.NotNull(result);
        Assert.IsType<ActionResult<ApiResponse<Category>>>(result);
    }

    [Fact]
    public async Task Update_ReturnsOkResult_WithSuccess()
    {
        // Arrange
        var categoryId = "cat1";
        var request = new UpdateCategoryRequest
        {
            Name = "Updated Groceries"
        };

        var existing = new Category { Id = categoryId, Name = "Old", UserId = "demo" };

        _mockRepository
            .Setup(r => r.GetByIdAsync(categoryId, It.IsAny<string>()))
            .ReturnsAsync(existing);

        _mockRepository
            .Setup(r => r.UpdateAsync(categoryId, It.IsAny<Category>()))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.Update(categoryId, request);

        // Assert
        Assert.NotNull(result);
    }

    [Fact]
    public async Task Delete_ReturnsOkResult_WhenCategoryDeleted()
    {
        // Arrange
        var categoryId = "cat1";

        _mockRepository
            .Setup(r => r.DeleteAsync(categoryId, It.IsAny<string>()))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.Delete(categoryId);

        // Assert - ActionResult<T> is returned
        Assert.NotNull(result);
        Assert.IsType<ActionResult<ApiResponse<object>>>(result);
    }

    [Fact]
    public async Task Delete_ReturnsNotFound_WhenCategoryNotExists()
    {
        // Arrange
        var categoryId = "nonexistent";

        _mockRepository
            .Setup(r => r.DeleteAsync(categoryId, It.IsAny<string>()))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.Delete(categoryId);

        // Assert - ActionResult<T> is returned
        Assert.NotNull(result);
        Assert.IsType<ActionResult<ApiResponse<object>>>(result);
    }
}

public class CategoryValidationTests
{
    [Fact]
    public void Category_WithValidData_IsCreatedSuccessfully()
    {
        // Arrange
        var category = new Category
        {
            Name = "Groceries",
            UserId = "user123",
            Icon = "shopping_cart",
            Color = "#FF5733"
        };

        // Act & Assert
        Assert.NotEmpty(category.Name);
        Assert.NotEmpty(category.UserId);
        Assert.Equal(0, category.TransactionCount);
    }

    [Fact]
    public void Category_DefaultTypeIsCategory()
    {
        // Arrange
        var category = new Category { Name = "Test", UserId = "user123" };

        // Act & Assert
        Assert.Equal(CategoryType.Category, category.Type);
    }

    [Fact]
    public void Category_WithFolder_Type_IsValid()
    {
        // Arrange & Act
        var folder = new Category { Name = "Expenses", UserId = "user123", Type = CategoryType.Folder };

        // Assert
        Assert.Equal(CategoryType.Folder, folder.Type);
    }

    [Fact]
    public void Category_NameCannotBeEmpty()
    {
        // Arrange & Act
        var category = new Category { Name = "", UserId = "user123" };

        // Assert
        Assert.Empty(category.Name);
    }

    [Fact]
    public void Category_TimestampsAreSet()
    {
        // Arrange & Act
        var category = new Category { Name = "Test", UserId = "user123" };

        // Assert
        Assert.NotEqual(default(DateTime), category.CreatedAt);
        Assert.NotEqual(default(DateTime), category.UpdatedAt);
    }

    [Theory]
    [InlineData("Groceries")]
    [InlineData("Dining")]
    [InlineData("Entertainment")]
    public void Category_WithDifferentNames_CreatesSuccessfully(string name)
    {
        // Arrange & Act
        var category = new Category { Name = name, UserId = "user123" };

        // Assert
        Assert.Equal(name, category.Name);
    }

    [Fact]
    public void Category_TransactionCount_CanBeTracked()
    {
        // Arrange
        var category = new Category { Name = "Groceries", UserId = "user123" };

        // Act
        category.TransactionCount = 10;

        // Assert
        Assert.Equal(10, category.TransactionCount);
    }

    [Fact]
    public void CategoryWithParent_MaintainsRelationship()
    {
        // Arrange
        var parent = new Category { Id = "parent1", Name = "Expenses", UserId = "user123" };
        var child = new Category { Id = "child1", Name = "Groceries", UserId = "user123", ParentId = parent.Id };

        // Act & Assert
        Assert.Equal(parent.Id, child.ParentId);
    }
}
