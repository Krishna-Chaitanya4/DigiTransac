import { memo, useState, useCallback, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { getCurrencySymbol } from '../services/currencyService';
import { apiClient } from '../services/apiClient';
import { logger } from '../services/logger';
import type { Account } from '../services/accountService';

interface ImportPreviewRow {
  date: string;
  type: 'Send' | 'Receive';
  amount: number;
  title: string | null;
  notes: string | null;
  isDuplicate: boolean;
  validationErrors: string[];
}

interface ParseResponse {
  transactions: ImportPreviewRow[];
  totalCount: number;
  duplicateCount: number;
  errorCount: number;
  columnMapping: Record<string, string>;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export const BulkImportModal = memo(function BulkImportModal({
  isOpen,
  onClose,
  accounts,
}: BulkImportModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts.find(a => a.isDefault && !a.isArchived)?.id || accounts.find(a => !a.isArchived)?.id || ''
  );
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [createMissingLabels, setCreateMissingLabels] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  
  // Preview state
  const [previewData, setPreviewData] = useState<ParseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Import result state
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    skippedCount: number;
    errorCount: number;
  } | null>(null);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const handleClose = useCallback(() => {
    setStep('upload');
    setCsvContent('');
    setFileName('');
    setPreviewData(null);
    setError(null);
    setImportResult(null);
    onClose();
  }, [onClose]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setFileName(file.name);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please drop a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setCsvContent(content);
      setFileName(file.name);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!csvContent || !selectedAccountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<ParseResponse>('/transactions/import/parse', {
        accountId: selectedAccountId,
        csvContent,
        hasHeaderRow,
        createMissingLabels,
        skipDuplicates,
      });
      
      setPreviewData(response);
      setStep('preview');
    } catch (err) {
      logger.error('Failed to parse CSV:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
    } finally {
      setIsLoading(false);
    }
  }, [csvContent, selectedAccountId, hasHeaderRow, createMissingLabels, skipDuplicates]);

  const handleImport = useCallback(async () => {
    if (!previewData || !selectedAccountId) return;

    setStep('importing');
    setError(null);

    try {
      const response = await apiClient.post<{
        importedCount: number;
        skippedCount: number;
        errorCount: number;
      }>('/transactions/import', {
        accountId: selectedAccountId,
        csvContent,
        hasHeaderRow,
        createMissingLabels,
        skipDuplicates,
      });
      
      setImportResult(response);
      setStep('complete');
    } catch (err) {
      logger.error('Failed to import transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to import transactions');
      setStep('preview');
    }
  }, [previewData, selectedAccountId, csvContent, hasHeaderRow, createMissingLabels, skipDuplicates]);

  const handleBack = useCallback(() => {
    if (step === 'preview') {
      setStep('upload');
      setPreviewData(null);
    } else if (step === 'complete') {
      handleClose();
    }
  }, [step, handleClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-title"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 dark:bg-black/60 transition-opacity" 
        onClick={handleClose} 
        aria-hidden="true" 
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl 
          shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'upload' && step !== 'complete' && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                  hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                aria-label="Back"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 
              id="bulk-import-title" 
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {step === 'upload' && 'Import Transactions'}
              {step === 'preview' && 'Preview Import'}
              {step === 'importing' && 'Importing...'}
              {step === 'complete' && 'Import Complete'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
              hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 
              rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Import to Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select account...</option>
                  {accounts.filter(a => !a.isArchived).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* File Upload Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CSV File
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    fileName
                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {fileName ? (
                    <>
                      <svg className="w-12 h-12 mx-auto mb-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {fileName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Click to change file
                      </p>
                    </>
                  ) : (
                    <>
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Drop your CSV file here
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        or click to browse
                      </p>
                    </>
                  )}
                </div>
              </div>
              
              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={hasHeaderRow}
                    onChange={(e) => setHasHeaderRow(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 
                      text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    First row contains headers
                  </span>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={createMissingLabels}
                    onChange={(e) => setCreateMissingLabels(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 
                      text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Create missing categories automatically
                  </span>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 
                      text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Skip duplicate transactions
                  </span>
                </label>
              </div>
              
              {/* Format info */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Expected CSV Format
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  We'll automatically detect columns. Common formats supported:
                </p>
                <code className="block text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                  Date, Description, Amount, Type, Category
                </code>
              </div>
            </div>
          )}
          
          {/* Preview Step */}
          {step === 'preview' && previewData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {previewData.totalCount}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {previewData.duplicateCount}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Duplicates</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {previewData.errorCount}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Errors</p>
                </div>
              </div>
              
              {/* Preview table */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Date</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Title</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Amount</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {previewData.transactions.slice(0, 10).map((row, index) => (
                        <tr key={index} className={row.isDuplicate ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.date}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              row.type === 'Receive' 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-[200px] truncate">
                            {row.title || '(No title)'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-gray-100">
                            {getCurrencySymbol(selectedAccount?.currency || 'USD')}{row.amount.toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {row.validationErrors.length > 0 ? (
                              <span className="text-xs text-red-600 dark:text-red-400">
                                {row.validationErrors[0]}
                              </span>
                            ) : row.isDuplicate ? (
                              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                Duplicate
                              </span>
                            ) : (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.transactions.length > 10 && (
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 text-center">
                    And {previewData.transactions.length - 10} more transactions...
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Importing Step */}
          {step === 'importing' && (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-500 
                rounded-full animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">
                Importing transactions...
              </p>
            </div>
          )}
          
          {/* Complete Step */}
          {step === 'complete' && importResult && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full 
                flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Import Complete!
              </h3>
              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {importResult.importedCount}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Imported</p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {importResult.skippedCount}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Skipped</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {importResult.errorCount}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Errors</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
          {step === 'upload' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 
                  rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={!csvContent || !selectedAccountId || isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                  font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center gap-2"
              >
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Preview Import
              </button>
            </>
          )}
          
          {step === 'preview' && (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 
                  rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!previewData || previewData.totalCount === 0 || 
                  (previewData.totalCount === previewData.duplicateCount + previewData.errorCount)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 
                  font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {previewData ? previewData.totalCount - previewData.duplicateCount - previewData.errorCount : 0} Transactions
              </button>
            </>
          )}
          
          {step === 'complete' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                font-medium transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
});