export default function TransactionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          + Add Transaction
        </button>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">Track Your Money</h2>
        <p className="text-gray-500 mb-4">
          Record income, expenses, and transfers. See where your money goes.
        </p>
        <p className="text-sm text-gray-400">Coming soon...</p>
      </div>
    </div>
  );
}
