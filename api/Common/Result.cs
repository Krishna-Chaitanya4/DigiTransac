namespace DigiTransac.Api.Common;

/// <summary>
/// Represents the result of an operation that doesn't return a value.
/// Provides a consistent way to handle success/failure across the application.
/// </summary>
public class Result
{
    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public Error Error { get; }

    protected Result(bool isSuccess, Error error)
    {
        if (isSuccess && error != Error.None)
            throw new InvalidOperationException("Success result cannot have an error.");
        if (!isSuccess && error == Error.None)
            throw new InvalidOperationException("Failure result must have an error.");

        IsSuccess = isSuccess;
        Error = error;
    }

    public static Result Success() => new(true, Error.None);
    public static Result Failure(Error error) => new(false, error);
    public static Result<T> Success<T>(T value) => new(value, true, Error.None);
    public static Result<T> Failure<T>(Error error) => new(default!, false, error);
    
    // Implicit conversion from Error to Result (for convenience)
    public static implicit operator Result(Error error) => Failure(error);
}

/// <summary>
/// Represents the result of an operation that returns a value of type T.
/// </summary>
public class Result<T> : Result
{
    private readonly T _value;

    public T Value
    {
        get
        {
            if (IsFailure)
                throw new InvalidOperationException($"Cannot access value of a failed result. Error: {Error.Code} - {Error.Message}");
            return _value;
        }
    }

    protected internal Result(T value, bool isSuccess, Error error) : base(isSuccess, error)
    {
        _value = value;
    }

    public static implicit operator Result<T>(T value) => new(value, true, Error.None);
    public static implicit operator Result<T>(Error error) => new(default!, false, error);
}

/// <summary>
/// Represents an error with a code and message.
/// Uses static factory methods for common error types.
/// </summary>
public record Error(string Code, string Message)
{
    public static readonly Error None = new(string.Empty, string.Empty);
    
    // Common error factory methods
    public static Error NotFound(string resource, string? id = null) =>
        new("NotFound", id != null ? $"{resource} with id '{id}' was not found." : $"{resource} was not found.");
    
    public static Error Validation(string message) =>
        new("Validation", message);
    
    public static Error Conflict(string message) =>
        new("Conflict", message);
    
    public static Error Unauthorized(string message = "You are not authorized to perform this action.") =>
        new("Unauthorized", message);
    
    public static Error Forbidden(string message = "Access to this resource is forbidden.") =>
        new("Forbidden", message);
    
    public static Error InternalError(string message = "An unexpected error occurred.") =>
        new("InternalError", message);
    
    public static Error ExternalService(string service, string message) =>
        new("ExternalService", $"{service}: {message}");
    
    public static Error InvalidOperation(string message) =>
        new("InvalidOperation", message);
}

/// <summary>
/// Domain-specific error types for the application
/// </summary>
public static class DomainErrors
{
    public static class Account
    {
        public static Error NotFound(string id) => Error.NotFound("Account", id);
        public static Error Archived => Error.InvalidOperation("Cannot perform operation on an archived account.");
        public static Error InvalidTransfer => Error.Validation("Cannot transfer to the same account.");
        public static Error HasTransactions(int count) => 
            Error.Conflict($"Account has {count} transactions. Delete or reassign them first.");
    }

    public static class Transaction
    {
        public static Error NotFound(string id) => Error.NotFound("Transaction", id);
        public static Error InvalidAmount => Error.Validation("Amount must be positive.");
        public static Error InvalidSplits(decimal splitSum, decimal amount) =>
            Error.Validation($"Split amounts ({splitSum}) must equal transaction amount ({amount}).");
        public static Error InvalidType(string type) =>
            Error.Validation($"Invalid transaction type '{type}'. Use Receive or Send.");
        public static Error CannotEditRecurringTemplate =>
            Error.InvalidOperation("Cannot edit recurring template. Delete and recreate instead.");
        public static Error SelfP2PNotAllowed =>
            Error.Validation("Cannot send to yourself. Use Transfer to move money between your accounts.");
        public static Error TransferP2PConflict =>
            Error.Validation("Cannot combine transfer with P2P. Use either transfer or counterparty email.");
    }

    public static class Label
    {
        public static Error NotFound(string id) => Error.NotFound("Label", id);
        public static Error HasTransactions(int count) =>
            Error.Conflict($"Label has {count} transactions. Reassign them first.");
        public static Error CannotDeleteSystemLabel(string name) =>
            Error.InvalidOperation($"Cannot delete system label '{name}'.");
    }

    public static class Tag
    {
        public static Error NotFound(string id) => Error.NotFound("Tag", id);
        public static Error HasTransactions(int count) =>
            Error.Conflict($"Tag is used in {count} transactions.");
    }

    public static class User
    {
        public static Error NotFound => Error.NotFound("User");
        public static Error EmailNotVerified =>
            Error.Unauthorized("Please verify your email address first.");
        public static Error InvalidCredentials =>
            Error.Unauthorized("Invalid email or password.");
        public static Error EmailAlreadyExists =>
            Error.Conflict("An account with this email already exists.");
    }

    public static class Auth
    {
        public static Error InvalidEmail => Error.Validation("Invalid email format");
        public static Error EmailAlreadyRegistered => Error.Conflict("Email already registered");
        public static Error InvalidOrExpiredCode => Error.Validation("Invalid or expired verification code");
        public static Error InvalidOrExpiredToken => Error.Validation("Invalid or expired verification token");
        public static Error InvalidPassword => Error.Unauthorized("Invalid password");
        public static Error WeakPassword(string reason) => Error.Validation(reason);
        public static Error NameEmpty => Error.Validation("Name cannot be empty");
        public static Error NameLength => Error.Validation("Name must be between 2 and 100 characters");
        public static Error EmailSameAsCurrent => Error.Validation("New email is the same as current email");
        public static Error EmailAlreadyInUse => Error.Conflict("Email is already in use");
        public static Error CurrentPasswordIncorrect => Error.Unauthorized("Current password is incorrect");
        public static Error NewPasswordSameAsCurrent => Error.Validation("New password must be different from current password");
        public static Error InvalidOrExpiredResetToken => Error.Validation("Invalid or expired reset token");
        public static Error InvalidOrExpiredSession => Error.Validation("Invalid or expired session. Please login again.");
        public static Error RateLimited => Error.Validation("Please wait before requesting another code");
        public static Error AccountDeletionFailed => Error.InternalError("Failed to delete account. Please try again.");
    }

    public static class Encryption
    {
        public static Error KeyNotAvailable =>
            Error.InternalError("Encryption key not available.");
    }
}