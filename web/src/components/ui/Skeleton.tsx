import { memo } from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Skeleton loading component for creating loading placeholders
 */
export const Skeleton = memo(function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg',
  };
  
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  
  return (
    <div
      className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
});

// Pre-built skeleton patterns

/**
 * Skeleton for a map container
 */
export const MapSkeleton = memo(function MapSkeleton() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden relative">
      {/* Map placeholder with grid pattern */}
      <div className="absolute inset-0 opacity-50">
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-px bg-gray-300 dark:bg-gray-600">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
      
      {/* Loading spinner */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading map...</div>
      </div>
      
      {/* Fake markers */}
      <div className="absolute top-1/4 left-1/3 w-4 h-4 rounded-full bg-blue-400/30 animate-pulse"></div>
      <div className="absolute top-1/2 left-1/2 w-6 h-6 rounded-full bg-green-400/30 animate-pulse"></div>
      <div className="absolute bottom-1/3 right-1/4 w-5 h-5 rounded-full bg-orange-400/30 animate-pulse"></div>
    </div>
  );
});

/**
 * Skeleton for a chat message
 */
export const ChatMessageSkeleton = memo(function ChatMessageSkeleton({ isFromMe = false }: { isFromMe?: boolean }) {
  // Use static width to avoid Math.random() during render (impure function)
  const width = isFromMe ? 150 : 180;
  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-xs ${isFromMe ? 'items-end' : 'items-start'}`}>
        <Skeleton
          variant="rounded"
          className={`${isFromMe ? 'bg-blue-300 dark:bg-blue-700' : 'bg-gray-200 dark:bg-gray-700'}`}
          width={width}
          height={40}
        />
        <Skeleton variant="text" className="mt-1" width={60} height={12} />
      </div>
    </div>
  );
});

/**
 * Skeleton for chat message list
 */
export const ChatMessageListSkeleton = memo(function ChatMessageListSkeleton() {
  const messages = [
    { isFromMe: false, id: 1 },
    { isFromMe: true, id: 2 },
    { isFromMe: false, id: 3 },
    { isFromMe: false, id: 4 },
    { isFromMe: true, id: 5 },
    { isFromMe: true, id: 6 },
    { isFromMe: false, id: 7 },
  ];
  
  return (
    <div className="flex flex-col p-4 space-y-2">
      {messages.map((msg) => (
        <ChatMessageSkeleton key={msg.id} isFromMe={msg.isFromMe} />
      ))}
    </div>
  );
});

/**
 * Skeleton for a transaction card in chat
 */
export const TransactionCardSkeleton = memo(function TransactionCardSkeleton({ isFromMe = true }: { isFromMe?: boolean }) {
  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="min-w-[130px] max-w-[190px] rounded-xl p-3 bg-gray-200 dark:bg-gray-700 animate-pulse">
        {/* Status badge placeholder */}
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Skeleton variant="rounded" width={60} height={18} className="bg-gray-300 dark:bg-gray-600" />
        </div>
        
        {/* Title placeholder */}
        <Skeleton variant="text" className="mx-auto mb-2 bg-gray-300 dark:bg-gray-600" width={80} height={14} />
        
        {/* Amount placeholder */}
        <div className="text-center">
          <Skeleton variant="text" className="mx-auto bg-gray-300 dark:bg-gray-600" width={100} height={24} />
          <Skeleton variant="text" className="mx-auto mt-1 bg-gray-300 dark:bg-gray-600" width={60} height={12} />
        </div>
        
        {/* Time placeholder */}
        <Skeleton variant="text" className="ml-auto mt-1.5 bg-gray-300 dark:bg-gray-600" width={40} height={10} />
      </div>
    </div>
  );
});

/**
 * Skeleton for a trip card
 */
export const TripCardSkeleton = memo(function TripCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width={40} height={40} />
          <div>
            <Skeleton variant="text" width={120} height={18} />
            <Skeleton variant="text" width={80} height={14} className="mt-1" />
          </div>
        </div>
        <div className="text-right">
          <Skeleton variant="text" width={80} height={22} />
          <Skeleton variant="text" width={50} height={14} className="mt-1 ml-auto" />
        </div>
      </div>
      
      {/* Duration */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton variant="rectangular" width={16} height={16} />
        <Skeleton variant="text" width={150} height={14} />
      </div>
      
      {/* Category pills */}
      <div className="flex flex-wrap gap-1">
        <Skeleton variant="rounded" width={60} height={20} />
        <Skeleton variant="rounded" width={70} height={20} />
        <Skeleton variant="rounded" width={50} height={20} />
      </div>
    </div>
  );
});

/**
 * Skeleton for trip list
 */
export const TripListSkeleton = memo(function TripListSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  );
});

/**
 * Skeleton for location list sidebar
 */
export const LocationListSkeleton = memo(function LocationListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <Skeleton variant="circular" width={32} height={32} />
            <div className="flex-1">
              <Skeleton variant="text" width="70%" height={16} />
              <div className="flex items-center justify-between mt-1">
                <Skeleton variant="text" width={60} height={14} />
                <Skeleton variant="text" width={40} height={12} />
              </div>
              <Skeleton variant="rounded" className="mt-1" width={60} height={16} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

/**
 * Skeleton for stats bar
 */
export const StatsBarSkeleton = memo(function StatsBarSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <Skeleton variant="text" width={80} height={12} />
          <Skeleton variant="text" className="mt-2" width={60} height={24} />
        </div>
      ))}
    </div>
  );
});

/**
 * Skeleton for conversation list item
 */
export const ConversationListItemSkeleton = memo(function ConversationListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width={120} height={16} />
          <Skeleton variant="text" width={50} height={12} />
        </div>
        <Skeleton variant="text" className="mt-1" width="80%" height={14} />
      </div>
    </div>
  );
});

/**
 * Skeleton for conversation list
 */
export const ConversationListSkeleton = memo(function ConversationListSkeleton() {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {Array.from({ length: 5 }).map((_, i) => (
        <ConversationListItemSkeleton key={i} />
      ))}
    </div>
  );
});

export default Skeleton;