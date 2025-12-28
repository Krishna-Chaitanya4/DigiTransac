import React from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { styled } from '@mui/material/styles';
import { Dayjs } from 'dayjs';

// Styled DatePicker with modern theme
const StyledDatePicker = styled(DatePicker)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: '0 4px 12px rgba(20, 184, 166, 0.15)',
    },
    '&.Mui-focused': {
      boxShadow: '0 4px 16px rgba(20, 184, 166, 0.25)',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
        borderWidth: 2,
      },
    },
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: theme.palette.primary.main,
  },
})) as typeof DatePicker;

interface ModernDatePickerProps {
  label?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
  format?: string;
  value?: Dayjs | null;
  onChange?: (value: Dayjs | null) => void;
  maxDate?: Dayjs;
  minDate?: Dayjs;
}

export const ModernDatePicker: React.FC<ModernDatePickerProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  required = false,
  format = 'DD/MM/YYYY',
  ...props
}) => {
  return (
    <StyledDatePicker
      {...props}
      label={label}
      format={format}
      slotProps={{
        textField: {
          error,
          helperText,
          fullWidth,
          required,
        },
        popper: {
          sx: {
            '& .MuiPaper-root': {
              borderRadius: 3,
              boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              mt: 1,
            },
            '& .MuiPickersCalendarHeader-root': {
              paddingTop: 2,
              paddingBottom: 1,
            },
            '& .MuiPickersCalendarHeader-label': {
              fontWeight: 600,
              fontSize: '1rem',
            },
            '& .MuiPickersDay-root': {
              borderRadius: 2,
              fontWeight: 500,
              '&:hover': {
                backgroundColor: 'rgba(20, 184, 166, 0.08)',
              },
              '&.Mui-selected': {
                background: (theme) => theme.palette.gradient?.primary || 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                color: 'white',
                fontWeight: 700,
                '&:hover': {
                  background: (theme) => theme.palette.gradient?.primary || 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                  opacity: 0.9,
                },
              },
              '&.MuiPickersDay-today': {
                border: '2px solid',
                borderColor: 'primary.main',
                backgroundColor: 'transparent',
                '&:not(.Mui-selected)': {
                  color: 'primary.main',
                  fontWeight: 600,
                },
              },
            },
            '& .MuiPickersYear-yearButton': {
              borderRadius: 2,
              '&.Mui-selected': {
                background: (theme) => theme.palette.gradient?.primary || 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                color: 'white',
                fontWeight: 700,
              },
            },
            '& .MuiPickersMonth-monthButton': {
              borderRadius: 2,
              '&.Mui-selected': {
                background: (theme) => theme.palette.gradient?.primary || 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                color: 'white',
                fontWeight: 700,
              },
            },
            '& .MuiDialogActions-root .MuiButton-root': {
              borderRadius: 2,
              fontWeight: 600,
              textTransform: 'none',
              '&.MuiButton-text': {
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(20, 184, 166, 0.08)',
                },
              },
            },
          },
        },
      }}
    />
  );
};

export default ModernDatePicker;
