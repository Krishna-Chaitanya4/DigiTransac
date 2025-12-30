import React from 'react';
import { Fab, Tooltip, Zoom } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface QuickAddFabProps {
  onClick: () => void;
  tooltip?: string;
}

const QuickAddFab: React.FC<QuickAddFabProps> = ({ onClick, tooltip = 'Quick Add' }) => {
  const handleClick = () => {
    // Haptic feedback for mobile devices
    if ('vibrate' in navigator) {
      navigator.vibrate(10); // Short vibration
    }
    onClick();
  };

  return (
    <Zoom in={true} timeout={300}>
      <Tooltip title={tooltip} placement="left">
        <Fab
          color="primary"
          aria-label="add"
          onClick={handleClick}
          sx={{
            position: 'fixed',
            bottom: { xs: 80, sm: 24 },
            right: { xs: 16, sm: 24 },
            zIndex: 1000,
            boxShadow: 4,
            width: { xs: 56, sm: 56 },
            height: { xs: 56, sm: 56 },
            '&:hover': {
              transform: 'scale(1.1)',
              boxShadow: 6,
            },
            '&:active': {
              transform: 'scale(0.95)',
            },
            transition: 'all 0.2s ease-in-out',
            // Ensure it's above mobile bottom nav
            '@media (max-width:600px)': {
              bottom: 80,
            },
          }}
        >
          <AddIcon sx={{ fontSize: { xs: 28, sm: 24 } }} />
        </Fab>
      </Tooltip>
    </Zoom>
  );
};

export default React.memo(QuickAddFab);
