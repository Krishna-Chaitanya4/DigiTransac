using DigiTransac.Core.Models;

namespace DigiTransac.Infrastructure.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByUsernameAsync(string username);
    Task<User?> GetByIdAsync(string id);
    Task<User> CreateAsync(User user);
    Task<User?> UpdateAsync(string id, User user);
}
