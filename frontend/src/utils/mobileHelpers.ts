/**
 * Mobile-optimized input utilities and components
 * Provides helpers for creating touch-friendly form inputs
 */

import { TextFieldProps } from '@mui/material';

/**
 * Get mobile-optimized input props to prevent zoom on iOS
 */
export const getMobileInputProps = (): Partial<TextFieldProps> => {
  return {
    inputProps: {
      style: {
        fontSize: '16px', // Prevents iOS from zooming on focus
      },
    },
    InputLabelProps: {
      style: {
        fontSize: '16px',
      },
    },
  };
};

/**
 * Get number input props for mobile devices
 */
export const getMobileNumberInputProps = (): Partial<TextFieldProps> => {
  return {
    ...getMobileInputProps(),
    inputProps: {
      ...getMobileInputProps().inputProps,
      inputMode: 'decimal' as const,
      pattern: '[0-9]*',
    },
  };
};

/**
 * Get email input props for mobile devices
 */
export const getMobileEmailInputProps = (): Partial<TextFieldProps> => {
  return {
    ...getMobileInputProps(),
    inputProps: {
      ...getMobileInputProps().inputProps,
      inputMode: 'email' as const,
      autoCapitalize: 'off',
      autoCorrect: 'off',
    },
  };
};

/**
 * Get phone input props for mobile devices
 */
export const getMobilePhoneInputProps = (): Partial<TextFieldProps> => {
  return {
    ...getMobileInputProps(),
    inputProps: {
      ...getMobileInputProps().inputProps,
      inputMode: 'tel' as const,
      pattern: '[0-9]*',
    },
  };
};

/**
 * Get URL input props for mobile devices
 */
export const getMobileUrlInputProps = (): Partial<TextFieldProps> => {
  return {
    ...getMobileInputProps(),
    inputProps: {
      ...getMobileInputProps().inputProps,
      inputMode: 'url' as const,
      autoCapitalize: 'off',
      autoCorrect: 'off',
    },
  };
};

/**
 * Get search input props for mobile devices
 */
export const getMobileSearchInputProps = (): Partial<TextFieldProps> => {
  return {
    ...getMobileInputProps(),
    inputProps: {
      ...getMobileInputProps().inputProps,
      inputMode: 'search' as const,
    },
  };
};

/**
 * Detect if running on iOS
 */
export const isIOS = (): boolean => {
  return (
    (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

/**
 * Detect if running on Android
 */
export const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

/**
 * Detect if running on a mobile device
 */
export const isMobileDevice = (): boolean => {
  return isIOS() || isAndroid() || /Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Detect if running as a PWA
 */
export const isPWA = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');
};

/**
 * Get safe area insets for devices with notches
 */
export const getSafeAreaInsets = () => {
  const style = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(style.getPropertyValue('--sai-top') || '0'),
    right: parseInt(style.getPropertyValue('--sai-right') || '0'),
    bottom: parseInt(style.getPropertyValue('--sai-bottom') || '0'),
    left: parseInt(style.getPropertyValue('--sai-left') || '0'),
  };
};

/**
 * Request fullscreen mode (useful for immersive mobile experiences)
 */
export const requestFullscreen = async (): Promise<void> => {
  try {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      await elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) {
      await (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).msRequestFullscreen) {
      await (elem as any).msRequestFullscreen();
    }
  } catch (error) {
    console.debug('Fullscreen not supported or denied:', error);
  }
};

/**
 * Exit fullscreen mode
 */
export const exitFullscreen = async (): Promise<void> => {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      await (document as any).msExitFullscreen();
    }
  } catch (error) {
    console.debug('Exit fullscreen not supported or denied:', error);
  }
};

/**
 * Check if device is in landscape mode
 */
export const isLandscape = (): boolean => {
  return window.innerWidth > window.innerHeight;
};

/**
 * Check if device is in portrait mode
 */
export const isPortrait = (): boolean => {
  return window.innerWidth <= window.innerHeight;
};

/**
 * Get device pixel ratio (for high-DPI displays)
 */
export const getDevicePixelRatio = (): number => {
  return window.devicePixelRatio || 1;
};

/**
 * Prevent body scroll (useful for modals on mobile)
 */
export const preventBodyScroll = (): void => {
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
};

/**
 * Allow body scroll
 */
export const allowBodyScroll = (): void => {
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';
};
