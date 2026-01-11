namespace DigiTransac.Core.Configuration;

/// <summary>
/// JWT configuration settings
/// </summary>
public sealed record JwtSettings(string Issuer, string Audience, string SigningKey);
