namespace DigiTransac.Api.Models.Dto;

// Request DTOs
public record CreateTagRequest(
    string Name,
    string? Color
);

public record UpdateTagRequest(
    string Name,
    string? Color
);

// Response DTOs
public record TagResponse(
    string Id,
    string Name,
    string? Color,
    DateTime CreatedAt
);
