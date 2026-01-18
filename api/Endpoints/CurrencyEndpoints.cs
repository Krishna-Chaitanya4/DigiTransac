using System.Security.Claims;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;

namespace DigiTransac.Api.Endpoints;

public static class CurrencyEndpoints
{
    public static void MapCurrencyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/currencies")
            .WithTags("Currencies");

        // Get supported currencies (public)
        group.MapGet("/", async (IExchangeRateService exchangeRateService) =>
        {
            var currencies = await exchangeRateService.GetSupportedCurrenciesAsync();
            return Results.Ok(currencies);
        })
        .WithName("GetSupportedCurrencies")
        .Produces<List<CurrencyResponse>>(200);

        // Get exchange rates (public)
        group.MapGet("/rates", async (IExchangeRateService exchangeRateService) =>
        {
            var rates = await exchangeRateService.GetRatesAsync();
            return Results.Ok(rates);
        })
        .WithName("GetExchangeRates")
        .Produces<ExchangeRateResponse>(200);

        // Force refresh exchange rates (authenticated)
        group.MapPost("/rates/refresh", async (ClaimsPrincipal user, IExchangeRateService exchangeRateService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            try
            {
                var rates = await exchangeRateService.RefreshRatesAsync();
                return Results.Ok(rates);
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
        group.MapGet("/preference", async (ClaimsPrincipal user, IUserRepository userRepository) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var dbUser = await userRepository.GetByIdAsync(userId);
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
            IUserRepository userRepository) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(request.Currency))
            {
                return Results.BadRequest(new ErrorResponse("Currency code is required"));
            }

            var currencyCode = request.Currency.ToUpperInvariant();
            if (!CurrencyConfig.IsValidCurrency(currencyCode))
            {
                return Results.BadRequest(new ErrorResponse($"Unsupported currency: {currencyCode}"));
            }

            var dbUser = await userRepository.GetByIdAsync(userId);
            if (dbUser == null)
            {
                return Results.NotFound(new ErrorResponse("User not found"));
            }

            dbUser.PrimaryCurrency = currencyCode;
            await userRepository.UpdateAsync(dbUser);

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
