import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeProvider as MUIThemeProvider, createTheme, Theme } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

// Extend MUI theme types
declare module '@mui/material/styles' {
  interface Palette {
    gradient: {
      primary: string;
      primaryReverse: string;
      success: string;
      error: string;
      info: string;
    };
  }
  interface PaletteOptions {
    gradient?: {
      primary?: string;
      primaryReverse?: string;
      success?: string;
      error?: string;
      info?: string;
    };
  }
  interface PaletteColor {
    lighter?: string;
  }
  interface SimplePaletteColorOptions {
    lighter?: string;
  }
}

interface ThemeContextType {
  mode: PaletteMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<PaletteMode>(() => {
    const savedMode = localStorage.getItem('theme-mode');
    return (savedMode as PaletteMode) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme: Theme = createTheme({
    palette: {
      mode,
      primary: {
        main: '#14b8a6', // Teal - your brand color
        light: '#06b6d4', // Cyan - lighter variant
        dark: '#0891b2', // Dark cyan
        lighter: '#5eead4', // Extra light for hover states
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#8b5cf6', // Purple accent
        light: '#a78bfa',
        dark: '#7c3aed',
        lighter: '#c4b5fd',
      },
      success: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669',
      },
      error: {
        main: '#ef4444',
        light: '#f87171',
        dark: '#dc2626',
      },
      warning: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
      },
      info: {
        main: '#3b82f6',
        light: '#60a5fa',
        dark: '#2563eb',
      },
      background: {
        default: mode === 'light' ? '#f5f5f5' : '#121212',
        paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
      },
      // Custom gradients for consistent use across the app
      gradient: {
        primary: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
        primaryReverse: 'linear-gradient(135deg, #06b6d4 0%, #14b8a6 100%)',
        success: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
        error: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
        info: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
      },
    },
    typography: {
      fontFamily: 'Roboto, sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 500,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 500,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 500,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 500,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 500,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: mode === 'light' ? '0 2px 8px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.3)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
    },
  });

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MUIThemeProvider theme={theme}>{children}</MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
