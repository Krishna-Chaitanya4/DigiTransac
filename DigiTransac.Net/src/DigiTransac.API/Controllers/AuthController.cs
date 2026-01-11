using DigiTransac.API.DTOs;
using DigiTransac.Core.Models;
using DigiTransac.Infrastructure.Interfaces;
using DigiTransac.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DigiTransac.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly ITokenService _tokenService;

    public AuthController(
        IUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        ITokenService tokenService)
    {
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _tokenService = tokenService;
    }

    /// <summary>
    /// Register a new user with email, username, and password
    /// </summary>
    /// <param name="request">User registration data</param>
    /// <returns>Authentication response with access token and refresh token</returns>
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        try
        {
            // Validate input
            if (string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Username) ||
                string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new AuthResponse
                {
                    Success = false,
                    Message = "Email, username, and password are required"
                });
            }

            // Validate password strength (minimum 8 characters)
            if (request.Password.Length < 8)
            {
                return BadRequest(new AuthResponse
                {
                    Success = false,
                    Message = "Password must be at least 8 characters long"
                });
            }

            // Check if email already exists
            var existingEmail = await _userRepository.GetByEmailAsync(request.Email);
            if (existingEmail != null)
            {
                return BadRequest(new AuthResponse
                {
                    Success = false,
                    Message = "Email already registered"
                });
            }

            // Check if username already exists
            var existingUsername = await _userRepository.GetByUsernameAsync(request.Username);
            if (existingUsername != null)
            {
                return BadRequest(new AuthResponse
                {
                    Success = false,
                    Message = "Username already taken"
                });
            }

            // Hash password with BCrypt (work factor 12)
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12);

            // Create user
            var user = new User
            {
                Email = request.Email,
                Username = request.Username,
                PasswordHash = passwordHash,
                FullName = request.FullName,
                Phone = request.Phone
            };

            var createdUser = await _userRepository.CreateAsync(user);

            // Generate tokens
            var accessToken = _tokenService.GenerateAccessToken(createdUser);
            var refreshToken = _tokenService.GenerateRefreshToken();
            var refreshTokenHash = _tokenService.HashRefreshToken(refreshToken);

            // Save refresh token to database
            var refreshTokenEntity = _tokenService.CreateRefreshTokenEntity(createdUser.Id, refreshTokenHash);
            await _refreshTokenRepository.CreateAsync(refreshTokenEntity);

            return Ok(new AuthResponse
            {
                Success = true,
                Message = "Registration successful",
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = 900, // 15 minutes
                User = new AuthUserDto
                {
                    Id = createdUser.Id,
                    Email = createdUser.Email,
                    Phone = createdUser.Phone,
                    Username = createdUser.Username,
                    FullName = createdUser.FullName ?? "",
                    Currency = "USD"
                }
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error in Register: {ex.Message}");
            Console.WriteLine($"❌ Stack trace: {ex.StackTrace}");
            return StatusCode(500, new AuthResponse
            {
                Success = false,
                Message = "Registration failed"
            });
        }
    }

    /// <summary>
    /// Login user with email/username and password
    /// </summary>
    /// <param name="request">Login credentials</param>
    /// <returns>Authentication response with access token and refresh token</returns>
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        try
        {
            // Validate input
            if (string.IsNullOrWhiteSpace(request.EmailOrUsername) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new AuthResponse
                {
                    Success = false,
                    Message = "Email/username and password are required"
                });
            }

            // Find user by email or username
            var user = await _userRepository.GetByEmailAsync(request.EmailOrUsername)
                ?? await _userRepository.GetByUsernameAsync(request.EmailOrUsername);

            if (user == null)
            {
                return Unauthorized(new AuthResponse
                {
                    Success = false,
                    Message = "Invalid email/username or password"
                });
            }

            // Verify password
            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Unauthorized(new AuthResponse
                {
                    Success = false,
                    Message = "Invalid email/username or password"
                });
            }

            // Generate tokens
            var accessToken = _tokenService.GenerateAccessToken(user);
            var refreshToken = _tokenService.GenerateRefreshToken();
            var refreshTokenHash = _tokenService.HashRefreshToken(refreshToken);

            // Save refresh token to database
            var refreshTokenEntity = _tokenService.CreateRefreshTokenEntity(user.Id, refreshTokenHash);
            await _refreshTokenRepository.CreateAsync(refreshTokenEntity);

            return Ok(new AuthResponse
            {
                Success = true,
                Message = "Login successful",
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresIn = 900, // 15 minutes
                User = new AuthUserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    Phone = user.Phone,
                    Username = user.Username,
                    FullName = user.FullName ?? "",
                    Currency = "USD"
                }
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error in Login: {ex.Message}");
            Console.WriteLine($"❌ Stack trace: {ex.StackTrace}");
            return StatusCode(500, new AuthResponse
            {
                Success = false,
                Message = "Login failed"
            });
        }
    }

    /// <summary>
    /// Refresh access token using a valid refresh token
    /// </summary>
    /// <param name="request">Refresh token request</param>
    /// <returns>New access token and optionally a new refresh token</returns>
    [HttpPost("refresh")]
    public async Task<ActionResult<TokenResponse>> Refresh([FromBody] RefreshTokenRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                return BadRequest(new TokenResponse());
            }

            // Hash the provided refresh token
            var refreshTokenHash = _tokenService.HashRefreshToken(request.RefreshToken);

            // Validate refresh token in database
            var storedRefreshToken = await _refreshTokenRepository.GetByTokenHashAsync(refreshTokenHash);
            if (storedRefreshToken == null)
            {
                return Unauthorized();
            }

            // Get user
            var user = await _userRepository.GetByIdAsync(storedRefreshToken.UserId);
            if (user == null)
            {
                return Unauthorized();
            }

            // Generate new access token
            var newAccessToken = _tokenService.GenerateAccessToken(user);

            // Optionally: Create new refresh token and revoke old one
            // This is token rotation pattern - improves security
            var newRefreshToken = _tokenService.GenerateRefreshToken();
            var newRefreshTokenHash = _tokenService.HashRefreshToken(newRefreshToken);

            // Revoke old refresh token
            await _refreshTokenRepository.RevokeAsync(refreshTokenHash);

            // Create new refresh token
            var newRefreshTokenEntity = _tokenService.CreateRefreshTokenEntity(user.Id, newRefreshTokenHash);
            await _refreshTokenRepository.CreateAsync(newRefreshTokenEntity);

            return Ok(new TokenResponse
            {
                AccessToken = newAccessToken,
                RefreshToken = newRefreshToken,
                ExpiresIn = 900 // 15 minutes
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error in Refresh: {ex.Message}");
            Console.WriteLine($"❌ Stack trace: {ex.StackTrace}");
            return StatusCode(500, new TokenResponse());
        }
    }

    /// <summary>
    /// Logout user and revoke all refresh tokens
    /// </summary>
    /// <returns>Success response</returns>
    [HttpPost("logout")]
    [Authorize]
    public async Task<ActionResult<AuthResponse>> Logout()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            // Revoke all refresh tokens for this user
            await _refreshTokenRepository.RevokeAllUserTokensAsync(userId);

            return Ok(new AuthResponse
            {
                Success = true,
                Message = "Logout successful"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error in Logout: {ex.Message}");
            return StatusCode(500, new AuthResponse
            {
                Success = false,
                Message = "Logout failed"
            });
        }
    }

    /// <summary>
    /// Get current user profile (requires authentication)
    /// </summary>
    /// <returns>User profile information</returns>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthUserDto>> GetCurrentUser()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null)
            {
                return Unauthorized();
            }

            return Ok(new AuthUserDto
            {
                Id = user.Id,
                Email = user.Email,
                Phone = user.Phone,
                Username = user.Username,
                FullName = user.FullName ?? "",
                Currency = "USD"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error in GetCurrentUser: {ex.Message}");
            return StatusCode(500);
        }
    }
}

