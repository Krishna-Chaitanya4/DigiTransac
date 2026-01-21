using FluentValidation;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Validators;

public class UpdatePrimaryCurrencyRequestValidator : AbstractValidator<UpdatePrimaryCurrencyRequest>
{
    public UpdatePrimaryCurrencyRequestValidator()
    {
        RuleFor(x => x.Currency)
            .NotEmpty().WithMessage("Currency code is required")
            .Length(3).WithMessage("Currency must be a 3-letter code (e.g., USD, EUR)")
            .Must(currency => CurrencyConfig.IsValidCurrency(currency.ToUpperInvariant()))
            .When(x => !string.IsNullOrEmpty(x.Currency))
            .WithMessage(x => $"Unsupported currency: {x.Currency}");
    }
}
