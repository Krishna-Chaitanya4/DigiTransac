import { useTheme, useMediaQuery } from '@mui/material';

/**
 * Custom hook for responsive design
 * Returns boolean flags for different device sizes
 */
export const useResponsive = () => {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600px - 900px
  const isDesktop = useMediaQuery(theme.breakpoints.up('md')); // >= 900px
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isMobileOrTablet: isMobile || isTablet,
  };
};

/**
 * Hook to detect if device supports touch
 */
export const useIsTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};
