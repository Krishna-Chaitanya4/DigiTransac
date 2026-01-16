using DigiTransac.Api.Models;
using DigiTransac.Api.Settings;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IEmailVerificationRepository
{
    Task<EmailVerification?> GetByEmailAsync(string email, VerificationPurpose purpose);
    Task<EmailVerification?> GetByEmailAndCodeAsync(string email, string code, VerificationPurpose purpose);
    Task<EmailVerification?> GetByVerificationTokenAsync(string token, VerificationPurpose purpose);
    Task<EmailVerification> CreateAsync(EmailVerification verification);
    Task UpdateAsync(EmailVerification verification);
    Task DeleteByEmailAsync(string email, VerificationPurpose purpose);
}

public class EmailVerificationRepository : IEmailVerificationRepository
{
    private readonly IMongoCollection<EmailVerification> _verifications;

    public EmailVerificationRepository(IOptions<MongoDbSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        var database = client.GetDatabase(settings.Value.DatabaseName);
        _verifications = database.GetCollection<EmailVerification>("email_verifications");

        // Create index on email
        var emailIndex = Builders<EmailVerification>.IndexKeys.Ascending(v => v.Email);
        _verifications.Indexes.CreateOne(new CreateIndexModel<EmailVerification>(emailIndex));

        // Create TTL index to auto-delete expired verifications after 1 hour
        var ttlIndex = Builders<EmailVerification>.IndexKeys.Ascending(v => v.ExpiresAt);
        var ttlOptions = new CreateIndexOptions { ExpireAfter = TimeSpan.Zero };
        _verifications.Indexes.CreateOne(new CreateIndexModel<EmailVerification>(ttlIndex, ttlOptions));
    }

    public async Task<EmailVerification?> GetByEmailAsync(string email, VerificationPurpose purpose)
    {
        return await _verifications
            .Find(v => v.Email == email.ToLowerInvariant() && v.Purpose == purpose)
            .SortByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync();
    }

    public async Task<EmailVerification?> GetByEmailAndCodeAsync(string email, string code, VerificationPurpose purpose)
    {
        return await _verifications
            .Find(v => v.Email == email.ToLowerInvariant() && v.Code == code && v.Purpose == purpose && v.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync();
    }

    public async Task<EmailVerification?> GetByVerificationTokenAsync(string token, VerificationPurpose purpose)
    {
        return await _verifications
            .Find(v => v.VerificationToken == token && v.IsVerified && v.Purpose == purpose && v.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync();
    }

    public async Task<EmailVerification> CreateAsync(EmailVerification verification)
    {
        verification.Email = verification.Email.ToLowerInvariant();
        await _verifications.InsertOneAsync(verification);
        return verification;
    }

    public async Task UpdateAsync(EmailVerification verification)
    {
        await _verifications.ReplaceOneAsync(v => v.Id == verification.Id, verification);
    }

    public async Task DeleteByEmailAsync(string email, VerificationPurpose purpose)
    {
        await _verifications.DeleteManyAsync(v => v.Email == email.ToLowerInvariant() && v.Purpose == purpose);
    }
}
