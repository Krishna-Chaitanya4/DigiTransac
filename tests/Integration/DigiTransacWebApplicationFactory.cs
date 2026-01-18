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
    public Mock<IAccountRepository> AccountRepositoryMock { get; } = new();
    public Mock<IAccountService> AccountServiceMock { get; } = new();
    public Mock<IKeyManagementService> KeyManagementServiceMock { get; } = new();
    public Mock<IDekCacheService> DekCacheServiceMock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remove the real repository and service registrations
            var descriptorsToRemove = services
                .Where(d => d.ServiceType == typeof(IUserRepository) ||
                           d.ServiceType == typeof(IEmailVerificationRepository) ||
                           d.ServiceType == typeof(IEmailService) ||
                           d.ServiceType == typeof(IAccountRepository) ||
                           d.ServiceType == typeof(IAccountService) ||
                           d.ServiceType == typeof(IKeyManagementService) ||
                           d.ServiceType == typeof(IDekCacheService))
                .ToList();

            foreach (var descriptor in descriptorsToRemove)
            {
                services.Remove(descriptor);
            }

            // Setup default mock behaviors for KeyManagementService
            var testDek = new byte[32];
            KeyManagementServiceMock.Setup(x => x.GenerateDek())
                .Returns(testDek);
            KeyManagementServiceMock.Setup(x => x.WrapKeyAsync(It.IsAny<byte[]>()))
                .ReturnsAsync(new byte[64]);
            KeyManagementServiceMock.Setup(x => x.UnwrapKeyAsync(It.IsAny<byte[]>()))
                .ReturnsAsync(testDek);

            // Setup default mock behaviors for DekCacheService
            DekCacheServiceMock.Setup(x => x.GetDek(It.IsAny<string>()))
                .Returns(testDek);

            // Add mock implementations
            services.AddSingleton(UserRepositoryMock.Object);
            services.AddSingleton(EmailVerificationRepositoryMock.Object);
            services.AddSingleton(EmailServiceMock.Object);
            services.AddSingleton(AccountRepositoryMock.Object);
            services.AddSingleton(AccountServiceMock.Object);
            services.AddSingleton(KeyManagementServiceMock.Object);
            services.AddSingleton(DekCacheServiceMock.Object);
        });

        builder.UseEnvironment("Testing");
    }
}
