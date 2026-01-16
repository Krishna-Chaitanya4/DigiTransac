using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using Moq;

namespace DigiTransac.Tests.Integration;

/// <summary>
/// Custom WebApplicationFactory for integration testing
/// Replaces real services with mocks for isolated testing
/// </summary>
public class DigiTransacWebApplicationFactory : WebApplicationFactory<Program>
{
    public Mock<IUserRepository> UserRepositoryMock { get; } = new();
    public Mock<IEmailVerificationRepository> EmailVerificationRepositoryMock { get; } = new();
    public Mock<IEmailService> EmailServiceMock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remove the real repository and service registrations
            var descriptorsToRemove = services
                .Where(d => d.ServiceType == typeof(IUserRepository) ||
                           d.ServiceType == typeof(IEmailVerificationRepository) ||
                           d.ServiceType == typeof(IEmailService))
                .ToList();

            foreach (var descriptor in descriptorsToRemove)
            {
                services.Remove(descriptor);
            }

            // Add mock implementations
            services.AddSingleton(UserRepositoryMock.Object);
            services.AddSingleton(EmailVerificationRepositoryMock.Object);
            services.AddSingleton(EmailServiceMock.Object);
        });

        builder.UseEnvironment("Testing");
    }
}
