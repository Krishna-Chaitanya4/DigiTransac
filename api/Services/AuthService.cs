using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services.UnitOfWork;
using DigiTransac.Api.Settings;
using Microsoft.Extensions.Options;

namespace DigiTransac.Api.Services;

public interface IAuthService
{
    // Registration verification flow
    Task<Result> SendVerificationCodeAsync(string email);
    Task<Result<string>> VerifyCodeAsync(string email, string code);
    Task<AuthResponse?> CompleteRegistrationAsync(CompleteRegistrationRequest request);
    
    // Login
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse?> VerifyTwoFactorLoginAsync(string twoFactorToken, string code);
    Task<Result> SendTwoFactorEmailOtpAsync(string twoFactorToken);
    Task<AuthResponse?> VerifyTwoFactorEmailOtpAsync(string twoFactorToken, string emailCode);
    Task<User?> GetCurrentUserAsync(string userId);
    
    // Token refresh
    Task<AuthResponse?> RefreshTokenAsync(string refreshToken);
    Task<bool> RevokeTokenAsync(string refreshToken);
    Task RevokeAllUserTokensAsync(string userId);
    
    // Account management
    Task<Result> DeleteAccountAsync(string userId, string password);
    Task<Result> UpdateNameAsync(string userId, string newName);
    Task<Result> SendEmailChangeCodeAsync(string userId, string newEmail);
    Task<Result> VerifyAndUpdateEmailAsync(string userId, string newEmail, string code);
    
    // Password management
    Task<Result> ChangePasswordAsync(string userId, string currentPassword, string newPassword);
    
    // Forgot password flow
    Task<Result> SendPasswordResetCodeAsync(string email);
    Task<Result<string>> VerifyPasswordResetCodeAsync(string email, string code);
    Task<Result> ResetPasswordAsync(ResetPasswordRequest request);
}

/// <summary>
/// Authentication service split into focused partial class files:
/// <see cref="AuthService"/> (this file) — Interface, constructor, and dependency fields.
/// AuthService.Registration.cs — Email verification and user registration.
/// AuthService.Login.cs — Login, 2FA verification, and email OTP.
/// AuthService.Account.cs — Account deletion, name update, and email change.
/// AuthService.Password.cs — Password change, forgot password, and reset flow.
/// AuthService.Token.cs — Refresh token management and revocation.
/// AuthService.Helpers.cs — JWT generation, verification codes, validation helpers.
/// </summary>
public partial class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IEmailVerificationRepository _emailVerificationRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly ITwoFactorTokenRepository _twoFactorTokenRepository;
    private readonly IEmailService _emailService;
    private readonly ILabelService _labelService;
    private readonly ITwoFactorService _twoFactorService;
    private readonly IKeyManagementService _keyManagementService;
    private readonly IAuditService _auditService;
    private readonly IChatMessageRepository _chatMessageRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly ITagRepository _tagRepository;
    private readonly IBudgetRepository _budgetRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly JwtSettings _jwtSettings;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository userRepository,
        IEmailVerificationRepository emailVerificationRepository,
        IRefreshTokenRepository refreshTokenRepository,
        ITwoFactorTokenRepository twoFactorTokenRepository,
        IEmailService emailService,
        ILabelService labelService,
        ITwoFactorService twoFactorService,
        IKeyManagementService keyManagementService,
        IAuditService auditService,
        IChatMessageRepository chatMessageRepository,
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        ITagRepository tagRepository,
        IBudgetRepository budgetRepository,
        IUnitOfWork unitOfWork,
        IOptions<JwtSettings> jwtSettings,
        ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _emailVerificationRepository = emailVerificationRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _twoFactorTokenRepository = twoFactorTokenRepository;
        _emailService = emailService;
        _labelService = labelService;
        _twoFactorService = twoFactorService;
        _keyManagementService = keyManagementService;
        _auditService = auditService;
        _chatMessageRepository = chatMessageRepository;
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _tagRepository = tagRepository;
        _budgetRepository = budgetRepository;
        _unitOfWork = unitOfWork;
        _jwtSettings = jwtSettings.Value;
        _logger = logger;
    }
}
