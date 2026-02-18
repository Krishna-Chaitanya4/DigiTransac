using DigiTransac.Api.Validators;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;

namespace DigiTransac.Tests.Validators;

// Test the ValidationExtensions using a concrete validator
public class ValidationExtensionsTests
{
    // Simple test record and validator for testing the extension methods
    private record TestRequest(string Name, string Email);

    private class TestValidator : AbstractValidator<TestRequest>
    {
        public TestValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required");
            RuleFor(x => x.Email).EmailAddress().WithMessage("Invalid email");
        }
    }

    private readonly TestValidator _validator = new();

    [Fact]
    public async Task ValidateAndReturnErrorAsync_Valid_Request_Returns_Null()
    {
        var request = new TestRequest("John", "john@example.com");
        var result = await _validator.ValidateAndReturnErrorAsync(request);
        result.Should().BeNull();
    }

    [Fact]
    public async Task ValidateAndReturnErrorAsync_Invalid_Request_Returns_ValidationProblem()
    {
        var request = new TestRequest("", "not-email");
        var result = await _validator.ValidateAndReturnErrorAsync(request);
        result.Should().NotBeNull();
    }

    [Fact]
    public async Task ValidateWithFirstErrorAsync_Valid_Request_Returns_IsValid_True()
    {
        var request = new TestRequest("John", "john@example.com");
        var (isValid, errorMessage) = await _validator.ValidateWithFirstErrorAsync(request);
        isValid.Should().BeTrue();
        errorMessage.Should().BeNull();
    }

    [Fact]
    public async Task ValidateWithFirstErrorAsync_Invalid_Request_Returns_First_Error()
    {
        var request = new TestRequest("", "john@example.com");
        var (isValid, errorMessage) = await _validator.ValidateWithFirstErrorAsync(request);
        isValid.Should().BeFalse();
        errorMessage.Should().Be("Name is required");
    }

    [Fact]
    public async Task ValidateWithFirstErrorAsync_Multiple_Errors_Returns_First_Only()
    {
        var request = new TestRequest("", "bad");
        var (isValid, errorMessage) = await _validator.ValidateWithFirstErrorAsync(request);
        isValid.Should().BeFalse();
        errorMessage.Should().NotBeNullOrEmpty();
    }
}
