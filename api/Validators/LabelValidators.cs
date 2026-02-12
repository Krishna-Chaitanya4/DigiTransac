using FluentValidation;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Validators;

public class CreateLabelRequestValidator : AbstractValidator<CreateLabelRequest>
{
    private static readonly string[] ValidTypes = { "Folder", "Category" };
    
    public CreateLabelRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Label name is required")
            .MaximumLength(100).WithMessage("Label name cannot exceed 100 characters");
        
        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("Label type is required")
            .Must(type => ValidTypes.Contains(type))
            .WithMessage("Label type must be 'Folder' or 'Category'");
        
        RuleFor(x => x.Color)
            .Matches(@"^#[0-9A-Fa-f]{6}$").When(x => !string.IsNullOrEmpty(x.Color))
            .WithMessage("Color must be a valid hex color (e.g., #FF5733)");
    }
}

public class UpdateLabelRequestValidator : AbstractValidator<UpdateLabelRequest>
{
    public UpdateLabelRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Label name is required")
            .MaximumLength(100).WithMessage("Label name cannot exceed 100 characters")
            .When(x => x.Name is not null);
        
        RuleFor(x => x.Color)
            .Matches(@"^#[0-9A-Fa-f]{6}$").When(x => !string.IsNullOrEmpty(x.Color))
            .WithMessage("Color must be a valid hex color (e.g., #FF5733)");
        
        RuleFor(x => x.Order)
            .GreaterThanOrEqualTo(0).When(x => x.Order.HasValue)
            .WithMessage("Order must be a non-negative number");
    }
}

public class ReorderLabelsRequestValidator : AbstractValidator<ReorderLabelsRequest>
{
    public ReorderLabelsRequestValidator()
    {
        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("Items list is required");
        
        RuleForEach(x => x.Items).SetValidator(new LabelOrderItemValidator());
    }
}

public class LabelOrderItemValidator : AbstractValidator<LabelOrderItem>
{
    public LabelOrderItemValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Label ID is required");
        
        RuleFor(x => x.Order)
            .GreaterThanOrEqualTo(0).WithMessage("Order must be a non-negative number");
    }
}
