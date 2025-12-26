import '@mui/material/styles';

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

export {};
