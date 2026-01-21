using FluentValidation;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Validators;

public class CreateAccountRequestValidator : AbstractValidator<CreateAccountRequest>
{
    private static readonly string[] ValidAccountTypes = { "Bank", "CreditCard", "Cash", "DigitalWallet", "Investment", "Loan" };
    
    public CreateAccountRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Account name is required")
            .MaximumLength(100).WithMessage("Account name cannot exceed 100 characters");
        
        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("Account type is required")
            .Must(type => ValidAccountTypes.Contains(type))
            .WithMessage($"Account type must be one of: {string.Join(", ", ValidAccountTypes)}");
        
        RuleFor(x => x.Currency)
            .Length(3).When(x => !string.IsNullOrEmpty(x.Currency))
            .WithMessage("Currency must be a 3-letter code (e.g., USD, EUR)");
        
        RuleFor(x => x.InitialBalance)
            .GreaterThanOrEqualTo(0).When(x => x.InitialBalance.HasValue && x.Type != "Credit Card" && x.Type != "Loan")
            .WithMessage("Initial balance cannot be negative for this account type");
        
        RuleFor(x => x.AccountNumber)
            .MaximumLength(50).When(x => !string.IsNullOrEmpty(x.AccountNumber))
            .WithMessage("Account number cannot exceed 50 characters");
        
        RuleFor(x => x.Institution)
            .MaximumLength(100).When(x => !string.IsNullOrEmpty(x.Institution))
            .WithMessage("Institution name cannot exceed 100 characters");
        
        RuleFor(x => x.Notes)
            .MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes))
            .WithMessage("Notes cannot exceed 500 characters");
    }
}

public class UpdateAccountRequestValidator : AbstractValidator<UpdateAccountRequest>
{
    public UpdateAccountRequestValidator()
    {
        RuleFor(x => x.Name)
            .MaximumLength(100).When(x => !string.IsNullOrEmpty(x.Name))
            .WithMessage("Account name cannot exceed 100 characters");
        
        RuleFor(x => x.Currency)
            .Length(3).When(x => !string.IsNullOrEmpty(x.Currency))
            .WithMessage("Currency must be a 3-letter code (e.g., USD, EUR)");
        
        RuleFor(x => x.AccountNumber)
            .MaximumLength(50).When(x => !string.IsNullOrEmpty(x.AccountNumber))
            .WithMessage("Account number cannot exceed 50 characters");
        
        RuleFor(x => x.Institution)
            .MaximumLength(100).When(x => !string.IsNullOrEmpty(x.Institution))
            .WithMessage("Institution name cannot exceed 100 characters");
        
        RuleFor(x => x.Notes)
            .MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes))
            .WithMessage("Notes cannot exceed 500 characters");
        
        RuleFor(x => x.Order)
            .GreaterThanOrEqualTo(0).When(x => x.Order.HasValue)
            .WithMessage("Order must be a non-negative number");
    }
}

public class ReorderAccountsRequestValidator : AbstractValidator<ReorderAccountsRequest>
{
    public ReorderAccountsRequestValidator()
    {
        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("Items list is required");
        
        RuleForEach(x => x.Items).SetValidator(new AccountOrderItemValidator());
    }
}

public class AccountOrderItemValidator : AbstractValidator<AccountOrderItem>
{
    public AccountOrderItemValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Account ID is required");
        
        RuleFor(x => x.Order)
            .GreaterThanOrEqualTo(0).WithMessage("Order must be a non-negative number");
    }
}

public class AdjustBalanceRequestValidator : AbstractValidator<AdjustBalanceRequest>
{
    public AdjustBalanceRequestValidator()
    {
        RuleFor(x => x.Notes)
            .MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes))
            .WithMessage("Notes cannot exceed 500 characters");
    }
}
