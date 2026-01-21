import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../services/currencyService';

export default function DashboardPage() {
  const { user } = useAuth();
  const { primaryCurrency } = useCurrency();

  // Placeholder values - will be replaced with real data
  const totalIncome = 0;
  const totalExpenses = 0;
  const balance = 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Dashboard</h1>
      
      {/* Welcome Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Welcome back, {user?.fullName}!
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Your digital transaction tracker is ready to use.
        </p>
      </div>

      {/* Quick Stats Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Income</div>
          <div className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalIncome, primaryCurrency)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Expenses</div>
          <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totalExpenses, primaryCurrency)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Balance</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(balance, primaryCurrency)}
          </div>
        </div>
      </div>

      {/* Recent Transactions Placeholder */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Recent Transactions</h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          <p>No transactions yet</p>
          <p className="text-sm mt-1">Start by adding your first transaction</p>
        </div>
      </div>
    </div>
  );
}
