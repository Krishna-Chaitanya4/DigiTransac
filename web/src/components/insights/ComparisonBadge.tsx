// Helper to calculate percentage change
function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // Can't calculate % change from 0
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

// Format percentage change with sign
function formatPercentChange(change: number | null): string {
  if (change === null) return 'New';
  if (change === 0) return '0%';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}%`;
}

// Get color class for percentage change badge
function getPercentChangeColor(change: number | null, invertColors = false): string {
  if (change === null) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  if (change === 0) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  
  // For expenses, increase is bad (red), decrease is good (green)
  // For income, increase is good (green), decrease is bad (red)
  const isPositive = change > 0;
  const isGood = invertColors ? !isPositive : isPositive;
  
  if (isGood) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
  } else {
    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
  }
}

export interface ComparisonBadgeProps {
  current: number;
  previous: number;
  invertColors?: boolean; // true for expenses (increase = bad)
  label?: string;
}

export function ComparisonBadge({ 
  current, 
  previous, 
  invertColors = false, 
  label = 'vs last period' 
}: ComparisonBadgeProps) {
  const change = calculatePercentChange(current, previous);
  const colorClass = getPercentChangeColor(change, invertColors);
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {formatPercentChange(change)} {label}
    </span>
  );
}