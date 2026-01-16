export default function AccountsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Accounts</h1>
      
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">Manage Your Accounts</h2>
        <p className="text-gray-500 mb-4">
          Add and manage your bank accounts, credit cards, wallets, and cash accounts.
        </p>
        <p className="text-sm text-gray-400">Coming soon...</p>
      </div>
    </div>
  );
}
