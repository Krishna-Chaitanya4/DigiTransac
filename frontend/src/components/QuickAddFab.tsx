import React from 'react';
import { Fab, Tooltip, Zoom } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface QuickAddFabProps {
  onClick: () => void;
  tooltip?: string;
}

const QuickAddFab: React.FC<QuickAddFabProps> = ({ onClick, tooltip = 'Quick Add' }) => {
  return (
    <Zoom in={true} timeout={300}>
      <Tooltip title={tooltip} placement="left">
        <Fab
          color="primary"
          aria-label="add"
          onClick={onClick}
          sx={{
            position: 'fixed',
            bottom: { xs: 70, sm: 24 },
            right: { xs: 16, sm: 24 },
            zIndex: 1000,
            boxShadow: 4,
            '&:hover': {
              transform: 'scale(1.1)',
              boxShadow: 6,
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          <AddIcon />
        </Fab>
      </Tooltip>
    </Zoom>
  );
};

export default React.memo(QuickAddFab);
