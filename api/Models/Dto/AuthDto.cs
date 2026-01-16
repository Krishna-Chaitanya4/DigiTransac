namespace DigiTransac.Api.Models.Dto;

// Step 1: Send verification code to email
public record SendVerificationRequest(string Email);

// Step 2: Verify the code
public record VerifyCodeRequest(string Email, string Code);

// Step 3: Complete registration (after email verified)
public record CompleteRegistrationRequest(string Email, string VerificationToken, string Password, string FullName);

// Legacy - keeping for now
public record RegisterRequest(string Email, string Password, string FullName);

public record LoginRequest(string Email, string Password);

public record AuthResponse(string Token, string Email, string FullName, bool IsEmailVerified);

public record VerificationResponse(string Message, string? VerificationToken = null);

public record DeleteAccountRequest(string Password);

// Forgot Password flow
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string VerificationToken, string NewPassword);

public record ErrorResponse(string Message);
