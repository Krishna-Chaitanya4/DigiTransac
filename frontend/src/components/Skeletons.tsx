import React from 'react';
import { Box, Card, CardContent, Skeleton, Grid } from '@mui/material';

const DashboardCardSkeletonComponent: React.FC = () => {
  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        height: '100%',
      }}
    >
      <CardContent>
        <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
        <Skeleton
          variant="text"
          width="80%"
          height={40}
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', mt: 1 }}
        />
        <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(255,255,255,0.2)', mt: 1 }} />
      </CardContent>
    </Card>
  );
};

export const DashboardCardSkeleton = React.memo(DashboardCardSkeletonComponent);

const TransactionRowSkeletonComponent: React.FC = () => {
  return (
    <Box
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        py: { xs: 2.5, sm: 2 }, 
        px: { xs: 2, sm: 2 }, 
        borderBottom: '1px solid #eee' 
      }}
    >
      <Skeleton 
        variant="circular" 
        width={{ xs: 48, sm: 40 }} 
        height={{ xs: 48, sm: 40 }} 
        sx={{ mr: { xs: 2, sm: 2 } }} 
      />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="30%" sx={{ fontSize: { xs: '1rem', sm: '0.875rem' } }} />
        <Skeleton variant="text" width="50%" sx={{ mt: 0.5, fontSize: { xs: '0.875rem', sm: '0.75rem' } }} />
      </Box>
      <Skeleton variant="text" width="15%" sx={{ fontSize: { xs: '1rem', sm: '0.875rem' } }} />
    </Box>
  );
};

export const TransactionRowSkeleton = React.memo(TransactionRowSkeletonComponent);

const BudgetCardSkeletonComponent: React.FC = () => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="circular" width={32} height={32} />
        </Box>
        <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 1, mb: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="30%" />
        </Box>
      </CardContent>
    </Card>
  );
};

export const BudgetCardSkeleton = React.memo(BudgetCardSkeletonComponent);

const ChartSkeletonComponent: React.FC<{ height?: number }> = ({ height = 300 }) => {
  return (
    <Card>
      <CardContent>
        <Skeleton variant="text" width="40%" sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 1 }} />
      </CardContent>
    </Card>
  );
};

export const ChartSkeleton = React.memo(ChartSkeletonComponent);

const TableSkeletonComponent: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <Box>
      {Array.from({ length: rows }).map((_, index) => (
        <TransactionRowSkeleton key={index} />
      ))}
    </Box>
  );
};

export const TableSkeleton = React.memo(TableSkeletonComponent);

interface GridSkeletonProps {
  count?: number;
  component: React.ComponentType;
}

const GridSkeletonComponent: React.FC<GridSkeletonProps> = ({
  count = 4,
  component: Component,
}) => {
  return (
    <Grid container spacing={3}>
      {Array.from({ length: count }).map((_, index) => (
        <Grid size={{ sm: 6, xs: 12, md: 3 }} key={index}>
          <Component />
        </Grid>
      ))}
    </Grid>
  );
};

export const GridSkeleton = React.memo(GridSkeletonComponent);
