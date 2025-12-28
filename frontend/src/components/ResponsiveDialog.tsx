import React from 'react';
import { Dialog, DialogProps, Slide } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { useResponsive } from '../hooks/useResponsive';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface ResponsiveDialogProps extends DialogProps {
  children: React.ReactNode;
}

/**
 * Responsive Dialog that becomes full-screen on mobile devices
 */
const ResponsiveDialog: React.FC<ResponsiveDialogProps> = ({ children, ...props }) => {
  const { isMobile } = useResponsive();

  return (
    <Dialog
      {...props}
      fullScreen={isMobile}
      TransitionComponent={isMobile ? Transition : undefined}
      PaperProps={{
        ...props.PaperProps,
        sx: {
          ...(props.PaperProps?.sx || {}),
          ...(isMobile ? {
            margin: 0,
            maxHeight: '100vh',
            borderRadius: 0,
          } : {
            borderRadius: 4,
            background: (theme) =>
              theme.palette.mode === 'light'
                ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                : 'linear-gradient(135deg, rgba(30, 30, 30, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%)',
            backdropFilter: 'blur(20px)',
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? '0 24px 48px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)'
                : '0 24px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(20, 184, 166, 0.2)',
          }),
        },
      }}
      sx={{
        ...props.sx,
        '& .MuiBackdrop-root': {
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
      }}
    >
      {children}
    </Dialog>
  );
};

export default React.memo(ResponsiveDialog);
