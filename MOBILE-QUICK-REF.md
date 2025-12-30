# Mobile Development Quick Reference

## Responsive Breakpoints

```typescript
// Using MUI theme breakpoints
xs: 0px     // Phone
sm: 600px   // Tablet portrait
md: 900px   // Tablet landscape / Small desktop
lg: 1200px  // Desktop
xl: 1536px  // Large desktop

// Custom hook
const { isMobile, isTablet, isDesktop } = useResponsive();
```

## Touch Targets

```typescript
// Minimum sizes for interactive elements
Buttons:      44px × 44px (mobile), 48px × 48px (recommended)
Icon buttons: 48px × 48px
List items:   56px min height
FAB:          56px × 56px
```

## Common Patterns

### 1. Responsive Spacing
```typescript
sx={{
  p: { xs: 2, sm: 2.5, md: 3 },        // Padding
  m: { xs: 1, md: 2 },                  // Margin
  gap: { xs: 1, md: 2 },                // Gap in flex/grid
}}
```

### 2. Responsive Typography
```typescript
sx={{
  fontSize: { xs: '0.875rem', md: '1rem' },
  fontWeight: { xs: 500, md: 600 },
}}
```

### 3. Conditional Rendering
```typescript
// Show different content based on screen size
{isMobile ? <MobileView /> : <DesktopView />}

// Hide on mobile
sx={{ display: { xs: 'none', md: 'block' } }}

// Hide on desktop
sx={{ display: { xs: 'block', md: 'none' } }}
```

### 4. Mobile-Optimized Input
```typescript
import { getMobileNumberInputProps } from '@/utils/mobileHelpers';

<TextField
  {...getMobileNumberInputProps()}
  label="Amount"
  type="number"
/>
```

### 5. Haptic Feedback
```typescript
import { useHaptic } from '@/utils/haptics';

const { click, success, error } = useHaptic();

<Button onClick={() => {
  click();           // Light feedback
  handleAction();
  success();         // Success pattern
}}>
  Save
</Button>
```

### 6. Pull to Refresh
```typescript
<PullToRefresh onRefresh={async () => {
  await refetchData();
}}>
  {/* Your content */}
</PullToRefresh>
```

### 7. Responsive Dialog
```typescript
<ResponsiveDialog open={open} onClose={handleClose}>
  {/* Automatically fullscreen on mobile */}
</ResponsiveDialog>
```

### 8. Loading States
```typescript
<Loading message="Loading transactions..." fullScreen={false} />

// Or skeleton
<TableSkeleton rows={5} />
```

## CSS Tips

### 1. Safe Area Insets (Notches)
```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);
```

### 2. Prevent Scroll Bounce
```css
overscroll-behavior-y: contain;
```

### 3. Smooth Scrolling
```css
-webkit-overflow-scrolling: touch;
scroll-behavior: smooth;
```

### 4. Disable Text Selection (for UI elements)
```css
user-select: none;
-webkit-user-select: none;
```

### 5. Remove Tap Highlight
```css
-webkit-tap-highlight-color: transparent;
```

## Device Detection

```typescript
import { isMobileDevice, isPWA, isIOS, isAndroid } from '@/utils/mobileHelpers';

if (isMobileDevice()) {
  // Mobile-specific code
}

if (isPWA()) {
  // Running as installed app
}

if (isIOS()) {
  // iOS-specific adjustments
}

if (isAndroid()) {
  // Android-specific adjustments
}
```

## Performance

### 1. Lazy Loading
```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'));

<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

### 2. Memoization
```typescript
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

### 3. Virtual Lists (for long lists)
```typescript
// Use react-window or react-virtual for lists > 100 items
import { FixedSizeList } from 'react-window';
```

## Accessibility

### 1. ARIA Labels
```typescript
<IconButton aria-label="Add transaction">
  <AddIcon />
</IconButton>
```

### 2. Keyboard Navigation
```typescript
<Box tabIndex={0} role="button" onKeyPress={handleKeyPress}>
  Clickable Element
</Box>
```

### 3. Focus Management
```typescript
const buttonRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  buttonRef.current?.focus();
}, []);
```

## Testing Checklist

- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Portrait orientation
- [ ] Landscape orientation
- [ ] Slow 3G network
- [ ] Offline mode
- [ ] Touch interactions (tap, swipe, long-press)
- [ ] Input zoom behavior (iOS)
- [ ] Safe area insets (notched devices)
- [ ] Bottom navigation visibility
- [ ] PWA installation
- [ ] App shortcuts
- [ ] Service worker caching

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| iOS input zoom | Set font-size >= 16px |
| Content behind nav | Add padding-bottom: 80px |
| Scroll not smooth | Add -webkit-overflow-scrolling: touch |
| Click delay | Add touch-action: manipulation |
| Text too small | Use responsive typography |
| Buttons too small | Min 44px × 44px |
| Keyboard covers input | Use ScrollIntoView API |
| Pull-to-refresh conflicts | Set overscroll-behavior |

## Useful Links

- [MUI Responsive Design](https://mui.com/material-ui/guides/responsive-design/)
- [CSS Units Cheat Sheet](https://web.dev/learn/design/sizing/)
- [Touch Target Sizes](https://web.dev/accessible-tap-targets/)
- [PWA Checklist](https://web.dev/pwa-checklist/)

## Git Branch

```bash
# Current feature branch
git checkout feature/mobile-pwa-optimization

# View changes
git log --oneline

# Commits made:
# - feat(mobile): enhance PWA manifest, service worker, and mobile CSS
# - feat(mobile): enhance touch interactions and responsive components
# - feat(mobile): add mobile utilities and enhance components
```
