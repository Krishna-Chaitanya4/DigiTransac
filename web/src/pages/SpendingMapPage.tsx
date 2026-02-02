import { useState, useMemo, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTransactions, useLabels, useLocationInsights, useTripGroups } from '../hooks';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../services/currencyService';
import { Transaction, TransactionLocation, TripGroup } from '../types/transactions';
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
type ViewMode = 'map' | 'trips';

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

// Trip Card Component
interface TripCardProps {
  trip: TripGroup;
  currency: string;
  isSelected: boolean;
  onClick: () => void;
}

function TripCard({ trip, currency, isSelected, onClick }: TripCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-lg border p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
      }`}
    >
      {/* Trip Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg">
            ✈️
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{trip.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {trip.city}{trip.country ? `, ${trip.country}` : ''}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(trip.totalAmount, currency)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {trip.transactionCount} txn{trip.transactionCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
      
      {/* Trip Duration */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>
          {new Date(trip.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          {' - '}
          {new Date(trip.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span className="text-gray-400">•</span>
        <span>{trip.durationDays} day{trip.durationDays !== 1 ? 's' : ''}</span>
      </div>
      
      {/* Category Pills */}
      {trip.categoryBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {trip.categoryBreakdown.slice(0, 3).map(cat => (
            <span
              key={cat.labelId}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
              style={{ backgroundColor: cat.labelColor || '#6B7280' }}
            >
              {cat.labelIcon && <span>{cat.labelIcon}</span>}
              {cat.labelName}
            </span>
          ))}
          {trip.categoryBreakdown.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              +{trip.categoryBreakdown.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function SpendingMapPage() {
  const { primaryCurrency } = useCurrency();
  const [dateFilter, setDateFilter] = useState<DateFilter>('last3Months');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [selectedTrip, setSelectedTrip] = useState<TripGroup | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Get user's current location for "nearby" insights
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          // Location denied or unavailable - that's ok
        }
      );
    }
  }, []);
  
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
  
  // Fetch location insights from API
  const { data: locationInsights } = useLocationInsights(
    dateRange.startDate,
    dateRange.endDate,
    userLocation?.latitude,
    userLocation?.longitude,
    1.0, // 1km radius for "nearby" spending
    true // enabled
  );
  
  // Fetch trip groups
  const { data: tripGroups, isLoading: isLoadingTrips } = useTripGroups(
    dateRange.startDate,
    dateRange.endDate,
    userLocation?.latitude,
    userLocation?.longitude,
    50, // 50km minimum distance to be considered a trip
    true // enabled
  );
  
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
        
        {/* View Mode Toggle + Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'map'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              🗺️ Map
            </button>
            <button
              onClick={() => setViewMode('trips')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'trips'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              ✈️ Trips
              {tripGroups && tripGroups.trips.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                  {tripGroups.trips.filter(t => !t.isHomeBase).length}
                </span>
              )}
            </button>
          </div>
          
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 hidden sm:block" />
          
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
          
          {/* Category Filter - only show in map mode */}
          {viewMode === 'map' && (
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
          )}
          
          {/* Heatmap Toggle - only show in map mode */}
          {viewMode === 'map' && (
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
          )}
        </div>
      </div>
      
      {/* Location Insights Card - "You spent ₹X near home" - only in map mode */}
      {viewMode === 'map' && locationInsights?.nearbySpending && (
        <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
              <span className="text-xl">📍</span>
            </div>
            <div className="flex-1">
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                You spent near here
              </div>
              <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                {formatCurrency(locationInsights.nearbySpending.totalAmount, primaryCurrency)}
              </div>
              <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                {locationInsights.nearbySpending.transactionCount} transaction{locationInsights.nearbySpending.transactionCount !== 1 ? 's' : ''}
                {locationInsights.nearbySpending.topCategory && (
                  <> • mostly on <span className="font-medium">{locationInsights.nearbySpending.topCategory}</span></>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar - Map Mode */}
      {viewMode === 'map' && (
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
      )}
      
      {/* Stats Bar - Trips Mode */}
      {viewMode === 'trips' && tripGroups && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Trips Detected</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {tripGroups.trips.filter(t => !t.isHomeBase).length}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Trip Spending</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(tripGroups.totalTripSpending, primaryCurrency)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Trip Transactions</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {tripGroups.totalTripTransactions}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Home Base</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {tripGroups.trips.find(t => t.isHomeBase)?.name || 'Not detected'}
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Map View */}
        {viewMode === 'map' && (
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
        )}
        
        {/* Trips View */}
        {viewMode === 'trips' && (
          <div className="flex-1 overflow-hidden">
            {isLoadingTrips ? (
              <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : !tripGroups || tripGroups.trips.filter(t => !t.isHomeBase).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 p-8">
                <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium mb-2">No trips detected</p>
                <p className="text-sm text-center max-w-md">
                  Trips are detected when you have transactions more than 50km from your usual locations.
                  Add more transactions with location data to see your travel spending!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto h-full pb-4">
                {tripGroups.trips.filter(t => !t.isHomeBase).map(trip => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    currency={primaryCurrency}
                    isSelected={selectedTrip?.id === trip.id}
                    onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Sidebar - Top Locations (Map Mode) */}
        {viewMode === 'map' && (
          <div className="w-80 hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top Spending Locations</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {locationInsights?.transactionsWithLocation ?? locationClusters.length} with location data
            </p>
          </div>
          
          {/* API-based insights summary */}
          {locationInsights && (
            <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Total with location
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(locationInsights.totalSpendingWithLocation, primaryCurrency)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {Math.round((locationInsights.transactionsWithLocation / Math.max(1, locationInsights.totalTransactions)) * 100)}% of transactions have location data
              </div>
            </div>
          )}
          
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
        )}
        
        {/* Trip Details Sidebar */}
        {viewMode === 'trips' && selectedTrip && (
          <div className="w-96 hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedTrip.name}</h3>
                <button
                  onClick={() => setSelectedTrip(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {selectedTrip.city}{selectedTrip.country ? `, ${selectedTrip.country}` : ''}
              </div>
            </div>
            
            {/* Trip Summary */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Spent</div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(selectedTrip.totalAmount, primaryCurrency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Duration</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedTrip.durationDays} day{selectedTrip.durationDays !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {new Date(selectedTrip.startDate).toLocaleDateString()} - {new Date(selectedTrip.endDate).toLocaleDateString()}
              </div>
            </div>
            
            {/* Category Breakdown */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Spending by Category</h4>
              <div className="space-y-2">
                {selectedTrip.categoryBreakdown.slice(0, 5).map(cat => (
                  <div key={cat.labelId} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.labelColor || '#6B7280' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {cat.labelName}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 ml-2">
                          {formatCurrency(cat.amount, primaryCurrency)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.labelColor || '#6B7280',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Daily Breakdown */}
            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Daily Spending</h4>
              <div className="space-y-2">
                {selectedTrip.dailyBreakdown.map(day => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-750 rounded-lg"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{day.dayName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(day.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(day.amount, primaryCurrency)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {day.transactionCount} txn{day.transactionCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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