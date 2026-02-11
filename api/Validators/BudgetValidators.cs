using FluentValidation;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Validators;

public class CreateBudgetRequestValidator : AbstractValidator<CreateBudgetRequest>
{
    private static readonly string[] ValidPeriods = { "Weekly", "Monthly", "Quarterly", "Yearly", "Custom" };

    public CreateBudgetRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Budget name is required")
            .MaximumLength(100).WithMessage("Budget name cannot exceed 100 characters");

        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than 0");

        RuleFor(x => x.Currency)
            .NotEmpty().WithMessage("Currency is required")
            .Length(3).WithMessage("Currency must be a 3-letter code");

        RuleFor(x => x.Period)
            .NotEmpty().WithMessage("Period is required")
            .Must(p => ValidPeriods.Contains(p))
            .WithMessage("Period must be one of: Weekly, Monthly, Quarterly, Yearly, Custom");

        RuleFor(x => x.EndDate)
            .NotNull().When(x => x.Period == "Custom")
            .WithMessage("End date is required for custom period budgets");

        RuleFor(x => x.EndDate)
            .GreaterThan(x => x.StartDate).When(x => x.EndDate.HasValue && x.StartDate.HasValue)
            .WithMessage("End date must be after start date");

        RuleFor(x => x.Color)
            .Matches(@"^#[0-9A-Fa-f]{6}$").When(x => !string.IsNullOrEmpty(x.Color))
            .WithMessage("Color must be a valid hex color (e.g., #FF5733)");

        RuleForEach(x => x.Alerts).SetValidator(new BudgetAlertRequestValidator())
            .When(x => x.Alerts != null && x.Alerts.Count > 0);

        RuleFor(x => x.Description)
            .MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Description))
            .WithMessage("Description cannot exceed 500 characters");
    }
}

public class UpdateBudgetRequestValidator : AbstractValidator<UpdateBudgetRequest>
{
    private static readonly string[] ValidPeriods = { "Weekly", "Monthly", "Quarterly", "Yearly", "Custom" };

    public UpdateBudgetRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().When(x => x.Name != null)
            .WithMessage("Budget name cannot be empty")
            .MaximumLength(100).When(x => x.Name != null)
            .WithMessage("Budget name cannot exceed 100 characters");

        RuleFor(x => x.Amount)
            .GreaterThan(0).When(x => x.Amount.HasValue)
            .WithMessage("Amount must be greater than 0");

        RuleFor(x => x.Currency)
            .Length(3).When(x => !string.IsNullOrEmpty(x.Currency))
            .WithMessage("Currency must be a 3-letter code");

        RuleFor(x => x.Period)
            .Must(p => ValidPeriods.Contains(p!)).When(x => !string.IsNullOrEmpty(x.Period))
            .WithMessage("Period must be one of: Weekly, Monthly, Quarterly, Yearly, Custom");

        RuleFor(x => x.EndDate)
            .NotNull().When(x => x.Period == "Custom")
            .WithMessage("End date is required for custom period budgets");

        RuleFor(x => x.EndDate)
            .GreaterThan(x => x.StartDate).When(x => x.EndDate.HasValue && x.StartDate.HasValue)
            .WithMessage("End date must be after start date");

        RuleFor(x => x.Color)
            .Matches(@"^#[0-9A-Fa-f]{6}$").When(x => !string.IsNullOrEmpty(x.Color))
            .WithMessage("Color must be a valid hex color (e.g., #FF5733)");

        RuleForEach(x => x.Alerts).SetValidator(new BudgetAlertRequestValidator())
            .When(x => x.Alerts != null && x.Alerts.Count > 0);

        RuleFor(x => x.Description)
            .MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Description))
            .WithMessage("Description cannot exceed 500 characters");
    }
}

public class BudgetAlertRequestValidator : AbstractValidator<BudgetAlertRequest>
{
    public BudgetAlertRequestValidator()
    {
        RuleFor(x => x.ThresholdPercent)
            .InclusiveBetween(1, 200)
            .WithMessage("Alert threshold must be between 1% and 200%");
    }
}