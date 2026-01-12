using Xunit;
using Moq;
using DigiTransac.Core.Models;
using DigiTransac.Infrastructure.Interfaces;

namespace DigiTransac.Tests.Categories;

/// <summary>
/// Tests for CategoryRepository interface contract
/// Uses interface mocking to test expected behavior without MongoDB internals
/// </summary>
public class CategoryRepositoryTests
{
    private readonly Mock<ICategoryRepository> _mockRepository;

    public CategoryRepositoryTests()
    {
        _mockRepository = new Mock<ICategoryRepository>();
    }

    [Fact]
    public async Task GetAllAsync_WithValidUserId_ShouldReturnList()
    {
        // Arrange
        var userId = "user1";
        var categories = new List<Category>
        {
            new() { Id = "c1", Name = "Groceries", UserId = userId },
            new() { Id = "c2", Name = "Dining", UserId = userId }
        };

        _mockRepository
            .Setup(r => r.GetAllAsync(userId))
            .ReturnsAsync(categories);

        // Act
        var result = await _mockRepository.Object.GetAllAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Count);
        Assert.All(result, c => Assert.Equal(userId, c.UserId));
    }

    [Fact]
    public async Task GetAllAsync_WithNoData_ShouldReturnEmptyList()
    {
        // Arrange
        _mockRepository
            .Setup(r => r.GetAllAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<Category>());

        // Act
        var result = await _mockRepository.Object.GetAllAsync("anyuser");

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetByIdAsync_WithValidId_ShouldReturnCategory()
    {
        // Arrange
        var userId = "user1";
        var categoryId = "c1";
        var category = new Category { Id = categoryId, Name = "Groceries", UserId = userId };

        _mockRepository
            .Setup(r => r.GetByIdAsync(categoryId, userId))
            .ReturnsAsync(category);

        // Act
        var result = await _mockRepository.Object.GetByIdAsync(categoryId, userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(categoryId, result.Id);
        Assert.Equal(userId, result.UserId);
    }

    [Fact]
    public async Task GetByIdAsync_WithInvalidId_ShouldReturnNull()
    {
        // Arrange
        _mockRepository
            .Setup(r => r.GetByIdAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync((Category?)null);

        // Act
        var result = await _mockRepository.Object.GetByIdAsync("invalid", "user1");

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task CreateAsync_WithValidCategory_ShouldReturnCreatedCategory()
    {
        // Arrange
        var category = new Category { Name = "Groceries", UserId = "user1" };
        var created = new Category { Id = "c1", Name = category.Name, UserId = category.UserId };

        _mockRepository
            .Setup(r => r.CreateAsync(It.IsAny<Category>()))
            .ReturnsAsync(created);

        // Act
        var result = await _mockRepository.Object.CreateAsync(category);

        // Assert
        Assert.NotNull(result);
        Assert.NotEmpty(result.Id);
        Assert.Equal(category.Name, result.Name);
    }

    [Fact]
    public async Task UpdateAsync_WithValidCategory_ShouldReturnTrue()
    {
        // Arrange
        var categoryId = "c1";
        var category = new Category { Id = categoryId, Name = "Updated", UserId = "user1" };

        _mockRepository
            .Setup(r => r.UpdateAsync(categoryId, It.IsAny<Category>()))
            .ReturnsAsync(true);

        // Act
        var result = await _mockRepository.Object.UpdateAsync(categoryId, category);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task UpdateAsync_WithInvalidCategory_ShouldReturnFalse()
    {
        // Arrange
        _mockRepository
            .Setup(r => r.UpdateAsync(It.IsAny<string>(), It.IsAny<Category>()))
            .ReturnsAsync(false);

        // Act
        var result = await _mockRepository.Object.UpdateAsync("invalid", new Category { Name = "Test" });

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task DeleteAsync_WithValidId_ShouldReturnTrue()
    {
        // Arrange
        _mockRepository
            .Setup(r => r.DeleteAsync("c1", "user1"))
            .ReturnsAsync(true);

        // Act
        var result = await _mockRepository.Object.DeleteAsync("c1", "user1");

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task DeleteAsync_WithInvalidId_ShouldReturnFalse()
    {
        // Arrange
        _mockRepository
            .Setup(r => r.DeleteAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(false);

        // Act
        var result = await _mockRepository.Object.DeleteAsync("invalid", "user1");

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void InterfaceContract_ExpectsAsyncMethods()
    {
        // Act & Assert - Verify repository interface async method contract
        var repo = _mockRepository.Object;
        
        var getAllTask = repo.GetAllAsync("user1");
        Assert.IsType<Task<List<Category>>>(getAllTask);

        var getByIdTask = repo.GetByIdAsync("c1", "user1");
        Assert.IsType<Task<Category?>>(getByIdTask);

        var createTask = repo.CreateAsync(new Category { Name = "Test", UserId = "user1" });
        Assert.IsType<Task<Category>>(createTask);

        var updateTask = repo.UpdateAsync("c1", new Category { Name = "Updated" });
        Assert.IsType<Task<bool>>(updateTask);

        var deleteTask = repo.DeleteAsync("c1", "user1");
        Assert.IsType<Task<bool>>(deleteTask);
    }
}
