/**
 * Get time-based greeting based on current hour
 */
export const getTimeBasedGreeting = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  } else if (hour >= 17 && hour < 22) {
    return 'Good evening';
  } else {
    return 'Good night';
  }
};

/**
 * Get emoji based on time of day
 */
export const getTimeEmoji = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return '🌅';
  } else if (hour >= 12 && hour < 17) {
    return '☀️';
  } else if (hour >= 17 && hour < 22) {
    return '🌆';
  } else {
    return '🌙';
  }
};

/**
 * Format current month and year
 */
export const getCurrentMonthYear = (): string => {
  const now = new Date();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
};
