using DigiTransac.Api.Settings;
using Microsoft.Extensions.Options;

namespace DigiTransac.Api.Services;

public interface ICookieService
{
    /// <summary>
    /// Sets the refresh token as an HttpOnly secure cookie.
    /// When rememberMe is true, sets a persistent cookie with the specified expiry.
    /// When rememberMe is false, sets a session cookie (cleared when browser closes).
    /// </summary>
    void SetRefreshTokenCookie(HttpContext context, string refreshToken, int expireDays, bool rememberMe = true);
    
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

    public CookieService(IOptions<SecuritySettings> securitySettings, IHostEnvironment environment)
    {
        _securitySettings = securitySettings.Value;

        // Fail-fast: Secure cookies must be enabled in Production to prevent token theft over HTTP
        if (environment.IsProduction() && !_securitySettings.UseSecureCookies)
        {
            throw new InvalidOperationException(
                "UseSecureCookies must be true in Production. Cookies sent over HTTP can be intercepted.");
        }
    }

    public void SetRefreshTokenCookie(HttpContext context, string refreshToken, int expireDays, bool rememberMe = true)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,                          // Not accessible via JavaScript
            Secure = _securitySettings.UseSecureCookies, // Only sent over HTTPS in production
            SameSite = SameSiteMode.Lax,              // Lax for PWA standalone compatibility (Strict blocks cookies on iOS PWA cold start)
            Path = "/api/auth",                        // Only sent to auth endpoints
        };

        // Persistent cookie (Remember Me / PWA) vs session cookie (browser)
        if (rememberMe)
        {
            cookieOptions.Expires = DateTime.UtcNow.AddDays(expireDays);
        }
        // When rememberMe is false, don't set Expires — browser treats it as a session cookie
        // and deletes it when all browser windows are closed
        
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
            SameSite = SameSiteMode.Lax,
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
