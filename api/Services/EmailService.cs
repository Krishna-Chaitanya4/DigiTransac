using System.Net;
using System.Net.Mail;

namespace DigiTransac.Api.Services;

public interface IEmailService
{
    Task SendVerificationCodeAsync(string email, string code);
    Task SendPasswordResetCodeAsync(string email, string code);
    Task SendTwoFactorBackupCodeAsync(string email, string code);
}

public class EmailSettings
{
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; }
    public string SenderEmail { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string AppPassword { get; set; } = string.Empty;
}

/// <summary>
/// Gmail SMTP email service for sending verification codes
/// </summary>
public class GmailEmailService : IEmailService
{
    private readonly EmailSettings _settings;
    private readonly ILogger<GmailEmailService> _logger;

    public GmailEmailService(EmailSettings settings, ILogger<GmailEmailService> logger)
    {
        _settings = settings;
        _logger = logger;
    }

    public async Task SendVerificationCodeAsync(string email, string code)
    {
        try
        {
            using var smtpClient = new SmtpClient(_settings.SmtpHost, _settings.SmtpPort)
            {
                Credentials = new NetworkCredential(_settings.SenderEmail, _settings.AppPassword),
                EnableSsl = true
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(_settings.SenderEmail, _settings.SenderName),
                Subject = "DigiTransac - Email Verification Code",
                IsBodyHtml = true,
                Body = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                        <h2 style='color: #4F46E5;'>Welcome to DigiTransac!</h2>
                        <p>Your verification code is:</p>
                        <div style='background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;'>
                            <span style='font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1F2937;'>{code}</span>
                        </div>
                        <p>This code will expire in <strong>10 minutes</strong>.</p>
                        <p style='color: #6B7280; font-size: 14px;'>If you didn't request this code, please ignore this email.</p>
                        <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;' />
                        <p style='color: #9CA3AF; font-size: 12px;'>DigiTransac - Your Digital Transaction Tracker</p>
                    </div>"
            };

            mailMessage.To.Add(email);

            await smtpClient.SendMailAsync(mailMessage);
            mailMessage.Dispose();

            _logger.LogInformation("Verification email sent successfully to {Email}", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send verification email to {Email}", email);
            throw new InvalidOperationException("Failed to send verification email. Please try again.", ex);
        }
    }

    public async Task SendPasswordResetCodeAsync(string email, string code)
    {
        try
        {
            using var smtpClient = new SmtpClient(_settings.SmtpHost, _settings.SmtpPort)
            {
                Credentials = new NetworkCredential(_settings.SenderEmail, _settings.AppPassword),
                EnableSsl = true
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(_settings.SenderEmail, _settings.SenderName),
                Subject = "DigiTransac - Password Reset Code",
                IsBodyHtml = true,
                Body = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                        <h2 style='color: #4F46E5;'>Password Reset Request</h2>
                        <p>You requested to reset your password. Your reset code is:</p>
                        <div style='background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;'>
                            <span style='font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1F2937;'>{code}</span>
                        </div>
                        <p>This code will expire in <strong>10 minutes</strong>.</p>
                        <p style='color: #6B7280; font-size: 14px;'>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                        <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;' />
                        <p style='color: #9CA3AF; font-size: 12px;'>DigiTransac - Your Digital Transaction Tracker</p>
                    </div>"
            };

            mailMessage.To.Add(email);

            await smtpClient.SendMailAsync(mailMessage);
            mailMessage.Dispose();

            _logger.LogInformation("Password reset email sent successfully to {Email}", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send password reset email to {Email}", email);
            throw new InvalidOperationException("Failed to send password reset email. Please try again.", ex);
        }
    }

    public async Task SendTwoFactorBackupCodeAsync(string email, string code)
    {
        try
        {
            using var smtpClient = new SmtpClient(_settings.SmtpHost, _settings.SmtpPort)
            {
                Credentials = new NetworkCredential(_settings.SenderEmail, _settings.AppPassword),
                EnableSsl = true
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(_settings.SenderEmail, _settings.SenderName),
                Subject = "DigiTransac - Two-Factor Authentication Code",
                IsBodyHtml = true,
                Body = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                        <h2 style='color: #4F46E5;'>Two-Factor Authentication</h2>
                        <p>You requested a backup code to sign in to your account. Your code is:</p>
                        <div style='background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;'>
                            <span style='font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1F2937;'>{code}</span>
                        </div>
                        <p>This code will expire in <strong>10 minutes</strong>.</p>
                        <p style='color: #6B7280; font-size: 14px;'>If you didn't request this code, someone may be trying to access your account. Please secure your password immediately.</p>
                        <hr style='border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;' />
                        <p style='color: #9CA3AF; font-size: 12px;'>DigiTransac - Your Digital Transaction Tracker</p>
                    </div>"
            };

            mailMessage.To.Add(email);

            await smtpClient.SendMailAsync(mailMessage);            mailMessage.Dispose();
            _logger.LogInformation("2FA backup code email sent successfully to {Email}", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send 2FA backup code email to {Email}", email);
            throw new InvalidOperationException("Failed to send backup code email. Please try again.", ex);
        }
    }
}
