using DigiTransac.Core.Models;
using DigiTransac.Infrastructure.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DigiTransac.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryRepository _repository;
    private const string DemoUserId = "677c9b1e5f8a4c2d3e1f0a2b"; // Demo user ID

    public CategoriesController(ICategoryRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<Category>>>> GetAll()
    {
        try
        {
            var categories = await _repository.GetAllAsync(DemoUserId);
            return Ok(new ApiResponse<List<Category>>
            {
                Success = true,
                Data = categories
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error in GetAll: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            return StatusCode(500, new ApiResponse<List<Category>>
            {
                Success = false,
                Message = $"Error fetching categories: {ex.Message}"
            });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Category>>> GetById(string id)
    {
        var category = await _repository.GetByIdAsync(id, DemoUserId);
        if (category == null)
        {
            return NotFound(new ApiResponse<Category>
            {
                Success = false,
                Message = "Category not found"
            });
        }

        return Ok(new ApiResponse<Category>
        {
            Success = true,
            Data = category
        });
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<Category>>> Create([FromBody] CreateCategoryRequest request)
    {
        var category = new Category
        {
            UserId = DemoUserId,
            Name = request.Name,
            Icon = request.Icon,
            Color = request.Color,
            Type = request.Type,
            ParentId = request.ParentId
        };

        var created = await _repository.CreateAsync(category);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, new ApiResponse<Category>
        {
            Success = true,
            Data = created
        });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<Category>>> Update(string id, [FromBody] UpdateCategoryRequest request)
    {
        var existing = await _repository.GetByIdAsync(id, DemoUserId);
        if (existing == null)
        {
            return NotFound(new ApiResponse<Category>
            {
                Success = false,
                Message = "Category not found"
            });
        }

        existing.Name = request.Name;
        existing.Icon = request.Icon;
        existing.Color = request.Color;
        existing.Type = request.Type;
        existing.ParentId = request.ParentId;

        var updated = await _repository.UpdateAsync(id, existing);
        if (!updated)
        {
            return BadRequest(new ApiResponse<Category>
            {
                Success = false,
                Message = "Failed to update category"
            });
        }

        return Ok(new ApiResponse<Category>
        {
            Success = true,
            Data = existing
        });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(string id)
    {
        var deleted = await _repository.DeleteAsync(id, DemoUserId);
        if (!deleted)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Category not found"
            });
        }

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Category deleted successfully"
        });
    }
}

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; }
}

public class CreateCategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public CategoryType Type { get; set; }
    public string? ParentId { get; set; }
}

public class UpdateCategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public CategoryType Type { get; set; }
    public string? ParentId { get; set; }
}
