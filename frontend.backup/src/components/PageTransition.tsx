import React, { ReactNode } from 'react';
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Page transition wrapper for native-like animations
 * Uses framer-motion for smooth page transitions
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{
          type: 'tween',
          ease: 'easeInOut',
          duration: 0.2,
        }}
      >
        <Box>{children}</Box>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Slide up transition for modals/bottom sheets
 */
export const SlideUpTransition: React.FC<{ children: ReactNode; show: boolean }> = ({
  children,
  show,
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 300,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Fade transition for overlays
 */
export const FadeTransition: React.FC<{ children: ReactNode; show: boolean }> = ({
  children,
  show,
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
