using DigiTransac.Api.Common;

namespace DigiTransac.Api.Tests.Common;

public class ResultTests
{
    [Fact]
    public void Success_ShouldCreateSuccessfulResult()
    {
        // Act
        var result = Result.Success();

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.IsFailure.Should().BeFalse();
        result.Error.Should().Be(Error.None);
    }

    [Fact]
    public void Failure_ShouldCreateFailedResult()
    {
        // Arrange
        var error = Error.NotFound("Test", "123");

        // Act
        var result = Result.Failure(error);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(error);
    }

    [Fact]
    public void GenericSuccess_ShouldContainValue()
    {
        // Arrange
        var expectedValue = "test value";

        // Act
        var result = Result.Success(expectedValue);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(expectedValue);
    }

    [Fact]
    public void GenericFailure_ShouldThrowWhenAccessingValue()
    {
        // Arrange
        var error = Error.Validation("Invalid input");
        var result = Result.Failure<string>(error);

        // Act & Assert
        result.IsFailure.Should().BeTrue();
        Assert.Throws<InvalidOperationException>(() => _ = result.Value);
    }

    [Fact]
    public void ImplicitConversion_FromValue_ShouldCreateSuccess()
    {
        // Act
        Result<int> result = 42;

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(42);
    }

    [Fact]
    public void ImplicitConversion_FromError_ShouldCreateFailure()
    {
        // Arrange
        var error = Error.InternalError();

        // Act
        Result<string> result = error;

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(error);
    }
}

public class ErrorTests
{
    [Fact]
    public void NotFound_ShouldCreateNotFoundError()
    {
        // Act
        var error = Error.NotFound("User", "123");

        // Assert
        error.Code.Should().Be("NotFound");
        error.Message.Should().Contain("User");
        error.Message.Should().Contain("123");
    }

    [Fact]
    public void Validation_ShouldCreateValidationError()
    {
        // Arrange
        var message = "Field is required";

        // Act
        var error = Error.Validation(message);

        // Assert
        error.Code.Should().Be("Validation");
        error.Message.Should().Be(message);
    }

    [Fact]
    public void DomainErrors_Transaction_InvalidAmount_ShouldHaveCorrectMessage()
    {
        // Act
        var error = DomainErrors.Transaction.InvalidAmount;

        // Assert
        error.Code.Should().Be("Validation");
        error.Message.Should().Contain("positive");
    }

    [Fact]
    public void DomainErrors_Account_NotFound_ShouldIncludeId()
    {
        // Arrange
        var accountId = "acc123";

        // Act
        var error = DomainErrors.Account.NotFound(accountId);

        // Assert
        error.Code.Should().Be("NotFound");
        error.Message.Should().Contain(accountId);
    }
}

public class ResultExtensionsTests
{
    [Fact]
    public void Map_OnSuccess_ShouldTransformValue()
    {
        // Arrange
        var result = Result.Success(5);

        // Act
        var mapped = result.Map(x => x * 2);

        // Assert
        mapped.IsSuccess.Should().BeTrue();
        mapped.Value.Should().Be(10);
    }

    [Fact]
    public void Map_OnFailure_ShouldPropagateError()
    {
        // Arrange
        var error = Error.Validation("error");
        var result = Result.Failure<int>(error);

        // Act
        var mapped = result.Map(x => x * 2);

        // Assert
        mapped.IsFailure.Should().BeTrue();
        mapped.Error.Should().Be(error);
    }

    [Fact]
    public void Ensure_WhenPredicateFails_ShouldReturnFailure()
    {
        // Arrange
        var result = Result.Success(5);
        var error = Error.Validation("Must be greater than 10");

        // Act
        var ensured = result.Ensure(x => x > 10, error);

        // Assert
        ensured.IsFailure.Should().BeTrue();
        ensured.Error.Should().Be(error);
    }

    [Fact]
    public void Ensure_WhenPredicatePasses_ShouldReturnOriginalResult()
    {
        // Arrange
        var result = Result.Success(15);
        var error = Error.Validation("Must be greater than 10");

        // Act
        var ensured = result.Ensure(x => x > 10, error);

        // Assert
        ensured.IsSuccess.Should().BeTrue();
        ensured.Value.Should().Be(15);
    }

    [Fact]
    public void Match_OnSuccess_ShouldCallSuccessHandler()
    {
        // Arrange
        var result = Result.Success("hello");

        // Act
        var output = result.Match(
            onSuccess: v => $"Success: {v}",
            onFailure: e => $"Error: {e.Message}"
        );

        // Assert
        output.Should().Be("Success: hello");
    }

    [Fact]
    public void Match_OnFailure_ShouldCallFailureHandler()
    {
        // Arrange
        var error = Error.Validation("invalid");
        var result = Result.Failure<string>(error);

        // Act
        var output = result.Match(
            onSuccess: v => $"Success: {v}",
            onFailure: e => $"Error: {e.Message}"
        );

        // Assert
        output.Should().Be("Error: invalid");
    }

    [Fact]
    public void Combine_AllSuccess_ShouldReturnSuccess()
    {
        // Arrange
        var r1 = Result.Success();
        var r2 = Result.Success();
        var r3 = Result.Success();

        // Act
        var combined = ResultExtensions.Combine(r1, r2, r3);

        // Assert
        combined.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void Combine_OneFailure_ShouldReturnFailure()
    {
        // Arrange
        var r1 = Result.Success();
        var error = Error.Validation("failed");
        var r2 = Result.Failure(error);
        var r3 = Result.Success();

        // Act
        var combined = ResultExtensions.Combine(r1, r2, r3);

        // Assert
        combined.IsFailure.Should().BeTrue();
        combined.Error.Should().Be(error);
    }
}