using DigiTransac.Api.Common;
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
    private readonly Mock<ITransactionRepository> _transactionRepositoryMock;
    private readonly Mock<ILogger<LabelService>> _loggerMock;
    private readonly LabelService _labelService;
    private const string TestUserId = "test-user-id";

    public LabelServiceTests()
    {
        _labelRepositoryMock = new Mock<ILabelRepository>();
        _transactionRepositoryMock = new Mock<ITransactionRepository>();
        _loggerMock = new Mock<ILogger<LabelService>>();
        _labelService = new LabelService(_labelRepositoryMock.Object, _transactionRepositoryMock.Object, _loggerMock.Object);
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
        _labelRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Label>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Label l, CancellationToken _) => l);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("Test Folder");
        result.Value.Type.Should().Be("Folder");
    }

    [Fact]
    public async Task CreateAsync_WithEmptyName_ShouldReturnFailure()
    {
        // Arrange
        var request = new CreateLabelRequest("", null, "Folder", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Name is required");
    }

    [Fact]
    public async Task CreateAsync_WithWhitespaceName_ShouldReturnFailure()
    {
        // Arrange
        var request = new CreateLabelRequest("   ", null, "Folder", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Name is required");
    }

    [Fact]
    public async Task CreateAsync_WithInvalidType_ShouldReturnFailure()
    {
        // Arrange
        var request = new CreateLabelRequest("Test", null, "InvalidType", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Invalid type");
    }

    [Fact]
    public async Task CreateAsync_WithValidParent_ShouldCreateUnderParent()
    {
        // Arrange
        var parentFolder = new Label { Id = "parent", UserId = TestUserId, Name = "Parent", Type = LabelType.Folder };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("parent", TestUserId))
            .ReturnsAsync(parentFolder);
        _labelRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Label>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Label l, CancellationToken _) => l);

        var request = new CreateLabelRequest("Child", "parent", "Category", null, null);

        // Act
        var result = await _labelService.CreateAsync(TestUserId, request);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.ParentId.Should().Be("parent");
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("was not found");
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Parent must be a folder");
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
        result.IsSuccess.Should().BeTrue();
        result.Value.Name.Should().Be("New Name");
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("was not found");
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Name is required");
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Cannot set label as its own parent");
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
        result.IsSuccess.Should().BeTrue();
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("was not found");
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Cannot delete folder with children");
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Cannot delete system label");
    }

    #endregion

    #region DeleteWithReassignmentAsync Tests

    [Fact]
    public async Task DeleteWithReassignmentAsync_WithTransactionsAndReassignTo_ShouldReassignAndDelete()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "OldCategory", Type = LabelType.Category };
        var targetLabel = new Label { Id = "2", UserId = TestUserId, Name = "NewCategory", Type = LabelType.Category };
        
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("2", TestUserId))
            .ReturnsAsync(targetLabel);
        _transactionRepositoryMock.Setup(x => x.GetCountByLabelIdAsync("1", TestUserId))
            .ReturnsAsync(5);
        _transactionRepositoryMock.Setup(x => x.ReassignLabelAsync("1", "2", TestUserId))
            .Returns(Task.CompletedTask);
        _labelRepositoryMock.Setup(x => x.DeleteAsync("1", TestUserId))
            .ReturnsAsync(true);

        // Act
        var result = await _labelService.DeleteWithReassignmentAsync("1", TestUserId, "2");

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.TransactionCount.Should().Be(5);
        
        // Verify ReassignLabelAsync was called with correct parameters
        _transactionRepositoryMock.Verify(x => x.ReassignLabelAsync("1", "2", TestUserId), Times.Once);
    }

    [Fact]
    public async Task DeleteWithReassignmentAsync_WithTransactionsButNoReassignTo_ShouldReturnFailure()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "OldCategory", Type = LabelType.Category };
        
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);
        _transactionRepositoryMock.Setup(x => x.GetCountByLabelIdAsync("1", TestUserId))
            .ReturnsAsync(5);

        // Act
        var result = await _labelService.DeleteWithReassignmentAsync("1", TestUserId, null);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("has 5 transaction(s)");
        
        // Verify ReassignLabelAsync was NOT called
        _transactionRepositoryMock.Verify(x => x.ReassignLabelAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DeleteWithReassignmentAsync_ReassignToFolder_ShouldReturnFailure()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "OldCategory", Type = LabelType.Category };
        var folderLabel = new Label { Id = "2", UserId = TestUserId, Name = "SomeFolder", Type = LabelType.Folder };
        
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("2", TestUserId))
            .ReturnsAsync(folderLabel);
        _transactionRepositoryMock.Setup(x => x.GetCountByLabelIdAsync("1", TestUserId))
            .ReturnsAsync(3);

        // Act
        var result = await _labelService.DeleteWithReassignmentAsync("1", TestUserId, "2");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Can only reassign to a category, not a folder");
    }

    [Fact]
    public async Task DeleteWithReassignmentAsync_WithNoTransactions_ShouldDeleteDirectly()
    {
        // Arrange
        var label = new Label { Id = "1", UserId = TestUserId, Name = "EmptyCategory", Type = LabelType.Category };
        
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(label);
        _transactionRepositoryMock.Setup(x => x.GetCountByLabelIdAsync("1", TestUserId))
            .ReturnsAsync(0);
        _labelRepositoryMock.Setup(x => x.DeleteAsync("1", TestUserId))
            .ReturnsAsync(true);

        // Act
        var result = await _labelService.DeleteWithReassignmentAsync("1", TestUserId, null);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.TransactionCount.Should().Be(0);
        
        // Verify ReassignLabelAsync was NOT called (no transactions to reassign)
        _transactionRepositoryMock.Verify(x => x.ReassignLabelAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DeleteWithReassignmentAsync_SystemLabel_ShouldReturnFailure()
    {
        // Arrange
        var systemLabel = new Label 
        { 
            Id = "1", 
            UserId = TestUserId, 
            Name = "Balance Adjustment", 
            Type = LabelType.Category,
            IsSystem = true 
        };
        _labelRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(systemLabel);

        // Act
        var result = await _labelService.DeleteWithReassignmentAsync("1", TestUserId, "2");

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("Cannot delete system label");
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("System labels cannot be renamed");
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
        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("System labels cannot be moved");
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
        result.IsSuccess.Should().BeTrue();
        result.Value.Icon.Should().Be("📊");
        result.Value.Color.Should().Be("#00ff00");
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
        _labelRepositoryMock.Setup(x => x.CreateManyAsync(It.IsAny<List<Label>>(), It.IsAny<CancellationToken>()))
            .Callback<List<Label>, CancellationToken>((labels, _) => capturedLabels = labels)
            .Returns(Task.CompletedTask);

        // Act
        await _labelService.CreateDefaultLabelsAsync(TestUserId);

        // Assert
        capturedLabels.Should().NotBeNull();
        
        // Root folders (no parent) should be system labels
        var rootFolders = capturedLabels!.Where(l => l.ParentId == null).ToList();
        rootFolders.Should().AllSatisfy(l => l.IsSystem.Should().BeTrue());
        rootFolders.Select(l => l.Name).Should().Contain(new[] { "Expenses", "Income", "Investments", "Gifts", "Transfers", "Adjustments" });
        
        // Non-root items (have a parent) should NOT be system labels, except for special system categories
        var nestedItems = capturedLabels!.Where(l => l.ParentId != null).ToList();
        nestedItems.Should().NotBeEmpty();
        
        // "Account Transfer" and "Balance Adjustment" categories are system labels
        var systemNestedItems = nestedItems.Where(l => l.IsSystem).ToList();
        systemNestedItems.Should().HaveCount(2);
        systemNestedItems.Select(l => l.Name).Should().Contain(new[] { "Account Transfer", "Balance Adjustment" });
        
        var nonSystemNestedItems = nestedItems.Where(l => !l.IsSystem).ToList();
        nonSystemNestedItems.Should().NotBeEmpty();
        nonSystemNestedItems.Should().AllSatisfy(l => l.IsSystem.Should().BeFalse());
    }

    #endregion

    #region GetOrCreateAdjustmentsCategoryAsync Tests

    [Fact]
    public async Task GetOrCreateAdjustmentsCategoryAsync_WithExistingCategory_ShouldReturnExisting()
    {
        // Arrange
        var existingCategory = new Label
        {
            Id = "existing-adjustment-id",
            UserId = TestUserId,
            Name = "Balance Adjustment",
            Type = LabelType.Category,
            IsSystem = true
        };
        
        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new List<Label> { existingCategory });

        // Act
        var result = await _labelService.GetOrCreateAdjustmentsCategoryAsync(TestUserId);

        // Assert
        result.Id.Should().Be("existing-adjustment-id");
        result.Name.Should().Be("Balance Adjustment");
        _labelRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<Label>()), Times.Never);
    }

    [Fact]
    public async Task GetOrCreateAdjustmentsCategoryAsync_WithNoExistingLabels_ShouldCreateFolderAndCategory()
    {
        // Arrange
        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new List<Label>());
        
        Label? createdFolder = null;
        Label? createdCategory = null;
        _labelRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Label>(), It.IsAny<CancellationToken>()))
            .Callback<Label, CancellationToken>((label, _) =>
            {
                if (label.Type == LabelType.Folder)
                    createdFolder = label;
                else if (label.Type == LabelType.Category)
                    createdCategory = label;
            })
            .ReturnsAsync((Label l, CancellationToken _) => l);

        // Act
        var result = await _labelService.GetOrCreateAdjustmentsCategoryAsync(TestUserId);

        // Assert
        createdFolder.Should().NotBeNull();
        createdFolder!.Name.Should().Be("Adjustments");
        createdFolder.Type.Should().Be(LabelType.Folder);
        createdFolder.IsSystem.Should().BeTrue();
        
        createdCategory.Should().NotBeNull();
        createdCategory!.Name.Should().Be("Balance Adjustment");
        createdCategory.Type.Should().Be(LabelType.Category);
        createdCategory.IsSystem.Should().BeTrue();
        createdCategory.ParentId.Should().Be(createdFolder.Id);
        
        result.Name.Should().Be("Balance Adjustment");
    }

    [Fact]
    public async Task GetOrCreateAdjustmentsCategoryAsync_WithExistingFolder_ShouldOnlyCreateCategory()
    {
        // Arrange
        var existingFolder = new Label
        {
            Id = "existing-folder-id",
            UserId = TestUserId,
            Name = "Adjustments",
            Type = LabelType.Folder,
            IsSystem = true
        };
        
        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new List<Label> { existingFolder });
        
        Label? createdLabel = null;
        _labelRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Label>(), It.IsAny<CancellationToken>()))
            .Callback<Label, CancellationToken>((label, _) => createdLabel = label)
            .ReturnsAsync((Label l, CancellationToken _) => l);

        // Act
        var result = await _labelService.GetOrCreateAdjustmentsCategoryAsync(TestUserId);

        // Assert
        // Should only create category, not folder
        _labelRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<Label>()), Times.Once);
        
        createdLabel.Should().NotBeNull();
        createdLabel!.Name.Should().Be("Balance Adjustment");
        createdLabel.Type.Should().Be(LabelType.Category);
        createdLabel.ParentId.Should().Be("existing-folder-id");
    }

    #endregion
}
