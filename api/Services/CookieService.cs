using DigiTransac.Api.Settings;
using Microsoft.Extensions.Options;

namespace DigiTransac.Api.Services;

public interface ICookieService
{
    /// <summary>
    /// Sets the refresh token as an HttpOnly secure cookie
    /// </summary>
    void SetRefreshTokenCookie(HttpContext context, string refreshToken, int expireDays);
    
    /// <summary>
    /// Gets the refresh token from the HttpOnly cookie
    /// </summary>
    string? GetRefreshTokenFromCookie(HttpContext context);
    
    /// <summary>
    /// Clears the refresh token cookie
    /// </summary>
    void ClearRefreshTokenCookie(HttpContext context);
}

public class CookieService : ICookieService
{
    private readonly SecuritySettings _securitySettings;
    private const string RefreshTokenCookieName = "digitransac_refresh_token";

    public CookieService(IOptions<SecuritySettings> securitySettings)
    {
        _securitySettings = securitySettings.Value;
    }

    public void SetRefreshTokenCookie(HttpContext context, string refreshToken, int expireDays)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,                          // Not accessible via JavaScript
            Secure = _securitySettings.UseSecureCookies, // Only sent over HTTPS in production
            SameSite = SameSiteMode.Strict,           // Prevent CSRF
            Expires = DateTime.UtcNow.AddDays(expireDays),
            Path = "/api/auth",                        // Only sent to auth endpoints
        };
        
        if (!string.IsNullOrEmpty(_securitySettings.CookieDomain))
        {
            cookieOptions.Domain = _securitySettings.CookieDomain;
        }
        
        context.Response.Cookies.Append(RefreshTokenCookieName, refreshToken, cookieOptions);
    }

    public string? GetRefreshTokenFromCookie(HttpContext context)
    {
        return context.Request.Cookies[RefreshTokenCookieName];
    }

    public void ClearRefreshTokenCookie(HttpContext context)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = _securitySettings.UseSecureCookies,
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddDays(-1),    // Expire immediately
            Path = "/api/auth",
        };
        
        if (!string.IsNullOrEmpty(_securitySettings.CookieDomain))
        {
            cookieOptions.Domain = _securitySettings.CookieDomain;
        }
        
        context.Response.Cookies.Delete(RefreshTokenCookieName, cookieOptions);
    }
}
