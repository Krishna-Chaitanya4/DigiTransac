using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Extensions;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;

namespace DigiTransac.Api.Endpoints;

public static class CurrencyEndpoints
{
    public static void MapCurrencyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/currencies")
            .WithTags("Currencies");

        // Get supported currencies (public)
        group.MapGet("/", async (IExchangeRateService exchangeRateService, CancellationToken ct) =>
        {
            var currencies = await exchangeRateService.GetSupportedCurrenciesAsync(ct);
            return Results.Ok(currencies);
        })
        .WithName("GetSupportedCurrencies")
        .Produces<List<CurrencyResponse>>(200)
        .CacheOutput("ExchangeRates");

        // Get exchange rates (public)
        group.MapGet("/rates", async (IExchangeRateService exchangeRateService, CancellationToken ct) =>
        {
            var rates = await exchangeRateService.GetRatesAsync(null, ct);
            return Results.Ok(rates);
        })
        .WithName("GetExchangeRates")
        .Produces<ExchangeRateResponse>(200)
        .CacheOutput("ExchangeRates");

        // Force refresh exchange rates (authenticated)
        group.MapPost("/rates/refresh", async (ClaimsPrincipal user, IExchangeRateService exchangeRateService, CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            try
            {
                var rates = await exchangeRateService.RefreshRatesAsync(ct);
                return Results.Ok(rates);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Problem(ex.Message, statusCode: 503);  // Service Unavailable
            }
            catch (Exception)
            {
                return Results.Problem("Failed to refresh exchange rates. Please try again later.");
            }
        })
        .RequireAuthorization()
        .WithName("RefreshExchangeRates")
        .Produces<ExchangeRateResponse>(200)
        .Produces(500);

        // Get user's primary currency preference
        group.MapGet("/preference", async (ClaimsPrincipal user, IUserRepository userRepository, CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var dbUser = await userRepository.GetByIdAsync(userId, ct);
            if (dbUser == null)
            {
                return Results.NotFound(new ErrorResponse("User not found"));
            }

            return Results.Ok(new { primaryCurrency = dbUser.PrimaryCurrency });
        })
        .RequireAuthorization()
        .WithName("GetCurrencyPreference")
        .Produces<object>(200)
        .Produces<ErrorResponse>(404);

        // Update user's primary currency preference
        group.MapPut("/preference", async (
            UpdatePrimaryCurrencyRequest request,
            ClaimsPrincipal user,
            IUserRepository userRepository,
            IValidator<UpdatePrimaryCurrencyRequest> validator,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var currencyCode = request.Currency.ToUpperInvariant();

            var dbUser = await userRepository.GetByIdAsync(userId, ct);
            if (dbUser == null)
            {
                return Results.NotFound(new ErrorResponse("User not found"));
            }

            dbUser.PrimaryCurrency = currencyCode;
            await userRepository.UpdateAsync(dbUser, ct);

            return Results.Ok(new { 
                message = "Primary currency updated successfully",
                primaryCurrency = currencyCode
            });
        })
        .RequireAuthorization()
        .WithName("UpdateCurrencyPreference")
        .Produces<object>(200)
        .Produces<ErrorResponse>(400)
        .Produces<ErrorResponse>(404);
    }
}
