using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Validators;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace DigiTransac.Tests.Validators;

public class CreateLabelRequestValidatorTests
{
    private readonly CreateLabelRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var request = new CreateLabelRequest("Food", null, "Category", null, "#22c55e");
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Empty_Name_Should_Fail(string? name)
    {
        var request = new CreateLabelRequest(name!, null, "Category", null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Name_Exceeds_100_Should_Fail()
    {
        var request = new CreateLabelRequest(new string('L', 101), null, "Category", null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Theory]
    [InlineData("Folder")]
    [InlineData("Category")]
    public void Valid_Types_Should_Pass(string type)
    {
        var request = new CreateLabelRequest("Test", null, type, null, null);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Invalid_Type_Should_Fail()
    {
        var request = new CreateLabelRequest("Test", null, "Tag", null, null);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Invalid_Color_Should_Fail()
    {
        var request = new CreateLabelRequest("Test", null, "Category", null, "blue");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Color);
    }

    [Fact]
    public void Null_Color_Should_Pass()
    {
        var request = new CreateLabelRequest("Test", null, "Category", null, null);
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveValidationErrorFor(x => x.Color);
    }
}

public class UpdateLabelRequestValidatorTests
{
    private readonly UpdateLabelRequestValidator _validator = new();

    [Fact]
    public void Empty_Update_Should_Pass()
    {
        var request = new UpdateLabelRequest();
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Name_Exceeds_100_Should_Fail()
    {
        var request = new UpdateLabelRequest(Name: new string('L', 101));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Order_Negative_Should_Fail()
    {
        var request = new UpdateLabelRequest(Order: -1);
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Order);
    }

    [Fact]
    public void Invalid_Color_Should_Fail()
    {
        var request = new UpdateLabelRequest(Color: "not-a-color");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Color);
    }
}

public class ReorderLabelsRequestValidatorTests
{
    private readonly ReorderLabelsRequestValidator _validator = new();

    [Fact]
    public void Valid_Reorder_Should_Pass()
    {
        var request = new ReorderLabelsRequest(new List<LabelOrderItem>
        {
            new("id1", 0),
            new("id2", 1)
        });
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_Items_Should_Fail()
    {
        var request = new ReorderLabelsRequest(new List<LabelOrderItem>());
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Items);
    }
}
