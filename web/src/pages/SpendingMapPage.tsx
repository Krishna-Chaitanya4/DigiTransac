import { useState, useMemo, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTransactions, useLabels } from '../hooks';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../services/currencyService';
import { Transaction, TransactionLocation } from '../types/transactions';
import { Label } from '../types/labels';
import { Link } from 'react-router-dom';

// Fix Leaflet default marker icon issue with webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Category color mapping for markers
const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#F97316', // Orange
  'Groceries': '#22C55E',     // Green
  'Shopping': '#3B82F6',       // Blue
  'Transportation': '#8B5CF6', // Purple
  'Entertainment': '#EC4899',  // Pink
  'Healthcare': '#EF4444',     // Red
  'Utilities': '#6366F1',      // Indigo
  'Travel': '#14B8A6',         // Teal
  'default': '#6B7280',        // Gray
};

// Create colored marker icon
function createColoredIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
}

// Component to recenter map when bounds change
function MapBoundsUpdater({ transactions }: { transactions: TransactionWithLocation[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (transactions.length > 0) {
      const bounds = L.latLngBounds(
        transactions.map(t => [t.location.latitude, t.location.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [transactions, map]);
  
  return null;
}

// Transaction with guaranteed location
interface TransactionWithLocation extends Transaction {
  location: TransactionLocation;
}

// Filter options
type DateFilter = 'thisMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'all';

interface LocationCluster {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  transactions: TransactionWithLocation[];
  totalAmount: number;
  transactionCount: number;
  primaryCategory?: string;
  primaryCategoryColor?: string;
}

export default function SpendingMapPage() {
  const { primaryCurrency } = useCurrency();
  const [dateFilter, setDateFilter] = useState<DateFilter>('last3Months');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  
  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    
    switch (dateFilter) {
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last3Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'last6Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        startDate = new Date(2000, 0, 1); // Far past
        break;
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    };
  }, [dateFilter]);
  
  // Fetch transactions
  const { data: transactionsData, isLoading } = useTransactions({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    status: 'Confirmed',
    pageSize: 1000, // Get more transactions for map
  });
  
  // Fetch labels for category colors
  const { data: labels = [] } = useLabels();
  
  // Create label color map
  const labelColorMap = useMemo(() => {
    const map: Record<string, { color: string; name: string; icon?: string }> = {};
    labels.forEach(label => {
      map[label.id] = {
        color: label.color || DEFAULT_CATEGORY_COLORS.default,
        name: label.name,
        icon: label.icon || undefined,
      };
    });
    return map;
  }, [labels]);
  
  // Filter transactions with locations
  const transactionsWithLocations = useMemo(() => {
    if (!transactionsData?.transactions) return [];
    
    return transactionsData.transactions.filter(
      (t): t is TransactionWithLocation =>
        t.location !== undefined &&
        t.location.latitude !== undefined &&
        t.location.longitude !== undefined &&
        !t.isRecurringTemplate
    );
  }, [transactionsData]);
  
  // Apply category filter
  const filteredTransactions = useMemo(() => {
    if (!selectedCategory) return transactionsWithLocations;
    return transactionsWithLocations.filter(t =>
      t.splits.some(s => s.labelId === selectedCategory)
    );
  }, [transactionsWithLocations, selectedCategory]);
  
  // Group transactions by location for insights
  const locationClusters = useMemo(() => {
    const clusters: Record<string, LocationCluster> = {};
    
    filteredTransactions.forEach(t => {
      // Create a location key based on rounded coordinates (for clustering nearby transactions)
      const latKey = Math.round(t.location.latitude * 1000) / 1000;
      const lngKey = Math.round(t.location.longitude * 1000) / 1000;
      const key = `${latKey},${lngKey}`;
      
      if (!clusters[key]) {
        clusters[key] = {
          id: key,
          name: t.location.placeName || t.location.city || 'Unknown Location',
          latitude: t.location.latitude,
          longitude: t.location.longitude,
          transactions: [],
          totalAmount: 0,
          transactionCount: 0,
        };
      }
      
      clusters[key].transactions.push(t);
      clusters[key].totalAmount += t.amount;
      clusters[key].transactionCount++;
    });
    
    // Calculate primary category for each cluster
    Object.values(clusters).forEach(cluster => {
      const categoryAmounts: Record<string, number> = {};
      cluster.transactions.forEach(t => {
        t.splits.forEach(s => {
          categoryAmounts[s.labelId] = (categoryAmounts[s.labelId] || 0) + s.amount;
        });
      });
      
      const topCategory = Object.entries(categoryAmounts).sort((a, b) => b[1] - a[1])[0];
      if (topCategory && labelColorMap[topCategory[0]]) {
        cluster.primaryCategory = labelColorMap[topCategory[0]].name;
        cluster.primaryCategoryColor = labelColorMap[topCategory[0]].color;
      }
    });
    
    return Object.values(clusters).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredTransactions, labelColorMap]);
  
  // Get unique categories from transactions
  const availableCategories = useMemo(() => {
    const categoryIds = new Set<string>();
    transactionsWithLocations.forEach(t => {
      t.splits.forEach(s => categoryIds.add(s.labelId));
    });
    return Array.from(categoryIds)
      .map(id => labelColorMap[id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [transactionsWithLocations, labelColorMap]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const totalSpending = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const uniqueLocations = new Set(
      filteredTransactions.map(t => `${t.location.latitude},${t.location.longitude}`)
    ).size;
    
    return {
      totalTransactions: filteredTransactions.length,
      totalSpending,
      uniqueLocations,
      topLocation: locationClusters[0],
    };
  }, [filteredTransactions, locationClusters]);
  
  // Get marker color for transaction
  const getMarkerColor = useCallback((transaction: TransactionWithLocation): string => {
    const firstSplit = transaction.splits[0];
    if (firstSplit && labelColorMap[firstSplit.labelId]) {
      return labelColorMap[firstSplit.labelId].color;
    }
    return DEFAULT_CATEGORY_COLORS.default;
  }, [labelColorMap]);
  
  // Default center (user's location or fallback)
  const defaultCenter: [number, number] = useMemo(() => {
    if (filteredTransactions.length > 0) {
      // Center on first transaction
      return [filteredTransactions[0].location.latitude, filteredTransactions[0].location.longitude];
    }
    // Default to India center if no transactions
    return [20.5937, 78.9629];
  }, [filteredTransactions]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Spending Map</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Visualize where you spend money
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="thisMonth">This Month</option>
            <option value="last3Months">Last 3 Months</option>
            <option value="last6Months">Last 6 Months</option>
            <option value="thisYear">This Year</option>
            <option value="all">All Time</option>
          </select>
          
          {/* Category Filter */}
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Categories</option>
            {availableCategories.map(cat => (
              <option key={cat.name} value={labels.find(l => l.name === cat.name)?.id}>
                {cat.name}
              </option>
            ))}
          </select>
          
          {/* Heatmap Toggle */}
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showHeatmap
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            🔥 Heatmap
          </button>
        </div>
      </div>
      
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Transactions</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {stats.totalTransactions}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Spent</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(stats.totalSpending, primaryCurrency)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Locations</div>
          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {stats.uniqueLocations}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Top Location</div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {stats.topLocation?.name || 'N/A'}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Map Container */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-8">
              <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-lg font-medium mb-2">No transactions with locations</p>
              <p className="text-sm text-center">
                Enable location when creating transactions to see them on the map.
              </p>
              <Link
                to="/transactions"
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Transaction
              </Link>
            </div>
          ) : (
            <MapContainer
              center={defaultCenter}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapBoundsUpdater transactions={filteredTransactions} />
              
              {showHeatmap ? (
                // Heatmap mode - show circles with size based on spending
                <>
                  {locationClusters.map(cluster => {
                    const maxAmount = Math.max(...locationClusters.map(c => c.totalAmount));
                    const radius = Math.max(20, Math.min(80, (cluster.totalAmount / maxAmount) * 80));
                    
                    return (
                      <CircleMarker
                        key={cluster.id}
                        center={[cluster.latitude, cluster.longitude]}
                        radius={radius}
                        pathOptions={{
                          color: cluster.primaryCategoryColor || '#EF4444',
                          fillColor: cluster.primaryCategoryColor || '#EF4444',
                          fillOpacity: 0.4,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div className="min-w-[200px]">
                            <div className="font-semibold text-gray-900">{cluster.name}</div>
                            <div className="text-lg font-bold text-blue-600 mt-1">
                              {formatCurrency(cluster.totalAmount, primaryCurrency)}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {cluster.transactionCount} transaction{cluster.transactionCount !== 1 ? 's' : ''}
                            </div>
                            {cluster.primaryCategory && (
                              <div
                                className="inline-block px-2 py-0.5 rounded-full text-xs text-white mt-2"
                                style={{ backgroundColor: cluster.primaryCategoryColor }}
                              >
                                {cluster.primaryCategory}
                              </div>
                            )}
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </>
              ) : (
                // Marker cluster mode
                <MarkerClusterGroup
                  chunkedLoading
                  iconCreateFunction={(cluster: { getChildCount: () => number }) => {
                    const count = cluster.getChildCount();
                    return L.divIcon({
                      html: `<div class="cluster-icon">${count}</div>`,
                      className: 'custom-cluster-icon',
                      iconSize: L.point(40, 40, true),
                    });
                  }}
                >
                  {filteredTransactions.map(transaction => (
                    <Marker
                      key={transaction.id}
                      position={[transaction.location.latitude, transaction.location.longitude]}
                      icon={createColoredIcon(getMarkerColor(transaction))}
                    >
                      <Popup>
                        <div className="min-w-[200px]">
                          <div className="font-semibold text-gray-900">
                            {transaction.payee || transaction.title || 'Transaction'}
                          </div>
                          <div className="text-lg font-bold text-blue-600 mt-1">
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {new Date(transaction.dateLocal || transaction.date).toLocaleDateString()}
                          </div>
                          {transaction.location.placeName && (
                            <div className="text-sm text-gray-500 mt-1">
                              📍 {transaction.location.placeName}
                            </div>
                          )}
                          {transaction.splits.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {transaction.splits.slice(0, 3).map((split, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block px-2 py-0.5 rounded-full text-xs text-white"
                                  style={{ backgroundColor: labelColorMap[split.labelId]?.color || '#6B7280' }}
                                >
                                  {labelColorMap[split.labelId]?.name || split.labelName || 'Category'}
                                </span>
                              ))}
                            </div>
                          )}
                          <Link
                            to={`/transactions?id=${transaction.id}`}
                            className="block mt-3 text-sm text-blue-600 hover:underline"
                          >
                            View Details →
                          </Link>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              )}
            </MapContainer>
          )}
        </div>
        
        {/* Sidebar - Top Locations */}
        <div className="w-80 hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top Spending Locations</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {locationClusters.length} unique location{locationClusters.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {locationClusters.slice(0, 10).map((cluster, index) => (
              <div
                key={cluster.id}
                className="p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                    style={{ backgroundColor: cluster.primaryCategoryColor || '#6B7280' }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {cluster.name}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {formatCurrency(cluster.totalAmount, primaryCurrency)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {cluster.transactionCount} txn{cluster.transactionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {cluster.primaryCategory && (
                      <div className="mt-1">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs text-white"
                          style={{ backgroundColor: cluster.primaryCategoryColor }}
                        >
                          {cluster.primaryCategory}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {locationClusters.length === 0 && (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                No locations to display
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* CSS for cluster icons */}
      <style>{`
        .custom-cluster-icon {
          background: transparent !important;
        }
        .cluster-icon {
          background: linear-gradient(135deg, #3B82F6, #1D4ED8);
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
        .leaflet-popup-content {
          margin: 12px;
        }
      `}</style>
    </div>
  );
}