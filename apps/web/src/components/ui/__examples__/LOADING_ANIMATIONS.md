# Loading Animations

Clean, subtle, Apple-level loading animations that match weatherB's UI/UX design system.

## Design Philosophy

These loading animations follow weatherB's aesthetic principles:
- **Clean & Minimal**: No unnecessary motion or distraction
- **Branded**: Uses weatherB's sky/sunset color palette
- **Subtle**: Gentle animations that feel premium
- **Accessible**: Respects `prefers-reduced-motion`

## Components

### 1. LoadingSpinner

Main loading indicator with animated gradient stroke.

```tsx
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Basic usage
<LoadingSpinner />

// With size and variant
<LoadingSpinner size="lg" variant="sunset" label="Loading market data" />
```

**Props:**
- `size?: 'sm' | 'md' | 'lg'` - Default: `'md'`
- `variant?: 'default' | 'sunset' | 'sky' | 'minimal'` - Default: `'default'`
- `label?: string` - Optional loading text
- `className?: string` - Additional CSS classes

**Variants:**
- `default` - Sky blue gradient (primary brand colors)
- `sunset` - Sunset pink/orange gradient (warm CTAs)
- `sky` - Pure sky blue gradient (cool actions)
- `minimal` - Neutral gray gradient (subtle states)

---

### 2. LoadingDots

Pulsing dot animation for inline loading states.

```tsx
import { LoadingDots } from '@/components/ui/loading-spinner';

// Inline with text
<p>Fetching data <LoadingDots variant="sky" /></p>
```

**Props:**
- `variant?: 'default' | 'sunset' | 'sky' | 'minimal'`
- `className?: string`

**Best for:**
- Inline text loading
- Compact spaces
- Minimal visual impact

---

### 3. LoadingSkeleton

Shimmer animation that mimics content shape.

```tsx
import { LoadingSkeleton } from '@/components/ui/loading-spinner';

// Multiple skeletons for card content
<div className="space-y-3">
  <LoadingSkeleton variant="default" />
  <LoadingSkeleton variant="text" />
  <LoadingSkeleton variant="text" className="w-2/3" />
</div>
```

**Props:**
- `variant?: 'default' | 'card' | 'text'`
- `className?: string`

**Best for:**
- Content placeholders
- Card loading states
- List items

---

### 4. LoadingOverlay

Full-page loading overlay for global states.

```tsx
import { LoadingOverlay } from '@/components/ui/loading-spinner';

const [isLoading, setIsLoading] = useState(false);

<LoadingOverlay
  isLoading={isLoading}
  label="Processing transaction"
  variant="sunset"
/>
```

**Props:**
- `isLoading: boolean` - Show/hide overlay
- `label?: string` - Loading message
- `variant?: 'default' | 'sunset' | 'sky' | 'minimal'`

**Best for:**
- Form submissions
- Transaction processing
- Page transitions

---

### 5. InlineLoader

Compact spinner for buttons and small UI elements.

```tsx
import { InlineLoader } from '@/components/ui/loading-spinner';

<button className="btn-primary" disabled>
  <InlineLoader variant="minimal" size="sm" />
  Processing
</button>
```

**Props:**
- `variant?: 'default' | 'sunset' | 'sky' | 'minimal'`
- `size?: 'sm' | 'md'`

**Best for:**
- Button loading states
- Icon replacements
- Inline indicators

---

## Usage Examples

### Modal Loading State

```tsx
{isLoading && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
    <motion.div className="relative z-10 bg-white/95 backdrop-blur-xl rounded-2xl px-8 py-10 shadow-glass-lg border border-white/50">
      <LoadingSpinner size="lg" variant="default" label="Loading market data" />
    </motion.div>
  </div>
)}
```

### Button States

```tsx
// Primary action (warm)
<button className="btn-primary" disabled={isLoading}>
  {isLoading ? (
    <>
      <InlineLoader variant="minimal" size="sm" />
      Processing
    </>
  ) : (
    'Submit Bet'
  )}
</button>

// Secondary action (cool)
<button className="btn-secondary" disabled={isLoading}>
  {isLoading ? (
    <>
      <InlineLoader variant="sky" size="sm" />
      Loading
    </>
  ) : (
    'View Details'
  )}
</button>
```

### Card Content

```tsx
{isLoading ? (
  <div className="card space-y-3">
    <LoadingSkeleton variant="card" />
    <LoadingSkeleton variant="default" />
    <LoadingSkeleton variant="text" className="w-3/4" />
  </div>
) : (
  <div className="card">
    {/* Actual content */}
  </div>
)}
```

### Inline Text

```tsx
<p className="text-neutral-600">
  Fetching latest market data
  <LoadingDots variant="sky" className="ml-1 inline-flex" />
</p>
```

---

## Variant Selection Guide

| Context | Recommended Variant | Reasoning |
|---------|-------------------|-----------|
| Primary action (bet, submit) | `sunset` | Matches warm CTA colors |
| Data fetching | `default` | Neutral, brand-aligned |
| Cool actions (view, cancel) | `sky` | Matches secondary UI |
| Subtle states (inline, buttons) | `minimal` | Low visual weight |

---

## Accessibility

All loading animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Users with motion sensitivity will see static or minimal animation.

---

## Performance

- **SVG-based spinners**: Hardware-accelerated, minimal CPU
- **CSS animations**: Optimized for 60fps
- **Conditional rendering**: Components unmount when not needed
- **Gradient caching**: Reused across instances

---

## Examples Page

View all loading animations in action:

```bash
# Create a temporary page to view examples
# Add to apps/web/src/app/examples/loading/page.tsx
```

```tsx
import { LoadingExamples } from '@/components/ui/__examples__/loading-examples';

export default function LoadingExamplesPage() {
  return <LoadingExamples />;
}
```

Visit `/examples/loading` to see all variants and sizes.

---

## Migration from Old Loading States

### Before (generic spinner):
```tsx
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" />
```

### After (branded spinner):
```tsx
<LoadingSpinner size="lg" variant="default" label="Loading" />
```

### Benefits:
✅ On-brand colors and gradients
✅ Smooth, Apple-quality animations
✅ Automatic accessibility support
✅ Consistent across the app
✅ Variant system for context

---

## Future Enhancements

Potential additions:
- [ ] Progress bar with percentage
- [ ] Circular progress indicator
- [ ] Weather-themed animations (clouds, sun)
- [ ] Custom SVG path animations
- [ ] Sound effects (optional)

---

**Questions or improvements?** Discuss in team review or update this doc.
