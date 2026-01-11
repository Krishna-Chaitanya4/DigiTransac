using DigiTransac.Core.Models;

namespace DigiTransac.Infrastructure.Interfaces;

public interface ICategoryRepository
{
    Task<List<Category>> GetAllAsync(string userId);
    Task<Category?> GetByIdAsync(string id, string userId);
    Task<Category> CreateAsync(Category category);
    Task<bool> UpdateAsync(string id, Category category);
    Task<bool> DeleteAsync(string id, string userId);
}
