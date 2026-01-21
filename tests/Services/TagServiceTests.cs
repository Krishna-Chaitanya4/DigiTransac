using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Tag = DigiTransac.Api.Models.Tag;

namespace DigiTransac.Tests.Services;

public class TagServiceTests
{
    private readonly Mock<ITagRepository> _tagRepositoryMock;
    private readonly Mock<ITransactionRepository> _transactionRepositoryMock;
    private readonly Mock<ILogger<TagService>> _loggerMock;
    private readonly TagService _tagService;
    private const string TestUserId = "test-user-id";

    public TagServiceTests()
    {
        _tagRepositoryMock = new Mock<ITagRepository>();
        _transactionRepositoryMock = new Mock<ITransactionRepository>();
        _loggerMock = new Mock<ILogger<TagService>>();
        _tagService = new TagService(_tagRepositoryMock.Object, _transactionRepositoryMock.Object, _loggerMock.Object);
    }

    #region GetAllAsync Tests

    [Fact]
    public async Task GetAllAsync_ShouldReturnAllTagsForUser()
    {
        // Arrange
        var tags = new List<Tag>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Tax Deductible", Color = "#22c55e" },
            new() { Id = "2", UserId = TestUserId, Name = "Vacation", Color = "#3b82f6" }
        };
        _tagRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(tags);

        // Act
        var result = await _tagService.GetAllAsync(TestUserId);

        // Assert
        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Tax Deductible");
        result[0].Color.Should().Be("#22c55e");
        result[1].Name.Should().Be("Vacation");
    }

    [Fact]
    public async Task GetAllAsync_WithNoTags_ShouldReturnEmptyList()
    {
        // Arrange
        _tagRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new List<Tag>());

        // Act
        var result = await _tagService.GetAllAsync(TestUserId);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region GetByIdAsync Tests

    [Fact]
    public async Task GetByIdAsync_WithValidId_ShouldReturnTag()
    {
        // Arrange
        var tag = new Tag { Id = "1", UserId = TestUserId, Name = "Test", Color = "#ef4444" };
        _tagRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(tag);

        // Act
        var result = await _tagService.GetByIdAsync("1", TestUserId);

        // Assert
        result.Should().NotBeNull();
        result!.Name.Should().Be("Test");
        result.Color.Should().Be("#ef4444");
    }

    [Fact]
    public async Task GetByIdAsync_WithInvalidId_ShouldReturnNull()
    {
        // Arrange
        _tagRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid", TestUserId))
            .ReturnsAsync((Tag?)null);

        // Act
        var result = await _tagService.GetByIdAsync("invalid", TestUserId);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region CreateAsync Tests

    [Fact]
    public async Task CreateAsync_WithValidData_ShouldCreateTag()
    {
        // Arrange
        var request = new CreateTagRequest("New Tag", "#3b82f6");
        _tagRepositoryMock.Setup(x => x.GetByNameAndUserIdAsync("New Tag", TestUserId))
            .ReturnsAsync((Tag?)null);
        _tagRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Tag>()))
            .ReturnsAsync((Tag t) => t);

        // Act
        var result = await _tagService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Tag.Should().NotBeNull();
        result.Tag!.Name.Should().Be("New Tag");
        result.Tag.Color.Should().Be("#3b82f6");
    }

    [Fact]
    public async Task CreateAsync_WithEmptyName_ShouldReturnFailure()
    {
        // Arrange
        var request = new CreateTagRequest("", null);

        // Act
        var result = await _tagService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Name is required");
    }

    [Fact]
    public async Task CreateAsync_WithWhitespaceName_ShouldReturnFailure()
    {
        // Arrange
        var request = new CreateTagRequest("   ", null);

        // Act
        var result = await _tagService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Name is required");
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateName_ShouldReturnFailure()
    {
        // Arrange
        var existingTag = new Tag { Id = "existing", UserId = TestUserId, Name = "Duplicate" };
        _tagRepositoryMock.Setup(x => x.GetByNameAndUserIdAsync("Duplicate", TestUserId))
            .ReturnsAsync(existingTag);

        var request = new CreateTagRequest("Duplicate", null);

        // Act
        var result = await _tagService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Tag with this name already exists");
    }

    [Fact]
    public async Task CreateAsync_WithNoColor_ShouldCreateTagWithNullColor()
    {
        // Arrange
        var request = new CreateTagRequest("No Color Tag", null);
        _tagRepositoryMock.Setup(x => x.GetByNameAndUserIdAsync("No Color Tag", TestUserId))
            .ReturnsAsync((Tag?)null);
        _tagRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Tag>()))
            .ReturnsAsync((Tag t) => t);

        // Act
        var result = await _tagService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Tag!.Color.Should().BeNull();
    }

    #endregion

    #region UpdateAsync Tests

    [Fact]
    public async Task UpdateAsync_WithValidData_ShouldUpdateTag()
    {
        // Arrange
        var tag = new Tag { Id = "1", UserId = TestUserId, Name = "Old Name", Color = "#ef4444" };
        _tagRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(tag);
        _tagRepositoryMock.Setup(x => x.GetByNameAndUserIdAsync("New Name", TestUserId))
            .ReturnsAsync((Tag?)null);
        _tagRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<Tag>()))
            .Returns(Task.CompletedTask);

        var request = new UpdateTagRequest("New Name", "#22c55e");

        // Act
        var result = await _tagService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Tag!.Name.Should().Be("New Name");
        result.Tag.Color.Should().Be("#22c55e");
    }

    [Fact]
    public async Task UpdateAsync_WithNonExistentTag_ShouldReturnFailure()
    {
        // Arrange
        _tagRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("nonexistent", TestUserId))
            .ReturnsAsync((Tag?)null);

        var request = new UpdateTagRequest("New Name", null);

        // Act
        var result = await _tagService.UpdateAsync("nonexistent", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Tag not found");
    }

    [Fact]
    public async Task UpdateAsync_WithEmptyName_ShouldReturnFailure()
    {
        // Arrange
        var tag = new Tag { Id = "1", UserId = TestUserId, Name = "Test" };
        _tagRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(tag);

        var request = new UpdateTagRequest("", null);

        // Act
        var result = await _tagService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Name is required");
    }

    [Fact]
    public async Task UpdateAsync_WithDuplicateName_ShouldReturnFailure()
    {
        // Arrange
        var tag = new Tag { Id = "1", UserId = TestUserId, Name = "Original" };
        var existingTag = new Tag { Id = "2", UserId = TestUserId, Name = "Taken Name" };
        _tagRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(tag);
        _tagRepositoryMock.Setup(x => x.GetByNameAndUserIdAsync("Taken Name", TestUserId))
            .ReturnsAsync(existingTag);

        var request = new UpdateTagRequest("Taken Name", null);

        // Act
        var result = await _tagService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Tag with this name already exists");
    }

    [Fact]
    public async Task UpdateAsync_WithSameName_ShouldSucceed()
    {
        // Arrange
        var tag = new Tag { Id = "1", UserId = TestUserId, Name = "Same Name" };
        _tagRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(tag);
        // Same tag returned (same ID) - this should be allowed
        _tagRepositoryMock.Setup(x => x.GetByNameAndUserIdAsync("Same Name", TestUserId))
            .ReturnsAsync(tag);
        _tagRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<Tag>()))
            .Returns(Task.CompletedTask);

        var request = new UpdateTagRequest("Same Name", "#new-color");

        // Act
        var result = await _tagService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
    }

    #endregion

    #region DeleteAsync Tests

    [Fact]
    public async Task DeleteAsync_WithValidId_ShouldDeleteTag()
    {
        // Arrange
        var tag = new Tag { Id = "1", UserId = TestUserId, Name = "Test" };
        _tagRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(tag);
        _tagRepositoryMock.Setup(x => x.DeleteAsync("1", TestUserId))
            .ReturnsAsync(true);

        // Act
        var result = await _tagService.DeleteAsync("1", TestUserId);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistentTag_ShouldReturnFailure()
    {
        // Arrange
        _tagRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("nonexistent", TestUserId))
            .ReturnsAsync((Tag?)null);

        // Act
        var result = await _tagService.DeleteAsync("nonexistent", TestUserId);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Tag not found");
    }

    #endregion
}
