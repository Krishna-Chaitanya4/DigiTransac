using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Validators;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace DigiTransac.Tests.Validators;

public class SendVerificationRequestValidatorTests
{
    private readonly SendVerificationRequestValidator _validator = new();

    [Fact]
    public void Valid_Email_Should_Pass()
    {
        var result = _validator.TestValidate(new SendVerificationRequest("user@example.com"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Empty_Email_Should_Fail(string? email)
    {
        var result = _validator.TestValidate(new SendVerificationRequest(email!));
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Invalid_Email_Format_Should_Fail()
    {
        var result = _validator.TestValidate(new SendVerificationRequest("not-an-email"));
        result.ShouldHaveValidationErrorFor(x => x.Email).WithErrorMessage("Invalid email format");
    }
}

public class VerifyCodeRequestValidatorTests
{
    private readonly VerifyCodeRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var result = _validator.TestValidate(new VerifyCodeRequest("user@example.com", "123456"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Code_Wrong_Length_Should_Fail()
    {
        var result = _validator.TestValidate(new VerifyCodeRequest("user@example.com", "123"));
        result.ShouldHaveValidationErrorFor(x => x.Code).WithErrorMessage("Code must be 6 digits");
    }

    [Fact]
    public void Empty_Code_Should_Fail()
    {
        var result = _validator.TestValidate(new VerifyCodeRequest("user@example.com", ""));
        result.ShouldHaveValidationErrorFor(x => x.Code);
    }
}

public class CompleteRegistrationRequestValidatorTests
{
    private readonly CompleteRegistrationRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var request = new CompleteRegistrationRequest("user@example.com", "token123", "Password1", "John Doe");
        var result = _validator.TestValidate(request);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Password_Too_Short_Should_Fail()
    {
        var request = new CompleteRegistrationRequest("user@example.com", "token", "12345", "John Doe");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.Password).WithErrorMessage("Password must be at least 6 characters");
    }

    [Fact]
    public void FullName_Too_Short_Should_Fail()
    {
        var request = new CompleteRegistrationRequest("user@example.com", "token", "Password1", "J");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.FullName).WithErrorMessage("Full name must be at least 2 characters");
    }

    [Fact]
    public void FullName_Exceeds_100_Should_Fail()
    {
        var request = new CompleteRegistrationRequest("user@example.com", "token", "Password1", new string('A', 101));
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.FullName);
    }

    [Fact]
    public void Empty_Token_Should_Fail()
    {
        var request = new CompleteRegistrationRequest("user@example.com", "", "Password1", "John Doe");
        var result = _validator.TestValidate(request);
        result.ShouldHaveValidationErrorFor(x => x.VerificationToken);
    }
}

public class LoginRequestValidatorTests
{
    private readonly LoginRequestValidator _validator = new();

    [Fact]
    public void Valid_Login_Should_Pass()
    {
        var result = _validator.TestValidate(new LoginRequest("user@example.com", "password"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_Password_Should_Fail()
    {
        var result = _validator.TestValidate(new LoginRequest("user@example.com", ""));
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Invalid_Email_Should_Fail()
    {
        var result = _validator.TestValidate(new LoginRequest("bad", "password"));
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }
}

public class ChangePasswordRequestValidatorTests
{
    private readonly ChangePasswordRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var result = _validator.TestValidate(new ChangePasswordRequest("oldpass", "newpass123"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_CurrentPassword_Should_Fail()
    {
        var result = _validator.TestValidate(new ChangePasswordRequest("", "newpass123"));
        result.ShouldHaveValidationErrorFor(x => x.CurrentPassword);
    }

    [Fact]
    public void NewPassword_Too_Short_Should_Fail()
    {
        var result = _validator.TestValidate(new ChangePasswordRequest("oldpass", "12345"));
        result.ShouldHaveValidationErrorFor(x => x.NewPassword);
    }
}

public class ResetPasswordRequestValidatorTests
{
    private readonly ResetPasswordRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var result = _validator.TestValidate(new ResetPasswordRequest("user@example.com", "token", "newpass1"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_Token_Should_Fail()
    {
        var result = _validator.TestValidate(new ResetPasswordRequest("user@example.com", "", "newpass1"));
        result.ShouldHaveValidationErrorFor(x => x.VerificationToken);
    }

    [Fact]
    public void Password_Too_Short_Should_Fail()
    {
        var result = _validator.TestValidate(new ResetPasswordRequest("user@example.com", "token", "abc"));
        result.ShouldHaveValidationErrorFor(x => x.NewPassword);
    }
}

public class UpdateNameRequestValidatorTests
{
    private readonly UpdateNameRequestValidator _validator = new();

    [Fact]
    public void Valid_Name_Should_Pass()
    {
        var result = _validator.TestValidate(new UpdateNameRequest("Jane Doe"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("A")]
    public void Name_Too_Short_Should_Fail(string name)
    {
        var result = _validator.TestValidate(new UpdateNameRequest(name));
        result.ShouldHaveValidationErrorFor(x => x.FullName);
    }
}

public class TwoFactorLoginRequestValidatorTests
{
    private readonly TwoFactorLoginRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var result = _validator.TestValidate(new TwoFactorLoginRequest("token123", "123456"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_Token_Should_Fail()
    {
        var result = _validator.TestValidate(new TwoFactorLoginRequest("", "123456"));
        result.ShouldHaveValidationErrorFor(x => x.TwoFactorToken);
    }

    [Fact]
    public void Code_Wrong_Length_Should_Fail()
    {
        var result = _validator.TestValidate(new TwoFactorLoginRequest("token", "12345"));
        result.ShouldHaveValidationErrorFor(x => x.Code);
    }
}

public class TwoFactorEmailOtpLoginRequestValidatorTests
{
    private readonly TwoFactorEmailOtpLoginRequestValidator _validator = new();

    [Fact]
    public void Valid_Request_Should_Pass()
    {
        var result = _validator.TestValidate(new TwoFactorEmailOtpLoginRequest("token", "123456"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_EmailCode_Should_Fail()
    {
        var result = _validator.TestValidate(new TwoFactorEmailOtpLoginRequest("token", ""));
        result.ShouldHaveValidationErrorFor(x => x.EmailCode);
    }

    [Fact]
    public void EmailCode_Wrong_Length_Should_Fail()
    {
        var result = _validator.TestValidate(new TwoFactorEmailOtpLoginRequest("token", "12345"));
        result.ShouldHaveValidationErrorFor(x => x.EmailCode);
    }
}
