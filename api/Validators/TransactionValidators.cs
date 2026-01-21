using FluentValidation;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Validators;

public class CreateTransactionRequestValidator : AbstractValidator<CreateTransactionRequest>
{
    private static readonly string[] ValidTypes = { "Credit", "Debit", "Transfer" };
    private static readonly string[] ValidFrequencies = { "Daily", "Weekly", "Biweekly", "Monthly", "Quarterly", "Yearly" };
    
    public CreateTransactionRequestValidator()
    {
        RuleFor(x => x.AccountId)
            .NotEmpty().WithMessage("Account ID is required");
        
        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("Transaction type is required")
            .Must(type => ValidTypes.Contains(type))
            .WithMessage($"Transaction type must be one of: {string.Join(", ", ValidTypes)}");
        
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than 0");
        
        RuleFor(x => x.Date)
            .NotEmpty().WithMessage("Date is required");
        
        RuleFor(x => x.Title)
            .MaximumLength(200).When(x => !string.IsNullOrEmpty(x.Title))
            .WithMessage("Title cannot exceed 200 characters");
        
        RuleFor(x => x.Payee)
            .MaximumLength(200).When(x => !string.IsNullOrEmpty(x.Payee))
            .WithMessage("Payee cannot exceed 200 characters");
        
        RuleFor(x => x.Notes)
            .MaximumLength(1000).When(x => !string.IsNullOrEmpty(x.Notes))
            .WithMessage("Notes cannot exceed 1000 characters");
        
        RuleFor(x => x.TransferToAccountId)
            .NotEmpty().When(x => x.Type == "Transfer")
            .WithMessage("Transfer destination account is required for transfers");
        
        RuleFor(x => x.TransferToAccountId)
            .NotEqual(x => x.AccountId).When(x => x.Type == "Transfer" && !string.IsNullOrEmpty(x.TransferToAccountId))
            .WithMessage("Cannot transfer to the same account");
        
        RuleFor(x => x.Splits)
            .NotEmpty().WithMessage("At least one split is required");
        
        RuleForEach(x => x.Splits).SetValidator(new TransactionSplitRequestValidator());
        
        // Validate that splits sum equals amount
        RuleFor(x => x)
            .Must(x => x.Splits == null || x.Splits.Sum(s => s.Amount) == x.Amount)
            .WithMessage("Split amounts must equal the transaction amount");
        
        When(x => x.RecurringRule != null, () =>
        {
            RuleFor(x => x.RecurringRule!.Frequency)
                .NotEmpty().WithMessage("Recurring frequency is required")
                .Must(freq => ValidFrequencies.Contains(freq))
                .WithMessage($"Frequency must be one of: {string.Join(", ", ValidFrequencies)}");
            
            RuleFor(x => x.RecurringRule!.Interval)
                .GreaterThanOrEqualTo(1).When(x => x.RecurringRule!.Interval.HasValue)
                .WithMessage("Interval must be at least 1");
        });
        
        When(x => x.Location != null, () =>
        {
            RuleFor(x => x.Location!.Latitude)
                .InclusiveBetween(-90, 90).WithMessage("Latitude must be between -90 and 90");
            
            RuleFor(x => x.Location!.Longitude)
                .InclusiveBetween(-180, 180).WithMessage("Longitude must be between -180 and 180");
        });
    }
}

public class TransactionSplitRequestValidator : AbstractValidator<TransactionSplitRequest>
{
    public TransactionSplitRequestValidator()
    {
        RuleFor(x => x.LabelId)
            .NotEmpty().WithMessage("Label ID is required for each split");
        
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Split amount must be greater than 0");
        
        RuleFor(x => x.Notes)
            .MaximumLength(500).When(x => !string.IsNullOrEmpty(x.Notes))
            .WithMessage("Split notes cannot exceed 500 characters");
    }
}

public class UpdateTransactionRequestValidator : AbstractValidator<UpdateTransactionRequest>
{
    private static readonly string[] ValidTypes = { "Credit", "Debit", "Transfer" };
    
    public UpdateTransactionRequestValidator()
    {
        RuleFor(x => x.Type)
            .Must(type => ValidTypes.Contains(type!)).When(x => !string.IsNullOrEmpty(x.Type))
            .WithMessage($"Transaction type must be one of: {string.Join(", ", ValidTypes)}");
        
        RuleFor(x => x.Amount)
            .GreaterThan(0).When(x => x.Amount.HasValue)
            .WithMessage("Amount must be greater than 0");
        
        RuleFor(x => x.Title)
            .MaximumLength(200).When(x => !string.IsNullOrEmpty(x.Title))
            .WithMessage("Title cannot exceed 200 characters");
        
        RuleFor(x => x.Payee)
            .MaximumLength(200).When(x => !string.IsNullOrEmpty(x.Payee))
            .WithMessage("Payee cannot exceed 200 characters");
        
        RuleFor(x => x.Notes)
            .MaximumLength(1000).When(x => !string.IsNullOrEmpty(x.Notes))
            .WithMessage("Notes cannot exceed 1000 characters");
        
        When(x => x.Splits != null && x.Splits.Count > 0, () =>
        {
            RuleForEach(x => x.Splits).SetValidator(new TransactionSplitRequestValidator());
        });
        
        When(x => x.Location != null, () =>
        {
            RuleFor(x => x.Location!.Latitude)
                .InclusiveBetween(-90, 90).WithMessage("Latitude must be between -90 and 90");
            
            RuleFor(x => x.Location!.Longitude)
                .InclusiveBetween(-180, 180).WithMessage("Longitude must be between -180 and 180");
        });
    }
}

public class TransactionFilterRequestValidator : AbstractValidator<TransactionFilterRequest>
{
    private static readonly string[] ValidTypes = { "Credit", "Debit", "Transfer" };
    
    public TransactionFilterRequestValidator()
    {
        RuleFor(x => x.StartDate)
            .LessThanOrEqualTo(x => x.EndDate).When(x => x.StartDate.HasValue && x.EndDate.HasValue)
            .WithMessage("Start date must be before or equal to end date");
        
        RuleFor(x => x.MinAmount)
            .GreaterThanOrEqualTo(0).When(x => x.MinAmount.HasValue)
            .WithMessage("Minimum amount cannot be negative");
        
        RuleFor(x => x.MaxAmount)
            .GreaterThanOrEqualTo(x => x.MinAmount ?? 0).When(x => x.MaxAmount.HasValue && x.MinAmount.HasValue)
            .WithMessage("Maximum amount must be greater than or equal to minimum amount");
        
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1).When(x => x.Page.HasValue)
            .WithMessage("Page must be at least 1");
        
        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100).When(x => x.PageSize.HasValue)
            .WithMessage("Page size must be between 1 and 100");
        
        RuleForEach(x => x.Types)
            .Must(type => ValidTypes.Contains(type))
            .When(x => x.Types != null && x.Types.Count > 0)
            .WithMessage($"Transaction type must be one of: {string.Join(", ", ValidTypes)}");
    }
}

public class BatchOperationRequestValidator : AbstractValidator<BatchOperationRequest>
{
    private static readonly string[] ValidActions = { "delete", "markcleared", "markpending", "updatecategory" };
    
    public BatchOperationRequestValidator()
    {
        RuleFor(x => x.Ids)
            .NotEmpty().WithMessage("No transaction IDs provided");
        
        RuleFor(x => x.Action)
            .NotEmpty().WithMessage("Action is required")
            .Must(action => ValidActions.Contains(action.ToLowerInvariant()))
            .When(x => !string.IsNullOrEmpty(x.Action))
            .WithMessage($"Action must be one of: {string.Join(", ", ValidActions)}");
        
        RuleFor(x => x.LabelId)
            .NotEmpty().When(x => x.Action?.ToLowerInvariant() == "updatecategory")
            .WithMessage("Label ID is required for updateCategory action");
    }
}
