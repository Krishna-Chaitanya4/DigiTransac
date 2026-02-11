using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using System.Net;
using System.Text.Json;

namespace DigiTransac.Tests.Services;

public class ExchangeRateServiceTests
{
    private readonly Mock<IExchangeRateRepository> _repositoryMock;
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
    private readonly Mock<HttpMessageHandler> _httpHandlerMock;
    private readonly IMemoryCache _memoryCache;
    private readonly Mock<ILogger<ExchangeRateService>> _loggerMock;
    private readonly Mock<IHostEnvironment> _environmentMock;
    private readonly ExchangeRateService _service;

    public ExchangeRateServiceTests()
    {
        _repositoryMock = new Mock<IExchangeRateRepository>();
        _httpClientFactoryMock = new Mock<IHttpClientFactory>();
        _httpHandlerMock = new Mock<HttpMessageHandler>();
        _memoryCache = new MemoryCache(new MemoryCacheOptions());
        _loggerMock = new Mock<ILogger<ExchangeRateService>>();
        _environmentMock = new Mock<IHostEnvironment>();
        _environmentMock.Setup(e => e.EnvironmentName).Returns("Development");

        var httpClient = new HttpClient(_httpHandlerMock.Object);
        _httpClientFactoryMock.Setup(x => x.CreateClient(It.IsAny<string>()))
            .Returns(httpClient);

        _service = new ExchangeRateService(_repositoryMock.Object, _httpClientFactoryMock.Object, _memoryCache, _loggerMock.Object, _environmentMock.Object);
    }

    #region GetRatesAsync Tests

    [Fact]
    public async Task GetRatesAsync_WithRecentCachedRates_ShouldReturnCachedRates()
    {
        // Arrange
        var cachedRates = new ExchangeRate
        {
            Id = "1",
            BaseCurrency = "USD",
            Rates = new Dictionary<string, decimal> { { "INR", 83.0m }, { "EUR", 0.92m } },
            LastUpdated = DateTime.UtcNow.AddHours(-12), // Within 24 hours
            Source = "api"
        };
        _repositoryMock.Setup(x => x.GetLatestAsync()).ReturnsAsync(cachedRates);

        // Act
        var result = await _service.GetRatesAsync();

        // Assert
        result.Should().NotBeNull();
        result.BaseCurrency.Should().Be("USD");
        result.Rates.Should().ContainKey("INR");
        result.Rates["INR"].Should().Be(83.0m);
    }

    [Fact]
    public async Task GetRatesAsync_WithNoRates_ShouldReturnDefaultRates()
    {
        // Arrange
        _repositoryMock.Setup(x => x.GetLatestAsync()).ReturnsAsync((ExchangeRate?)null);
        SetupHttpError(); // Simulate API failure

        // Act
        var result = await _service.GetRatesAsync();

        // Assert
        result.Should().NotBeNull();
        result.BaseCurrency.Should().Be("USD");
        result.Rates.Should().ContainKey("INR");
        // Source can be "default" or from API depending on implementation
        result.Source.Should().NotBeNullOrEmpty();
    }

    #endregion

    #region Convert Tests

    [Fact]
    public void Convert_SameFromAndToCurrency_ShouldReturnSameAmount()
    {
        // Arrange
        var rates = new Dictionary<string, decimal> { { "INR", 83.0m }, { "USD", 1.0m } };

        // Act
        var result = _service.Convert(1000m, "INR", "INR", rates);

        // Assert
        result.Should().Be(1000m);
    }

    [Fact]
    public void Convert_FromUsdToInr_ShouldConvertCorrectly()
    {
        // Arrange
        var rates = new Dictionary<string, decimal> { { "INR", 83.0m }, { "USD", 1.0m } };

        // Act
        var result = _service.Convert(100m, "USD", "INR", rates);

        // Assert
        result.Should().Be(8300m); // 100 USD * 83 = 8300 INR
    }

    [Fact]
    public void Convert_FromInrToUsd_ShouldConvertCorrectly()
    {
        // Arrange
        var rates = new Dictionary<string, decimal> { { "INR", 83.0m }, { "USD", 1.0m } };

        // Act
        var result = _service.Convert(8300m, "INR", "USD", rates);

        // Assert
        result.Should().BeApproximately(100m, 0.01m); // 8300 INR / 83 = 100 USD
    }

    [Fact]
    public void Convert_FromInrToEur_ShouldConvertViaUsd()
    {
        // Arrange
        var rates = new Dictionary<string, decimal> { { "INR", 83.0m }, { "USD", 1.0m }, { "EUR", 0.92m } };

        // Act
        var result = _service.Convert(8300m, "INR", "EUR", rates);

        // Assert
        // 8300 INR / 83 = 100 USD, 100 USD * 0.92 = 92 EUR
        result.Should().BeApproximately(92m, 0.01m);
    }

    #endregion

    #region GetSupportedCurrenciesAsync Tests

    [Fact]
    public async Task GetSupportedCurrenciesAsync_ShouldReturnAllConfiguredCurrencies()
    {
        // Act
        var result = await _service.GetSupportedCurrenciesAsync();

        // Assert
        result.Should().NotBeEmpty();
        result.Should().Contain(c => c.Code == "INR");
        result.Should().Contain(c => c.Code == "USD");
        result.Should().Contain(c => c.Code == "EUR");
        result.Should().Contain(c => c.Code == "GBP");
    }

    [Fact]
    public async Task GetSupportedCurrenciesAsync_EachCurrencyShouldHaveCodeNameAndSymbol()
    {
        // Act
        var result = await _service.GetSupportedCurrenciesAsync();

        // Assert
        foreach (var currency in result)
        {
            currency.Code.Should().NotBeNullOrEmpty();
            currency.Name.Should().NotBeNullOrEmpty();
            currency.Symbol.Should().NotBeNullOrEmpty();
        }
    }

    #endregion

    private void SetupHttpError()
    {
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
    }
}
