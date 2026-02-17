using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IEmailVerificationRepository
{
    Task<EmailVerification?> GetByEmailAsync(string email, VerificationPurpose purpose, CancellationToken ct = default);
    Task<EmailVerification?> GetByEmailAndCodeAsync(string email, string code, VerificationPurpose purpose, CancellationToken ct = default);
    Task<EmailVerification?> GetByVerificationTokenAsync(string token, VerificationPurpose purpose, CancellationToken ct = default);
    Task<EmailVerification> CreateAsync(EmailVerification verification, CancellationToken ct = default);
    Task UpdateAsync(EmailVerification verification, CancellationToken ct = default);
    Task DeleteByEmailAsync(string email, VerificationPurpose purpose, CancellationToken ct = default);
    Task DeleteAllByEmailAsync(string email, CancellationToken ct = default);
}

public class EmailVerificationRepository : IEmailVerificationRepository
{
    private readonly IMongoCollection<EmailVerification> _verifications;

    public EmailVerificationRepository(IMongoDbService mongoDbService)
    {
        _verifications = mongoDbService.GetCollection<EmailVerification>("email_verifications");

        // Create index on email
        var emailIndex = Builders<EmailVerification>.IndexKeys.Ascending(v => v.Email);
        _verifications.Indexes.CreateOne(new CreateIndexModel<EmailVerification>(emailIndex));

        // Create TTL index to auto-delete expired verifications after 1 hour
        var ttlIndex = Builders<EmailVerification>.IndexKeys.Ascending(v => v.ExpiresAt);
        var ttlOptions = new CreateIndexOptions { ExpireAfter = TimeSpan.Zero };
        _verifications.Indexes.CreateOne(new CreateIndexModel<EmailVerification>(ttlIndex, ttlOptions));
    }

    public async Task<EmailVerification?> GetByEmailAsync(string email, VerificationPurpose purpose, CancellationToken ct = default)
    {
        return await _verifications
            .Find(v => v.Email == email.ToLowerInvariant() && v.Purpose == purpose)
            .SortByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<EmailVerification?> GetByEmailAndCodeAsync(string email, string code, VerificationPurpose purpose, CancellationToken ct = default)
    {
        return await _verifications
            .Find(v => v.Email == email.ToLowerInvariant() && v.Code == code && v.Purpose == purpose && v.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<EmailVerification?> GetByVerificationTokenAsync(string token, VerificationPurpose purpose, CancellationToken ct = default)
    {
        return await _verifications
            .Find(v => v.VerificationToken == token && v.IsVerified && v.Purpose == purpose && v.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<EmailVerification> CreateAsync(EmailVerification verification, CancellationToken ct = default)
    {
        verification.Email = verification.Email.ToLowerInvariant();
        await _verifications.InsertOneAsync(verification, options: null, ct);
        return verification;
    }

    public async Task UpdateAsync(EmailVerification verification, CancellationToken ct = default)
    {
        await _verifications.ReplaceOneAsync(v => v.Id == verification.Id, verification, options: (ReplaceOptions?)null, ct);
    }

    public async Task DeleteByEmailAsync(string email, VerificationPurpose purpose, CancellationToken ct = default)
    {
        await _verifications.DeleteManyAsync(v => v.Email == email.ToLowerInvariant() && v.Purpose == purpose, ct);
    }

    public async Task DeleteAllByEmailAsync(string email, CancellationToken ct = default)
    {
        await _verifications.DeleteManyAsync(v => v.Email == email.ToLowerInvariant(), ct);
    }
}
