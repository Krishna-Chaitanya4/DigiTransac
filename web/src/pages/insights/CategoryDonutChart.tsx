import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryBreakdown } from '../../services/transactionService';

interface CategoryDonutChartProps {
  categories: CategoryBreakdown[];
  totalLabel: string;
  totalAmount: string;
  emptyColor?: string;
}

// Distinct color palette — adjacent colors are maximally different
export const CHART_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#10b981', // emerald
  '#eab308', // yellow
];

/** Returns the resolved chart color for a category at the given index */
export function getCategoryChartColor(labelColor: string | undefined, index: number): string {
  return labelColor || CHART_COLORS[index % CHART_COLORS.length];
}

// Custom tooltip component
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; percentage: number; fill: string } }> }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: data.fill }} />
        <span className="font-medium text-gray-900 dark:text-gray-100">{data.name}</span>
      </div>
      <div className="text-gray-500 dark:text-gray-400 mt-0.5">
        {data.percentage.toFixed(1)}%
      </div>
    </div>
  );
}

export function CategoryDonutChart({
  categories,
  totalLabel,
  totalAmount,
  emptyColor = '#e5e7eb',
}: CategoryDonutChartProps) {
  const hasData = categories.length > 0;

  const chartData = hasData
    ? categories.map((cat, index) => ({
        name: cat.labelName,
        value: cat.amount,
        percentage: cat.percentage,
        fill: cat.labelColor || CHART_COLORS[index % CHART_COLORS.length],
      }))
    : [{ name: 'No data', value: 1, percentage: 100, fill: emptyColor }];

  return (
    <div className="relative w-full flex justify-center">
      <div className="w-[180px] h-[180px] sm:w-[200px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={hasData && categories.length > 1 ? 2 : 0}
              dataKey="value"
              stroke="none"
              animationBegin={0}
              animationDuration={800}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.fill}
                  className="transition-opacity duration-200 hover:opacity-80"
                />
              ))}
            </Pie>
            {hasData && <Tooltip content={<CustomTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
            {totalLabel}
          </span>
          <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 max-w-[90px] sm:max-w-[110px] truncate">
            {totalAmount}
          </span>
        </div>
      </div>
    </div>
  );
}
