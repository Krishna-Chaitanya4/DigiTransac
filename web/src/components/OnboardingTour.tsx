/**
 * Onboarding Tour Component
 * 
 * A step-by-step guide for first-time users to learn the app's features.
 * Uses local storage to track completion and only shows once.
 */

import { useState, useEffect, useCallback } from 'react';

interface TourStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  emoji?: string;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to DigiTransac! 🎉',
    content: 'Let\'s take a quick tour to help you get started with managing your finances.',
    position: 'center',
    emoji: '👋',
  },
  {
    id: 'transactions',
    title: 'Track Transactions',
    content: 'Record your income and expenses easily. Tap the + button to add a new transaction.',
    target: '[data-tour="add-transaction"]',
    position: 'bottom',
    emoji: '💰',
  },
  {
    id: 'accounts',
    title: 'Manage Accounts',
    content: 'Connect multiple accounts - bank accounts, credit cards, and cash. Keep everything organized.',
    target: '[data-tour="accounts"]',
    position: 'bottom',
    emoji: '🏦',
  },
  {
    id: 'budgets',
    title: 'Set Budgets',
    content: 'Create budgets for different categories and track your spending against them.',
    target: '[data-tour="budgets"]',
    position: 'bottom',
    emoji: '📊',
  },
  {
    id: 'insights',
    title: 'Get Insights',
    content: 'View charts and analytics to understand your spending patterns and make better decisions.',
    target: '[data-tour="insights"]',
    position: 'bottom',
    emoji: '📈',
  },
  {
    id: 'spending-map',
    title: 'Spending Map',
    content: 'See where you spend money on an interactive map. Great for tracking location-based expenses.',
    target: '[data-tour="map"]',
    position: 'bottom',
    emoji: '🗺️',
  },
  {
    id: 'keyboard',
    title: 'Keyboard Shortcuts',
    content: 'Power user? Press ? anytime to see all available keyboard shortcuts.',
    position: 'center',
    emoji: '⌨️',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    content: 'Start tracking your finances today. You can always access settings to customize your experience.',
    position: 'center',
    emoji: '🚀',
  },
];

const TOUR_STORAGE_KEY = 'digitransac_tour_completed';
const TOUR_VERSION = '1'; // Increment to show tour again after major updates

interface OnboardingTourProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function OnboardingTour({ onComplete, forceShow = false }: OnboardingTourProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const currentTourStep = tourSteps[currentStep];

  // Check if tour should be shown
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed || completed !== TOUR_VERSION) {
      // Delay showing tour to let the app render first
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  // Update highlight position when step changes
  useEffect(() => {
    if (!currentTourStep.target) {
      setHighlightRect(null);
      return;
    }

    const element = document.querySelector(currentTourStep.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setHighlightRect(rect);
    } else {
      setHighlightRect(null);
    }
  }, [currentStep, currentTourStep.target]);

  const handleNext = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, TOUR_VERSION);
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleNext, handlePrevious, handleSkip]);

  if (!isVisible) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  // Calculate tooltip position
  const getTooltipStyles = () => {
    if (currentTourStep.position === 'center' || !highlightRect) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    switch (currentTourStep.position) {
      case 'bottom':
        return {
          position: 'fixed' as const,
          top: highlightRect.bottom + padding,
          left: highlightRect.left + highlightRect.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'top':
        return {
          position: 'fixed' as const,
          bottom: window.innerHeight - highlightRect.top + padding,
          left: highlightRect.left + highlightRect.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          position: 'fixed' as const,
          top: highlightRect.top + highlightRect.height / 2,
          right: window.innerWidth - highlightRect.left + padding,
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          position: 'fixed' as const,
          top: highlightRect.top + highlightRect.height / 2,
          left: highlightRect.right + padding,
          transform: 'translateY(-50%)',
        };
      default:
        return {};
    }
  };

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 transition-opacity" />

      {/* Highlight cutout */}
      {highlightRect && (
        <div
          className="fixed border-4 border-blue-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none transition-all duration-300"
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 z-[101]"
        style={getTooltipStyles()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-t-xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          {currentTourStep.emoji && (
            <span className="text-4xl mb-3 block">{currentTourStep.emoji}</span>
          )}
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {currentTourStep.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {currentTourStep.content}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  onClick={handlePrevious}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                >
                  ← Back
                </button>
              )}
              {!isLastStep && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Skip tour
                </button>
              )}
            </div>

            <button
              onClick={handleNext}
              className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              {isLastStep ? 'Get Started' : 'Next →'}
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex justify-center gap-1.5 mt-4">
            {tourSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-blue-500 w-6'
                    : index < currentStep
                    ? 'bg-blue-300 dark:bg-blue-700'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage onboarding tour state
 */
export function useOnboardingTour() {
  const [showTour, setShowTour] = useState(false);

  const startTour = () => setShowTour(true);
  const endTour = () => setShowTour(false);

  const resetTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setShowTour(true);
  };

  const hasCompletedTour = () => {
    return localStorage.getItem(TOUR_STORAGE_KEY) === TOUR_VERSION;
  };

  return {
    showTour,
    startTour,
    endTour,
    resetTour,
    hasCompletedTour,
  };
}

/**
 * Helper to add tour target to an element
 */
export function tourTarget(id: string) {
  return { 'data-tour': id };
}