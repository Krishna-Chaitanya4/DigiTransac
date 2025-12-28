import React from 'react';
import { Box } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import TransactionCard from './TransactionCard';
import { useSwipe } from '../hooks/useSwipe';

interface SwipeableTransactionCardProps {
  transaction: any;
  onEdit: () => void;
  onDelete: () => void;
  formatCurrency: (amount: number) => string;
  getCategoryName: (id: string) => string;
  getCategoryColor: (id: string) => string;
  getAccountName: (id: string) => string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const SwipeableTransactionCard: React.FC<SwipeableTransactionCardProps> = (props) => {
  const { onEdit, onDelete } = props;

  const [swipeHandlers, { deltaX, isSwiping }] = useSwipe(
    () => onDelete(), // Swipe left to delete
    () => onEdit() // Swipe right to edit
  );

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        mb: 1,
      }}
    >
      {/* Background Actions */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
        }}
      >
        {/* Left action - Edit (visible when swiping right) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'primary.main',
            opacity: deltaX > 0 ? Math.min(deltaX / 80, 1) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s',
          }}
        >
          <EditIcon />
          <Box fontWeight="bold">Edit</Box>
        </Box>

        {/* Right action - Delete (visible when swiping left) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: 'error.main',
            opacity: deltaX < 0 ? Math.min(Math.abs(deltaX) / 80, 1) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s',
          }}
        >
          <Box fontWeight="bold">Delete</Box>
          <DeleteIcon />
        </Box>
      </Box>

      {/* Swipeable Card */}
      <Box
        {...swipeHandlers}
        sx={{
          transform: `translateX(${deltaX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          position: 'relative',
          zIndex: 1,
          touchAction: 'pan-y', // Allow vertical scrolling
        }}
      >
        <TransactionCard {...props} />
      </Box>
    </Box>
  );
};

export default React.memo(SwipeableTransactionCard);
