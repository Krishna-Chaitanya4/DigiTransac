import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartErrorBoundary } from '../../components/error';
import type { DragProps, SectionId } from './types';
import type { TransactionAnalytics } from '../../services/transactionService';
import type { TransactionSummary } from '../../types/transactions';
import { convertAndFormat } from './helpers';
import { CollapsibleSection } from './InsightWidgets';
import { formatCurrency } from '../../services/currencyService';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface TrendsWidgetProps {
  analytics: TransactionAnalytics | undefined;
  transactionSummary: TransactionSummary | undefined;
  primaryCurrency: string;
  convert: (amount: number, fromCurrency: string) => number;
  isLoading: boolean;
  collapsedSections: Set<string>;
  toggleSection: (id: SectionId) => void;
  dragProps: DragProps;
}

interface ChartDataPoint {
  date: string;       // display label for X-axis
  fullDate: string;   // full date for tooltip
  moneyIn: number;
  moneyOut: number;
  net: number;
}

// Format a date string (yyyy-MM-dd) nicely for the tooltip
function formatFullDate(period: string): string {
  const parts = period.split('-');
  if (parts.length === 3) {
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return `${MONTH_NAMES[monthIdx]} ${day}, ${parts[0]}`;
  }
  return period;
}

// Custom tooltip for the chart
function CashFlowTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string; payload: ChartDataPoint }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const moneyIn = payload.find((p) => p.dataKey === 'moneyIn')?.value ?? 0;
  const moneyOut = payload.find((p) => p.dataKey === 'moneyOut')?.value ?? 0;
  const fullDate = payload[0]?.payload?.fullDate ?? label;
  const net = moneyIn - moneyOut;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">{fullDate}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Money In</span>
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatCurrency(moneyIn, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Money Out</span>
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatCurrency(moneyOut, currency)}
          </span>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-1 mt-1 flex items-center justify-between gap-4">
          <span className="text-gray-600 dark:text-gray-400">Net</span>
          <span className={`font-semibold ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {net >= 0 ? '+' : ''}{formatCurrency(net, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TrendsWidget({
  analytics,
  transactionSummary,
  primaryCurrency,
  convert,
  isLoading,
  collapsedSections,
  toggleSection,
  dragProps,
}: TrendsWidgetProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!analytics?.spendingTrend) return [];
    const sourceCurrency = transactionSummary?.currency;
    return analytics.spendingTrend.map((trend) => {
      const moneyIn = sourceCurrency && sourceCurrency !== primaryCurrency
        ? convert(trend.credits, sourceCurrency) : trend.credits;
      const moneyOut = sourceCurrency && sourceCurrency !== primaryCurrency
        ? convert(trend.debits, sourceCurrency) : trend.debits;

      // Format short label: "Jan 5" for daily data, "Jan '25" for monthly
      const parts = trend.period.split('-');
      let dateLabel: string;
      if (parts.length === 3) {
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        dateLabel = `${MONTH_NAMES[monthIdx]} ${day}`;
      } else {
        const monthIdx = parseInt(parts[1], 10) - 1;
        dateLabel = `${MONTH_NAMES[monthIdx]} '${parts[0].substring(2)}`;
      }

      return {
        date: dateLabel,
        fullDate: formatFullDate(trend.period),
        moneyIn: Math.round(moneyIn * 100) / 100,
        moneyOut: Math.round(moneyOut * 100) / 100,
        net: Math.round((moneyIn - moneyOut) * 100) / 100,
      };
    });
  }, [analytics?.spendingTrend, transactionSummary?.currency, primaryCurrency, convert]);

  const displayCurrency = primaryCurrency;
  const totalDays = chartData.length;

  // Compute smart X-axis tick interval based on number of days
  const xAxisInterval = useMemo(() => {
    if (totalDays <= 14) return 0;           // show every day
    if (totalDays <= 31) return 1;           // every other day
    if (totalDays <= 90) return 6;           // ~weekly
    if (totalDays <= 180) return 13;         // ~biweekly
    return Math.floor(totalDays / 12) - 1;  // ~12 labels
  }, [totalDays]);

  // Format Y-axis tick values compactly
  const formatYAxis = (value: number): string => {
    if (value >= 100000) return `${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`;
    if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
    return value.toString();
  };

  // Subtitle based on data range
  const subtitle = useMemo(() => {
    if (!chartData.length) return undefined;
    if (totalDays <= 1) return '1 day';
    return `${totalDays} days`;
  }, [chartData.length, totalDays]);

  return (
    <ChartErrorBoundary chartType="trend">
      <CollapsibleSection
        id="trends"
        title="Cash Flow"
        subtitle={subtitle}
        icon={
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        }
        isCollapsed={collapsedSections.has('trends')}
        onToggle={toggleSection}
        className="mb-6"
        {...dragProps}
      >
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading chart...</div>
          </div>
        ) : chartData.length > 0 ? (
          <div className="space-y-4 pt-4">
            {/* Recharts Area Chart */}
            <div className="w-full h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradientMoneyIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradientMoneyOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="currentColor"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                    interval={xAxisInterval}
                    angle={totalDays > 14 ? -45 : 0}
                    textAnchor={totalDays > 14 ? 'end' : 'middle'}
                    height={totalDays > 14 ? 50 : 30}
                  />
                  <YAxis
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                  />
                  <Tooltip
                    content={<CashFlowTooltip currency={displayCurrency} />}
                    cursor={{ stroke: '#9CA3AF', strokeDasharray: '3 3' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="line"
                    iconSize={12}
                    wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }}
                    formatter={(value: string) => (
                      <span className="text-gray-600 dark:text-gray-400">{value}</span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="moneyIn"
                    name="Money In"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#gradientMoneyIn)"
                    dot={totalDays <= 31}
                    activeDot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="moneyOut"
                    name="Money Out"
                    stroke="#F43F5E"
                    strokeWidth={2}
                    fill="url(#gradientMoneyOut)"
                    dot={totalDays <= 31}
                    activeDot={{ r: 4, fill: '#F43F5E', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">Daily Average</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {convertAndFormat(analytics!.dailyAverage, transactionSummary?.currency, primaryCurrency, convert)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">Monthly Average</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {convertAndFormat(analytics!.monthlyAverage, transactionSummary?.currency, primaryCurrency, convert)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p>No trend data available</p>
          </div>
        )}
      </CollapsibleSection>
    </ChartErrorBoundary>
  );
}
