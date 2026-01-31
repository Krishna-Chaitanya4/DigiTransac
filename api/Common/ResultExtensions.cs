using Microsoft.AspNetCore.Http;

namespace DigiTransac.Api.Common;

/// <summary>
/// Extension methods for Result types to simplify common operations
/// </summary>
public static class ResultExtensions
{
    /// <summary>
    /// Maps a successful result to a new value using the provided function.
    /// If the result is a failure, returns the failure unchanged.
    /// </summary>
    public static Result<TOut> Map<TIn, TOut>(this Result<TIn> result, Func<TIn, TOut> mapper)
    {
        return result.IsSuccess
            ? Result.Success(mapper(result.Value))
            : Result.Failure<TOut>(result.Error);
    }

    /// <summary>
    /// Chains result operations. If the current result is successful,
    /// executes the next operation. Otherwise, returns the failure.
    /// </summary>
    public static async Task<Result<TOut>> Bind<TIn, TOut>(
        this Result<TIn> result,
        Func<TIn, Task<Result<TOut>>> next)
    {
        return result.IsSuccess
            ? await next(result.Value)
            : Result.Failure<TOut>(result.Error);
    }

    /// <summary>
    /// Synchronous bind for chaining result operations.
    /// </summary>
    public static Result<TOut> Bind<TIn, TOut>(
        this Result<TIn> result,
        Func<TIn, Result<TOut>> next)
    {
        return result.IsSuccess
            ? next(result.Value)
            : Result.Failure<TOut>(result.Error);
    }

    /// <summary>
    /// Executes an action if the result is successful.
    /// </summary>
    public static Result<T> Tap<T>(this Result<T> result, Action<T> action)
    {
        if (result.IsSuccess)
            action(result.Value);
        return result;
    }

    /// <summary>
    /// Executes an async action if the result is successful.
    /// </summary>
    public static async Task<Result<T>> TapAsync<T>(
        this Result<T> result,
        Func<T, Task> action)
    {
        if (result.IsSuccess)
            await action(result.Value);
        return result;
    }

    /// <summary>
    /// Converts a Result to an IResult for Minimal API responses.
    /// Maps error codes to appropriate HTTP status codes.
    /// </summary>
    public static IResult ToApiResult(this Result result)
    {
        if (result.IsSuccess)
            return Results.Ok();

        return MapErrorToApiResult(result.Error);
    }

    /// <summary>
    /// Converts a Result<T> to an IResult for Minimal API responses.
    /// </summary>
    public static IResult ToApiResult<T>(this Result<T> result)
    {
        if (result.IsSuccess)
            return Results.Ok(result.Value);

        return MapErrorToApiResult(result.Error);
    }

    /// <summary>
    /// Converts a Result<T> to an IResult with a custom success mapper.
    /// </summary>
    public static IResult ToApiResult<T>(this Result<T> result, Func<T, IResult> successMapper)
    {
        if (result.IsSuccess)
            return successMapper(result.Value);

        return MapErrorToApiResult(result.Error);
    }

    /// <summary>
    /// Maps an Error to the appropriate HTTP response.
    /// </summary>
    private static IResult MapErrorToApiResult(Error error)
    {
        return error.Code switch
        {
            "NotFound" => Results.NotFound(new { message = error.Message }),
            "Validation" => Results.BadRequest(new { message = error.Message }),
            "Conflict" => Results.Conflict(new { message = error.Message }),
            "Unauthorized" => Results.Unauthorized(),
            "Forbidden" => Results.Forbid(),
            "InvalidOperation" => Results.BadRequest(new { message = error.Message }),
            "ExternalService" => Results.Json(new { message = error.Message }, statusCode: 502),
            _ => Results.Problem(error.Message)
        };
    }

    /// <summary>
    /// Combines multiple results into a single result.
    /// Returns failure if any result fails, otherwise returns success.
    /// </summary>
    public static Result Combine(params Result[] results)
    {
        foreach (var result in results)
        {
            if (result.IsFailure)
                return result;
        }
        return Result.Success();
    }

    /// <summary>
    /// Ensures a condition is met, returning failure if not.
    /// </summary>
    public static Result<T> Ensure<T>(
        this Result<T> result,
        Func<T, bool> predicate,
        Error error)
    {
        if (result.IsFailure)
            return result;

        return predicate(result.Value)
            ? result
            : Result.Failure<T>(error);
    }

    /// <summary>
    /// Matches on success or failure and returns a value.
    /// </summary>
    public static TResult Match<T, TResult>(
        this Result<T> result,
        Func<T, TResult> onSuccess,
        Func<Error, TResult> onFailure)
    {
        return result.IsSuccess
            ? onSuccess(result.Value)
            : onFailure(result.Error);
    }

    /// <summary>
    /// Matches on success or failure for Result without value.
    /// </summary>
    public static TResult Match<TResult>(
        this Result result,
        Func<TResult> onSuccess,
        Func<Error, TResult> onFailure)
    {
        return result.IsSuccess
            ? onSuccess()
            : onFailure(result.Error);
    }
}

/// <summary>
/// Extension methods for converting between legacy tuple returns and Result types
/// </summary>
public static class LegacyResultAdapter
{
    /// <summary>
    /// Converts a legacy (bool, string) tuple to a Result
    /// </summary>
    public static Result ToResult(this (bool Success, string Message) legacy)
    {
        return legacy.Success
            ? Result.Success()
            : Result.Failure(Error.Validation(legacy.Message));
    }

    /// <summary>
    /// Converts a legacy (bool, string, T?) tuple to a Result<T>
    /// </summary>
    public static Result<T> ToResult<T>(this (bool Success, string Message, T? Value) legacy)
        where T : class
    {
        return legacy.Success && legacy.Value != null
            ? Result.Success(legacy.Value)
            : Result.Failure<T>(Error.Validation(legacy.Message));
    }
}