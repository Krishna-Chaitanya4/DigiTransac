using FluentValidation;

namespace DigiTransac.Api.Validators;

/// <summary>
/// Extension method to validate a request using FluentValidation
/// </summary>
public static class ValidationExtensions
{
    /// <summary>
    /// Validates the request and returns a BadRequest result if validation fails
    /// </summary>
    public static async Task<IResult?> ValidateAndReturnErrorAsync<T>(this IValidator<T> validator, T request)
    {
        var result = await validator.ValidateAsync(request);
        
        if (!result.IsValid)
        {
            var errors = result.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(e => e.ErrorMessage).ToArray()
                );
            
            return Results.ValidationProblem(errors);
        }
        
        return null;
    }
    
    /// <summary>
    /// Validates the request and returns the first error message if validation fails
    /// </summary>
    public static async Task<(bool IsValid, string? ErrorMessage)> ValidateWithFirstErrorAsync<T>(this IValidator<T> validator, T request)
    {
        var result = await validator.ValidateAsync(request);
        
        if (!result.IsValid)
        {
            return (false, result.Errors.First().ErrorMessage);
        }
        
        return (true, null);
    }
}
