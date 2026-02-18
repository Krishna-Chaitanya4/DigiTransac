using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Validators;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace DigiTransac.Tests.Validators;

public class CreateTagRequestValidatorTests
{
    private readonly CreateTagRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var result = _validator.TestValidate(new CreateTagRequest("Vacation", "#3b82f6"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Empty_Name_Should_Fail(string? name)
    {
        var result = _validator.TestValidate(new CreateTagRequest(name!, null));
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Name_Exceeds_50_Should_Fail()
    {
        var result = _validator.TestValidate(new CreateTagRequest(new string('T', 51), null));
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Invalid_Color_Should_Fail()
    {
        var result = _validator.TestValidate(new CreateTagRequest("Test", "green"));
        result.ShouldHaveValidationErrorFor(x => x.Color);
    }

    [Fact]
    public void Null_Color_Should_Pass()
    {
        var result = _validator.TestValidate(new CreateTagRequest("Test", null));
        result.ShouldNotHaveValidationErrorFor(x => x.Color);
    }
}

public class UpdateTagRequestValidatorTests
{
    private readonly UpdateTagRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var result = _validator.TestValidate(new UpdateTagRequest("Updated", "#FF0000"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_Name_Should_Fail()
    {
        var result = _validator.TestValidate(new UpdateTagRequest("", null));
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Name_Exceeds_50_Should_Fail()
    {
        var result = _validator.TestValidate(new UpdateTagRequest(new string('T', 51), null));
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }
}
