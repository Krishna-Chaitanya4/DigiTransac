namespace DigiTransac.Api.Models.Dto;

// Step 1: Send verification code to email
public record SendVerificationRequest(string Email);

// Step 2: Verify the code
public record VerifyCodeRequest(string Email, string Code);

// Step 3: Complete registration (after email verified)
public record CompleteRegistrationRequest(string Email, string VerificationToken, string Password, string FullName, string? PrimaryCurrency = null);

// Legacy - keeping for now
public record RegisterRequest(string Email, string Password, string FullName);

public record LoginRequest(string Email, string Password);

// Full auth response with refresh token (used internally)
public record AuthResponse(string AccessToken, string RefreshToken, string Email, string FullName, bool IsEmailVerified);

// Auth response without refresh token (refresh token goes in HttpOnly cookie)
public record AuthResponseWithoutRefresh(string AccessToken, string Email, string FullName, bool IsEmailVerified);

public record RefreshTokenRequest(string? RefreshToken);

public record VerificationResponse(string Message, string? VerificationToken = null);

public record DeleteAccountRequest(string Password);

// Profile update
public record UpdateNameRequest(string FullName);
public record UpdateEmailRequest(string NewEmail);
public record VerifyEmailChangeRequest(string NewEmail, string Code);

// Password change (while logged in - preserves encrypted data)
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

// Forgot Password flow
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string VerificationToken, string NewPassword);

public record ErrorResponse(string Message);

// Two-Factor Authentication
public record TwoFactorSetupResponse(string Secret, string QrCodeUri, string ManualEntryKey);
public record EnableTwoFactorRequest(string Code);
public record DisableTwoFactorRequest(string Password);
public record VerifyTwoFactorRequest(string UserId, string Code);
public record TwoFactorStatusResponse(bool Enabled);

// Login response that may require 2FA (refresh token in HttpOnly cookie)
public record LoginResponse(
    string? AccessToken, 
    string? RefreshToken, 
    string? Email, 
    string? FullName, 
    bool? IsEmailVerified,
    bool RequiresTwoFactor = false,
    string? TwoFactorToken = null
);

// Login response without refresh token (sent in HttpOnly cookie)
public record LoginResponseWithoutRefresh(
    string? AccessToken, 
    string? Email, 
    string? FullName, 
    bool? IsEmailVerified,
    bool RequiresTwoFactor = false,
    string? TwoFactorToken = null
);

public record TwoFactorLoginRequest(string TwoFactorToken, string Code);

// Email OTP backup for 2FA
public record SendTwoFactorEmailOtpRequest(string TwoFactorToken);
public record TwoFactorEmailOtpLoginRequest(string TwoFactorToken, string EmailCode);
