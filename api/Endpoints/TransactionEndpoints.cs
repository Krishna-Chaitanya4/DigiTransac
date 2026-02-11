namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Transaction endpoint coordinator. Creates the shared route group and delegates to focused endpoint classes:
/// <see cref="TransactionCrudEndpoints"/> — CRUD, query, export, and pending count operations.
/// <see cref="TransactionBatchEndpoints"/> — Bulk delete and status update operations.
/// <see cref="TransactionAnalyticsEndpoints"/> — Spending analytics, patterns, anomalies, and location insights.
/// <see cref="TransactionImportEndpoints"/> — CSV/Excel parsing, preview, and bulk import.
/// </summary>
public static class TransactionEndpoints
{
    public static void MapTransactionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/transactions")
            .WithTags("Transactions")
            .RequireAuthorization();

        group.MapTransactionCrudEndpoints();
        group.MapTransactionBatchEndpoints();
        group.MapTransactionAnalyticsEndpoints();
        group.MapTransactionImportEndpoints();
    }
}
