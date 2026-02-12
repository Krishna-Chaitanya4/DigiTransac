import { useState, useRef, useCallback } from 'react';
import { exportTransactions } from '../../services/transactionService';
import { createTransaction } from '../../services/transactionService';
import { useLabels, useAccounts } from '../../hooks';
import type { CreateTransactionRequest } from '../../types/transactions';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  type: string;
  category: string;
  account: string;
  payee: string;
  notes: string;
}

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ['date', 'amount', 'description'];

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Parse headers
  const headers = parseCsvLine(lines[0]);

  // Parse data rows
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue;
    const row: CsvRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lower = headers.map(h => h.toLowerCase());

  // Date
  const dateIdx = lower.findIndex(h => h.includes('date') || h.includes('time'));
  if (dateIdx >= 0) mapping.date = headers[dateIdx];

  // Amount
  const amountIdx = lower.findIndex(h => h.includes('amount') || h.includes('total') || h.includes('sum'));
  if (amountIdx >= 0) mapping.amount = headers[amountIdx];

  // Description
  const descIdx = lower.findIndex(h => h.includes('description') || h.includes('memo') || h.includes('narration') || h.includes('particular'));
  if (descIdx >= 0) mapping.description = headers[descIdx];

  // Type
  const typeIdx = lower.findIndex(h => h === 'type' || h.includes('transaction type') || h.includes('credit/debit'));
  if (typeIdx >= 0) mapping.type = headers[typeIdx];

  // Category
  const catIdx = lower.findIndex(h => h.includes('category') || h.includes('label'));
  if (catIdx >= 0) mapping.category = headers[catIdx];

  // Account
  const accIdx = lower.findIndex(h => h.includes('account'));
  if (accIdx >= 0) mapping.account = headers[accIdx];

  // Payee
  const payeeIdx = lower.findIndex(h => h.includes('payee') || h.includes('merchant') || h.includes('vendor'));
  if (payeeIdx >= 0) mapping.payee = headers[payeeIdx];

  // Notes
  const notesIdx = lower.findIndex(h => h.includes('note') || h.includes('comment') || h.includes('remark'));
  if (notesIdx >= 0) mapping.notes = headers[notesIdx];

  return mapping;
}

export default function DataManagementSection() {
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');

  // Import state
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>({});
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [importError, setImportError] = useState('');
  const [defaultAccountId, setDefaultAccountId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data hooks
  const { data: labels = [] } = useLabels();
  const { data: accounts = [] } = useAccounts();

  // ─── Export ───────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportError('');
    setExportSuccess('');

    try {
      const data = await exportTransactions({}, exportFormat);
      const blob =
        exportFormat === 'csv'
          ? new Blob([data as string], { type: 'text/csv;charset=utf-8;' })
          : new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `digitransac-export-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(`Data exported successfully as ${exportFormat.toUpperCase()}`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [exportFormat]);

  // ─── Import ──────────────────────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCsv(text);

      if (headers.length === 0 || rows.length === 0) {
        setImportError('CSV file appears to be empty or invalid');
        return;
      }

      setCsvHeaders(headers);
      setCsvRows(rows);
      setColumnMapping(guessMapping(headers));

      // Auto-set default account if there's only one
      if (accounts.length === 1) {
        setDefaultAccountId(accounts[0].id);
      }

      setImportStep('mapping');
    };
    reader.onerror = () => setImportError('Failed to read file');
    reader.readAsText(file);

    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [accounts]);

  const handleMappingChange = useCallback((field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({ ...prev, [field]: value || undefined }));
  }, []);

  const isMappingValid = REQUIRED_FIELDS.every(f => columnMapping[f]);

  const handleGoToPreview = useCallback(() => {
    if (!isMappingValid) return;
    setImportStep('preview');
  }, [isMappingValid]);

  const handleImport = useCallback(async () => {
    if (!isMappingValid) return;
    setImportStep('importing');
    setImportProgress({ done: 0, total: csvRows.length, errors: 0 });

    let done = 0;
    let errors = 0;

    // Find label map by name (case-insensitive)
    const labelMap = new Map(labels.map(l => [l.name.toLowerCase(), l.id]));

    // Find account map
    const accountMap = new Map(accounts.map(a => [a.name.toLowerCase(), a.id]));

    for (const row of csvRows) {
      try {
        const dateStr = row[columnMapping.date!];
        const amountStr = row[columnMapping.amount!];
        const description = row[columnMapping.description!];

        // Parse date
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          errors++;
          done++;
          setImportProgress({ done, total: csvRows.length, errors });
          continue;
        }

        // Parse amount
        const cleanAmount = amountStr.replace(/[^0-9.\-+]/g, '');
        const amount = parseFloat(cleanAmount);
        if (isNaN(amount)) {
          errors++;
          done++;
          setImportProgress({ done, total: csvRows.length, errors });
          continue;
        }

        // Determine type: 'Receive' = money in, 'Send' = money out
        let type: 'Receive' | 'Send' = amount >= 0 ? 'Receive' : 'Send';
        if (columnMapping.type) {
          const typeVal = row[columnMapping.type].toLowerCase();
          if (typeVal.includes('credit') || typeVal.includes('income') || typeVal.includes('deposit') || typeVal.includes('receive')) {
            type = 'Receive';
          } else if (typeVal.includes('debit') || typeVal.includes('expense') || typeVal.includes('withdraw') || typeVal.includes('send')) {
            type = 'Send';
          }
        }

        // Resolve category
        let labelId: string | undefined;
        if (columnMapping.category) {
          const catName = row[columnMapping.category].toLowerCase();
          labelId = labelMap.get(catName);
        }

        // Resolve account
        let accountId = defaultAccountId;
        if (columnMapping.account) {
          const accName = row[columnMapping.account].toLowerCase();
          const resolved = accountMap.get(accName);
          if (resolved) accountId = resolved;
        }

        if (!accountId) {
          errors++;
          done++;
          setImportProgress({ done, total: csvRows.length, errors });
          continue;
        }

        const request: CreateTransactionRequest = {
          date: parsedDate.toISOString(),
          amount: Math.abs(amount),
          title: description,
          type,
          accountId,
          splits: labelId ? [{ labelId, amount: Math.abs(amount) }] : [],
          payee: columnMapping.payee ? row[columnMapping.payee] || undefined : undefined,
          notes: columnMapping.notes ? row[columnMapping.notes] || undefined : undefined,
        };

        await createTransaction(request);
        done++;
        setImportProgress({ done, total: csvRows.length, errors });
      } catch {
        errors++;
        done++;
        setImportProgress({ done, total: csvRows.length, errors });
      }
    }

    setImportStep('done');
  }, [csvRows, columnMapping, defaultAccountId, labels, accounts, isMappingValid]);

  const resetImport = useCallback(() => {
    setImportStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setImportProgress({ done: 0, total: 0, errors: 0 });
    setImportError('');
  }, []);

  // ─── Render ──────────────────────────────────────────────────
  const previewRows = csvRows.slice(0, 5);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Data Management</h2>

      {/* ── Export Section ── */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Export Transactions</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Download all your transactions for backup or use in other tools
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              type="button"
              onClick={() => setExportFormat('csv')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                exportFormat === 'csv'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('json')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                exportFormat === 'json'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              JSON
            </button>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {isExporting ? 'Exporting...' : 'Export All'}
          </button>
        </div>
        {exportError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{exportError}</p>}
        {exportSuccess && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{exportSuccess}</p>}
      </div>

      <hr className="my-4 border-gray-200 dark:border-gray-700" />

      {/* ── Import Section ── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Import Transactions</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Import transactions from a CSV file (bank export, spreadsheet, etc.)
        </p>

        {importError && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
            {importError}
          </div>
        )}

        {/* Step: Upload */}
        {importStep === 'upload' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
          >
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Click to upload CSV file
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              .csv files up to 10MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Step: Column Mapping */}
        {importStep === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">{csvRows.length}</span> rows found. Map CSV columns to transaction fields:
              </p>
              <button onClick={resetImport} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                ← Start over
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ['date', 'Date *'],
                ['amount', 'Amount *'],
                ['description', 'Description *'],
                ['type', 'Type (Credit/Debit)'],
                ['category', 'Category'],
                ['account', 'Account'],
                ['payee', 'Payee'],
                ['notes', 'Notes'],
              ] as [keyof ColumnMapping, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                  <select
                    value={columnMapping[field] || ''}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">— Skip —</option>
                    {csvHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Default account picker (if no account column mapped) */}
            {!columnMapping.account && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Default Account *</label>
                <select
                  value={defaultAccountId}
                  onChange={(e) => setDefaultAccountId(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select account...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={resetImport}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleGoToPreview}
                disabled={!isMappingValid || (!columnMapping.account && !defaultAccountId)}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
              >
                Preview →
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {importStep === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Preview of first {previewRows.length} rows (of {csvRows.length}):
              </p>
              <button onClick={() => setImportStep('mapping')} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                ← Back to mapping
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Description</th>
                    {columnMapping.type && <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>}
                    {columnMapping.category && <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Category</th>}
                    {columnMapping.payee && <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Payee</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="px-3 py-2 whitespace-nowrap">{row[columnMapping.date!]}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono">{row[columnMapping.amount!]}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{row[columnMapping.description!]}</td>
                      {columnMapping.type && <td className="px-3 py-2">{row[columnMapping.type]}</td>}
                      {columnMapping.category && <td className="px-3 py-2">{row[columnMapping.category]}</td>}
                      {columnMapping.payee && <td className="px-3 py-2">{row[columnMapping.payee]}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={resetImport}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 dark:from-green-800 dark:to-green-900"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                Import {csvRows.length} Transactions
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {importStep === 'importing' && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Importing transactions...
            </p>
            <div className="w-full max-w-xs mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${importProgress.total ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {importProgress.done} / {importProgress.total}
              {importProgress.errors > 0 && (
                <span className="text-red-500 dark:text-red-400"> ({importProgress.errors} errors)</span>
              )}
            </p>
          </div>
        )}

        {/* Step: Done */}
        {importStep === 'done' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Import Complete!</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Successfully imported {importProgress.done - importProgress.errors} of {importProgress.total} transactions.
              {importProgress.errors > 0 && (
                <span className="text-red-500 dark:text-red-400"> {importProgress.errors} rows had errors and were skipped.</span>
              )}
            </p>
            <button
              onClick={resetImport}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Import More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}