import React, { ReactElement } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';

interface ResponsiveChartProps {
  children: ReactElement;
  mobileHeight?: number;
  desktopHeight?: number;
}

/**
 * Wrapper for charts that adjusts size and configuration for mobile
 */
const ResponsiveChart: React.FC<ResponsiveChartProps> = ({
  children,
  mobileHeight = 250,
  desktopHeight = 350,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const height = isMobile ? mobileHeight : desktopHeight;

  // Clone the chart element and add responsive props
  const chartElement = React.cloneElement(children, {
    height,
    style: {
      fontSize: isMobile ? '11px' : '13px',
      ...(typeof children.props === 'object' && children.props !== null && 'style' in children.props 
        ? (children.props as any).style 
        : {}),
    },
  } as any);

  return (
    <Box
      sx={{
        width: '100%',
        height,
        '& .recharts-wrapper': {
          fontSize: isMobile ? '11px' : '13px',
        },
        '& .recharts-cartesian-axis-tick': {
          fontSize: isMobile ? '10px' : '12px',
        },
        '& .recharts-legend-wrapper': {
          fontSize: isMobile ? '11px' : '13px',
        },
        // Hide some elements on mobile for cleaner look
        ...(isMobile && {
          '& .recharts-cartesian-grid': {
            opacity: 0.3,
          },
        }),
      }}
    >
      {chartElement}
    </Box>
  );
};

export default ResponsiveChart;
