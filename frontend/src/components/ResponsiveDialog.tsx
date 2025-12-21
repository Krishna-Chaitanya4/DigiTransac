import React from 'react';
import { Dialog, DialogProps, Slide } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { useResponsive } from '../hooks/useResponsive';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
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
          ...(isMobile && {
            margin: 0,
            maxHeight: '100vh',
            borderRadius: 0,
          }),
        },
      }}
    >
      {children}
    </Dialog>
  );
};

export default ResponsiveDialog;
