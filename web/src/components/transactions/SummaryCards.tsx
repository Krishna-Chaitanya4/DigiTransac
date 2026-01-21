import { getCurrencySymbol } from '../../services/currencyService';
import { formatAmount } from '../../utils/formatters';

interface SummaryCardProps {
  label: string;
  amount: number;
  icon: string;
  colorClass: string;
  currency: string;
}

export function SummaryCard({ 
  label, 
  amount, 
  icon, 
  colorClass,
  currency 
}: SummaryCardProps) {
  const symbol = getCurrencySymbol(currency);
  const formattedAmount = formatAmount(Math.abs(amount), currency);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-lg font-semibold ${colorClass}`}>
        {amount < 0 ? '-' : ''}{symbol}{formattedAmount}
      </div>
    </div>
  );
}

interface SummaryCardsProps {
  totalCredits: number;
  totalDebits: number;
  netChange: number;
  currency: string;
}

export function SummaryCards({ 
  totalCredits, 
  totalDebits, 
  netChange, 
  currency 
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <SummaryCard
        label="Money In"
        amount={totalCredits}
        icon="↓"
        colorClass="text-green-600 dark:text-green-400"
        currency={currency}
      />
      <SummaryCard
        label="Money Out"
        amount={totalDebits}
        icon="↑"
        colorClass="text-red-600 dark:text-red-400"
        currency={currency}
      />
      <SummaryCard
        label="Net"
        amount={netChange}
        icon="📊"
        colorClass={netChange >= 0 
          ? 'text-blue-600 dark:text-blue-400' 
          : 'text-orange-600 dark:text-orange-400'}
        currency={currency}
      />
    </div>
  );
}
