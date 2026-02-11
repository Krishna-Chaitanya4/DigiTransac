namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Auth endpoint coordinator. Creates the shared route group and delegates to focused endpoint classes:
/// <see cref="AuthRegistrationEndpoints"/> — Email verification and registration flow.
/// <see cref="AuthTokenEndpoints"/> — Login, refresh, and token revocation.
/// <see cref="AuthProfileEndpoints"/> — User profile, account deletion, and email change.
/// <see cref="AuthPasswordEndpoints"/> — Forgot password flow and change password.
/// </summary>
public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapAuthRegistrationEndpoints();
        group.MapAuthTokenEndpoints();
        group.MapAuthProfileEndpoints();
        group.MapAuthPasswordEndpoints();
    }
}
