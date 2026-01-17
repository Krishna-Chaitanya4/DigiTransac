using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace DigiTransac.Tests.Services;

public class LabelServiceTests
{
    private readonly Mock<ILabelRepository> _labelRepositoryMock;
    private readonly Mock<ILogger<LabelService>> _loggerMock;
    private readonly LabelService _labelService;
    private const string TestUserId = "test-user-id";

    public LabelServiceTests()
    {
        _labelRepositoryMock = new Mock<ILabelRepository>();
        _loggerMock = new Mock<ILogger<LabelService>>();
        _labelService = new LabelService(_labelRepositoryMock.Object, _loggerMock.Object);
    }

    #region GetAllAsync Tests

    [Fact]
    public async Task GetAllAsync_ShouldReturnAllLabelsForUser()
    {
        // Arrange
        var labels = new List<Label>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Expenses", Type = LabelType.Folder },
            new() { Id = "2", UserId = TestUserId, Name = "Food", Type = LabelType.Category }
        };
        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(labels);

        // Act
        var result = await _labelService.GetAllAsync(TestUserId);

        // Assert
        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Expenses");
        result[1].Name.Should().Be("Food");
    }

    [Fact]
    public async Task GetAllAsync_WithNoLabels_ShouldReturnEmptyList()
    {
        // Arrange
        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new List<Label>());

        // Act
        var result = await _labelService.GetAllAsync(TestUserId);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region GetTreeAsync Tests

    [Fact]
    public async Task GetTreeAsync_ShouldBuildTreeStructure()
    {
        // Arrange
        var labels = new List<Label>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Expenses", Type = LabelType.Folder, ParentId = null },
            new() { Id = "2", UserId = TestUserId, Name = "Food", Type = LabelType.Folder, ParentId = "1" },
            new() { Id = "3", UserId = TestUserId, Name = "Restaurants", Type = LabelType.Category, ParentId = "2" }
        };
        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(labels);

        // Act
        var result = await _labelService.GetTreeAsync(TestUserId);

        // Assert
        result.Should().HaveCount(1);
        result[0].Name.Should().Be("Expenses");
        result[0].Children.Should().HaveCount(1);
        result[0].Children[0].Name.Should().Be("Food");
        result[0].Children[0].Children.Should().HaveCount(1);
        result[0].Children[0].Children[0].Name.Should().Be("Restaurants");
    }

    [Fact]
    public async Task GetTreeAsync_WithMultipleRoots_ShouldReturnAllRoots()
    {
        // Arrange
        var labels = new List<Label>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Expenses", Type = LabelType.Folder, ParentId = null },
            new() { Id = "2", UserId = TestUserId, Name = "Income", Type = LabelType.Folder, ParentId = null }
        };
        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(labels);

        // Act
        var result = await _labelService.GetTreeAsync(TestUserId);

        // Assert
        result.Should().HaveCount(2);
    }

    #endregion

    #region GetByIdAsync Tests

    [Fact]
    public async Task GetByIdAsync_WithValidId_ShouldReturnLabel()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "Test", Type = LabelType.Category };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);

        // Act
        var result = await _labelService.GetByIdAsync("1", TestUserId);

        // Assert
        result.Should().NotBeNull();
        result!.Name.Should().Be("Test");
    }

    [Fact]
    public async Task GetByIdAsync_WithInvalidId_ShouldReturnNull()
    {
        // Arrange
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid", TestUserId))
            .ReturnsAsync((Label?)null);

        // Act
        var result = await _labelService.GetByIdAsync("invalid", TestUserId);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region CreateAsync Tests

    [Fact]
    public async Task CreateAsync_WithValidData_ShouldCreateLabel()
    {
        // Arrange
        var request = new CreateLabelRequest("Test Folder", null, "Folder", null, null);
        _labelRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Label>()))
            .ReturnsAsync((Label l) => l);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Label.Should().NotBeNull();
        result.Label!.Name.Should().Be("Test Folder");
        result.Label.Type.Should().Be("Folder");
    }

    [Fact]
    public async Task CreateAsync_WithEmptyName_ShouldReturnFailure()
    {
        // Arrange
        var request = new CreateLabelRequest("", null, "Folder", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Name is required");
    }

    [Fact]
    public async Task CreateAsync_WithWhitespaceName_ShouldReturnFailure()
    {
        // Arrange
        var request = new CreateLabelRequest("   ", null, "Folder", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Name is required");
    }

    [Fact]
    public async Task CreateAsync_WithInvalidType_ShouldReturnFailure()
    {
        // Arrange
        var request = new CreateLabelRequest("Test", null, "InvalidType", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Invalid type");
    }

    [Fact]
    public async Task CreateAsync_WithValidParent_ShouldCreateUnderParent()
    {
        // Arrange
        var parentFolder = new Label { Id = "parent", UserId = TestUserId, Name = "Parent", Type = LabelType.Folder };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("parent", TestUserId))
            .ReturnsAsync(parentFolder);
        _labelRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Label>()))
            .ReturnsAsync((Label l) => l);

        var request = new CreateLabelRequest("Child", "parent", "Category", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Label!.ParentId.Should().Be("parent");
    }

    [Fact]
    public async Task CreateAsync_WithNonExistentParent_ShouldReturnFailure()
    {
        // Arrange
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("nonexistent", TestUserId))
            .ReturnsAsync((Label?)null);

        var request = new CreateLabelRequest("Child", "nonexistent", "Category", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Parent not found");
    }

    [Fact]
    public async Task CreateAsync_WithCategoryAsParent_ShouldReturnFailure()
    {
        // Arrange
        var parentCategory = new Label { Id = "parent", UserId = TestUserId, Name = "Parent", Type = LabelType.Category };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("parent", TestUserId))
            .ReturnsAsync(parentCategory);

        var request = new CreateLabelRequest("Child", "parent", "Category", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Parent must be a folder");
    }

    #endregion

    #region UpdateAsync Tests

    [Fact]
    public async Task UpdateAsync_WithValidData_ShouldUpdateLabel()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "Old Name", Type = LabelType.Category };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);
        _labelRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<Label>()))
            .Returns(Task.CompletedTask);

        var request = new UpdateLabelRequest("New Name", null, null, null, null);

        // Act
        var result = await _labelService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Label!.Name.Should().Be("New Name");
    }

    [Fact]
    public async Task UpdateAsync_WithNonExistentLabel_ShouldReturnFailure()
    {
        // Arrange
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("nonexistent", TestUserId))
            .ReturnsAsync((Label?)null);

        var request = new UpdateLabelRequest("New Name", null, null, null, null);

        // Act
        var result = await _labelService.UpdateAsync("nonexistent", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Label not found");
    }

    [Fact]
    public async Task UpdateAsync_WithEmptyName_ShouldReturnFailure()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "Test", Type = LabelType.Category };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);

        var request = new UpdateLabelRequest("", null, null, null, null);

        // Act
        var result = await _labelService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Name is required");
    }

    [Fact]
    public async Task UpdateAsync_WithSelfAsParent_ShouldReturnFailure()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "Test", Type = LabelType.Folder };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);

        var request = new UpdateLabelRequest("Test", "1", null, null, null);

        // Act
        var result = await _labelService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Cannot set label as its own parent");
    }

    #endregion

    #region DeleteAsync Tests

    [Fact]
    public async Task DeleteAsync_WithValidId_ShouldDeleteLabel()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "Test", Type = LabelType.Category };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);
        _labelRepositoryMock.Setup(x => x.HasChildrenAsync("1", TestUserId))
            .ReturnsAsync(false);
        _labelRepositoryMock.Setup(x => x.DeleteAsync("1", TestUserId))
            .ReturnsAsync(true);

        // Act
        var result = await _labelService.DeleteAsync("1", TestUserId);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistentLabel_ShouldReturnFailure()
    {
        // Arrange
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("nonexistent", TestUserId))
            .ReturnsAsync((Label?)null);

        // Act
        var result = await _labelService.DeleteAsync("nonexistent", TestUserId);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Label not found");
    }

    [Fact]
    public async Task DeleteAsync_FolderWithChildren_ShouldReturnFailure()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "Parent Folder", Type = LabelType.Folder };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);
        _labelRepositoryMock.Setup(x => x.HasChildrenAsync("1", TestUserId))
            .ReturnsAsync(true);

        // Act
        var result = await _labelService.DeleteAsync("1", TestUserId);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Cannot delete folder with children");
    }

    [Fact]
    public async Task DeleteAsync_SystemLabel_ShouldReturnFailure()
    {
        // Arrange
        var systemLabel = new Label 
        { 
            Id = "1", 
            UserId = TestUserId, 
            Name = "Expenses", 
            Type = LabelType.Folder,
            IsSystem = true 
        };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(systemLabel);

        // Act
        var result = await _labelService.DeleteAsync("1", TestUserId);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("System labels cannot be deleted");
    }

    #endregion

    #region UpdateAsync System Label Tests

    [Fact]
    public async Task UpdateAsync_SystemLabel_CannotBeRenamed()
    {
        // Arrange
        var systemLabel = new Label 
        { 
            Id = "1", 
            UserId = TestUserId, 
            Name = "Expenses", 
            Type = LabelType.Folder,
            ParentId = null,
            IsSystem = true 
        };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(systemLabel);

        var request = new UpdateLabelRequest("My Expenses", null, null, null, null);

        // Act
        var result = await _labelService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("System labels cannot be renamed");
    }

    [Fact]
    public async Task UpdateAsync_SystemLabel_CannotBeMoved()
    {
        // Arrange
        var systemLabel = new Label 
        { 
            Id = "1", 
            UserId = TestUserId, 
            Name = "Expenses", 
            Type = LabelType.Folder,
            ParentId = null,
            IsSystem = true 
        };
        var targetFolder = new Label 
        { 
            Id = "2", 
            UserId = TestUserId, 
            Name = "Archive", 
            Type = LabelType.Folder,
            ParentId = null,
            IsSystem = false 
        };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(systemLabel);
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("2", TestUserId))
            .ReturnsAsync(targetFolder);

        var request = new UpdateLabelRequest("Expenses", "2", null, null, null);

        // Act
        var result = await _labelService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("System labels cannot be moved");
    }

    [Fact]
    public async Task UpdateAsync_SystemLabel_CanChangeIconAndColor()
    {
        // Arrange
        var systemLabel = new Label 
        { 
            Id = "1", 
            UserId = TestUserId, 
            Name = "Expenses", 
            Type = LabelType.Folder,
            ParentId = null,
            IsSystem = true,
            Icon = "💰",
            Color = "#ff0000"
        };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(systemLabel);
        _labelRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<Label>()))
            .Returns(Task.CompletedTask);

        // Request with same name/parent but different icon/color
        var request = new UpdateLabelRequest("Expenses", null, "📊", "#00ff00", null);

        // Act
        var result = await _labelService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Label!.Icon.Should().Be("📊");
        result.Label!.Color.Should().Be("#00ff00");
    }

    #endregion

    #region CreateDefaultLabelsAsync Tests

    [Fact]
    public async Task CreateDefaultLabelsAsync_ShouldCreateDefaultLabels()
    {
        // Arrange
        _labelRepositoryMock.Setup(x => x.CreateManyAsync(It.IsAny<List<Label>>()))
            .Returns(Task.CompletedTask);

        // Act
        await _labelService.CreateDefaultLabelsAsync(TestUserId);

        // Assert
        _labelRepositoryMock.Verify(x => x.CreateManyAsync(It.Is<List<Label>>(labels => 
            labels.Any(l => l.Name == "Expenses") &&
            labels.Any(l => l.Name == "Income") &&
            labels.Any(l => l.Name == "Investments") &&
            labels.Any(l => l.Name == "Gifts") &&
            labels.Any(l => l.Name == "Transfers")
        )), Times.Once);
    }

    [Fact]
    public async Task CreateDefaultLabelsAsync_OnlyRootFoldersShouldBeSystemLabels()
    {
        // Arrange
        List<Label>? capturedLabels = null;
        _labelRepositoryMock.Setup(x => x.CreateManyAsync(It.IsAny<List<Label>>()))
            .Callback<List<Label>>(labels => capturedLabels = labels)
            .Returns(Task.CompletedTask);

        // Act
        await _labelService.CreateDefaultLabelsAsync(TestUserId);

        // Assert
        capturedLabels.Should().NotBeNull();
        
        // Root folders (no parent) should be system labels
        var rootFolders = capturedLabels!.Where(l => l.ParentId == null).ToList();
        rootFolders.Should().AllSatisfy(l => l.IsSystem.Should().BeTrue());
        rootFolders.Select(l => l.Name).Should().Contain(new[] { "Expenses", "Income", "Investments", "Gifts", "Transfers" });
        
        // Non-root items (have a parent) should NOT be system labels
        var nestedItems = capturedLabels!.Where(l => l.ParentId != null).ToList();
        nestedItems.Should().NotBeEmpty();
        nestedItems.Should().AllSatisfy(l => l.IsSystem.Should().BeFalse());
    }

    #endregion
}
