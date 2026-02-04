/**
 * Lighthouse CI Configuration
 * 
 * This configuration file defines performance budgets and testing settings
 * for automated Lighthouse CI runs.
 * 
 * Run locally: npx lhci autorun
 * CI: Typically runs as part of GitHub Actions workflow
 */

module.exports = {
  ci: {
    collect: {
      // Number of runs per URL for statistical significance
      numberOfRuns: 3,
      
      // Start the dev server before running tests
      startServerCommand: 'npm run build && npm run preview',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
      
      // URLs to test
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/login',
        'http://localhost:4173/register',
      ],
      
      // Chrome flags for consistent testing
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless --disable-gpu',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        skipAudits: [
          'uses-http2', // Not applicable for local testing
          'is-on-https', // Local testing uses HTTP
        ],
      },
    },
    
    assert: {
      // Assertions for CI to pass/fail
      assertions: {
        // Performance metrics (scores 0-1)
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],
        'interactive': ['warn', { maxNumericValue: 3500 }],
        
        // Resource budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }], // 500KB JS
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }], // 100KB CSS
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }], // 500KB images
        'resource-summary:total:size': ['warn', { maxNumericValue: 2000000 }], // 2MB total
        
        // Accessibility audits (must pass)
        'aria-allowed-attr': 'error',
        'aria-hidden-body': 'error',
        'aria-hidden-focus': 'error',
        'aria-required-attr': 'error',
        'aria-valid-attr': 'error',
        'button-name': 'error',
        'color-contrast': 'warn',
        'document-title': 'error',
        'html-has-lang': 'error',
        'image-alt': 'error',
        'label': 'error',
        'link-name': 'error',
        'meta-viewport': 'error',
        
        // Best practices
        'errors-in-console': 'warn',
        'no-vulnerable-libraries': 'warn',
        'deprecations': 'warn',
        
        // PWA audits
        'service-worker': 'warn',
        'installable-manifest': 'warn',
        'themed-omnibox': 'off',
        'splash-screen': 'off',
      },
    },
    
    upload: {
      // Upload to temporary public storage (for CI)
      target: 'temporary-public-storage',
      
      // Or use LHCI server (uncomment to use)
      // target: 'lhci',
      // serverBaseUrl: process.env.LHCI_SERVER_URL,
      // token: process.env.LHCI_TOKEN,
    },
  },
};