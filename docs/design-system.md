# WeatherB Design System: "Nostalgic Futurism"

> **Visual Identity:** Light, airy, minimal interfaces with rich textures that feel both vintage and futuristic — inspired by sky gradients, ethereal particles, and reflective surfaces.

---

## Design Philosophy

WeatherB's UI should evoke:
- **Dreamlike serenity** — Like floating through clouds
- **Nostalgic warmth** — Retro film grain meets modern digital
- **Playful optimism** — Betting on weather should feel fun, not stressful
- **Technical confidence** — Clean, precise, trustworthy

### Not This:
- ❌ Casino-style flashy colors
- ❌ Dark mode dystopia
- ❌ Heavy, cluttered interfaces
- ❌ Generic corporate blue

### Yes This:
- ✅ Sky gradients (bright blue → soft pink/orange)
- ✅ Ethereal particle effects (sparkles, floating dust)
- ✅ Glass morphism (frosted glass with backdrop blur)
- ✅ Generous whitespace
- ✅ Subtle textures (film grain, soft noise)

---

## Color Palette

### Primary Colors

```css
/* Sky Blues */
--sky-light: #87CEEB;      /* Light sky blue */
--sky-medium: #5BA5E5;     /* Medium sky blue */
--sky-deep: #4A90D9;       /* Deeper sky blue */

/* Cloud Whites */
--cloud-white: #FFFFFF;    /* Pure white */
--cloud-off: #F8FBFF;      /* Slightly blue-tinted white */
--cloud-soft: #F0F4F8;     /* Soft gray-blue */
```

### Accent Colors

```css
/* Sunset Tones (for CTAs and highlights) */
--sunset-orange: #FFB347;  /* Warm orange */
--sunset-pink: #FF9AB3;    /* Soft pink */
--sunset-coral: #FF8C94;   /* Coral accent */

/* Success/Error (subtle, not harsh) */
--success-soft: #A8E6CF;   /* Soft mint green */
--error-soft: #FFB3B3;     /* Soft coral red */
```

### Neutrals

```css
/* Grays with Warmth */
--neutral-100: #FAFBFC;    /* Almost white */
--neutral-200: #E8ECEF;    /* Light gray */
--neutral-400: #B0B8C0;    /* Medium gray */
--neutral-600: #6B7280;    /* Dark gray */
--neutral-800: #374151;    /* Charcoal */
```

---

## Typography

### Font Stack

```css
/* Primary: System fonts for performance */
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;

/* Monospace: For numbers/data */
--font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono",
             Consolas, monospace;
```

### Type Scale

```css
/* Headings */
--text-4xl: 3.5rem;    /* 56px - Hero text */
--text-3xl: 2.5rem;    /* 40px - Page titles */
--text-2xl: 2rem;      /* 32px - Section headers */
--text-xl: 1.5rem;     /* 24px - Card titles */

/* Body */
--text-lg: 1.125rem;   /* 18px - Large body */
--text-base: 1rem;     /* 16px - Default */
--text-sm: 0.875rem;   /* 14px - Small text */
--text-xs: 0.75rem;    /* 12px - Captions */
```

### Text Styles

- **Headings:** Bold weight (700), generous letter-spacing (-0.02em)
- **Body:** Regular weight (400), comfortable line-height (1.6)
- **Numbers/Data:** Monospace, medium weight (500), tabular numerals
- **Captions:** Light weight (300), uppercase with wide letter-spacing (0.05em)

### Texture Overlays (Optional)

For hero text or special headers, apply subtle texture:
```css
.text-textured {
  background: linear-gradient(135deg, var(--sky-medium), var(--sunset-pink));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  position: relative;
}

.text-textured::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url('/textures/film-grain.png');
  opacity: 0.1;
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

---

## Spacing System

```css
/* 4px base unit */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-24: 6rem;     /* 96px */
```

**Philosophy:** Be generous. Use `--space-8` or larger for section padding. Avoid cramped layouts.

---

## Effects & Textures

### 1. Glass Morphism (Frosted Glass)

```css
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* Liquid glass variant (with gradient edge) */
.liquid-glass {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.8),
    rgba(248, 251, 255, 0.6)
  );
  backdrop-filter: blur(16px) saturate(200%);
  border: 1px solid rgba(91, 165, 229, 0.2);
}
```

### 2. Film Grain / Noise Overlay

```css
.grain-overlay {
  position: relative;
}

.grain-overlay::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url('/textures/film-grain.png'); /* Midjourney asset */
  opacity: 0.03;
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

**Note:** Film grain texture should be 512x512px seamless tile generated in Midjourney.

### 3. Sky Gradients

```css
/* Vertical gradient (top = sky, bottom = horizon) */
.gradient-sky-vertical {
  background: linear-gradient(
    180deg,
    #5BA5E5 0%,    /* Sky blue */
    #87CEEB 40%,   /* Light blue */
    #FFB347 80%,   /* Sunset orange */
    #FF9AB3 100%   /* Sunset pink */
  );
}

/* Horizontal gradient (for hero sections) */
.gradient-sky-horizontal {
  background: linear-gradient(
    90deg,
    #87CEEB 0%,
    #F8FBFF 50%,
    #FFB347 100%
  );
}

/* Radial gradient (spotlight effect) */
.gradient-spotlight {
  background: radial-gradient(
    circle at 50% 20%,
    rgba(255, 179, 71, 0.3),
    rgba(91, 165, 229, 0.1),
    transparent 70%
  );
}
```

### 4. Particle Effects

Use **Framer Motion** for animated particles on hover/interaction:

```tsx
// Example: Floating sparkles on card hover
<motion.div
  whileHover={{
    scale: 1.02,
    transition: { duration: 0.2 }
  }}
>
  <ParticleSystem
    count={8}
    color="rgba(255, 179, 71, 0.6)"
    type="sparkle"
  />
</motion.div>
```

**Particle Types:**
- `sparkle` — Small twinkling stars (inspired by reference image #1)
- `float` — Soft floating orbs
- `flow` — Directional particles (for odds visualization)

---

## Component Patterns

### Cards

```css
.card {
  background: var(--cloud-off);
  border-radius: 16px;
  padding: var(--space-6);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.05),
    0 1px 3px rgba(0, 0, 0, 0.03);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card:hover {
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}

/* Hero card (wider, more dramatic) */
.card-hero {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9),
    rgba(248, 251, 255, 0.7)
  );
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  padding: var(--space-8);
  border-radius: 24px;
}
```

### Buttons

```css
/* Primary CTA (sunset gradient) */
.btn-primary {
  background: linear-gradient(135deg, #FFB347, #FF9AB3);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: 12px;
  border: none;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(255, 154, 179, 0.3);
  transition: all 0.2s;
}

.btn-primary:hover {
  box-shadow: 0 8px 24px rgba(255, 154, 179, 0.4);
  transform: translateY(-1px);
}

/* Secondary (outline) */
.btn-secondary {
  background: transparent;
  color: var(--sky-medium);
  border: 2px solid var(--sky-medium);
  padding: var(--space-3) var(--space-6);
  border-radius: 12px;
  font-weight: 600;
}

/* Glass button (for header) */
.btn-glass {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: var(--neutral-800);
}
```

### Liquid Glass Header

```css
.header-liquid {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;

  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.9),
    rgba(248, 251, 255, 0.7)
  );
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(91, 165, 229, 0.1);

  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Auto-hide on scroll down */
.header-liquid.hidden {
  transform: translateY(-100%);
}
```

---

## Animation Principles

### Timing Functions

```css
/* Smooth, natural ease */
--ease-natural: cubic-bezier(0.4, 0, 0.2, 1);

/* Bouncy (for playful interactions) */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

/* Slow start, fast end (for exits) */
--ease-out: cubic-bezier(0, 0, 0.2, 1);
```

### Durations

- **Micro-interactions:** 150-200ms (button hover, small scale)
- **UI transitions:** 300ms (card hover, modal open)
- **Page transitions:** 500ms (route changes)
- **Particle effects:** 800-1200ms (floating, drifting)

### Movement

- **Prefer subtle scale** (1.0 → 1.02) over large movements
- **Use translateY sparingly** (max -4px on hover)
- **Fade in from opacity 0.8**, not 0 (feels smoother)
- **Stagger animations** when revealing lists (50ms delay per item)

---

## Odds Display: "Liquid Scale" Specification

### Concept

A horizontal balance visualization where:
- **Center = 50/50 equilibrium**
- **Left side = YES pool** (fills with blue gradient)
- **Right side = NO pool** (fills with pink/orange gradient)
- **Fulcrum shifts** based on which side has more weight

### Visual Elements

```
┌────────────────────────────────────────────┐
│                                            │
│   YES ◄─────────────●─────────────► NO    │
│                  [fulcrum]                 │
│                                            │
│   [████████████░░░░░░░░░░░░░░░░░░░░]      │
│   Blue gradient ←─── fill direction       │
│                                            │
│   62%                              38%    │
└────────────────────────────────────────────┘
```

### Implementation Notes

1. **Container:** Full-width bar, 80px height
2. **Fulcrum:** Small circle or triangle that shifts horizontally based on `yesPool / (yesPool + noPool)` ratio
3. **Liquid fill:** Gradient overlay with mask, animated with Framer Motion
4. **Particles:** 5-8 small sparkles that drift toward the heavier side
5. **Smooth transitions:** Spring animation (200ms duration, slight overshoot)

### Colors

```css
/* YES side (left) */
--odds-yes: linear-gradient(90deg, #5BA5E5, #87CEEB);

/* NO side (right) */
--odds-no: linear-gradient(90deg, #FFB347, #FF9AB3);

/* Fulcrum */
--odds-fulcrum: #FFFFFF;
--odds-fulcrum-shadow: rgba(0, 0, 0, 0.1);
```

### Component Props

```typescript
interface OddsDisplayProps {
  yesPool: bigint;
  noPool: bigint;
  variant?: 'liquid-scale' | 'future-alternative'; // Easy swap later
  size?: 'compact' | 'wide';
}
```

**Isolation:** This component is self-contained. Swapping to a different visualization only requires changing the implementation of `<OddsDisplay />` — no parent components need updates.

---

## Asset Guidelines

### Midjourney-Generated Elements

**What to generate:**
1. **Film grain texture** (512x512px seamless tile)
2. **Cloud overlays** (soft, dreamy clouds for backgrounds)
3. **Particle/sparkle sprites** (individual PNG elements)
4. **Hero backgrounds** (wide gradient landscapes, 1920x800px)

**Prompt formula:**
```
[subject] in nostalgic futurism style, sky gradient background,
soft film grain texture, ethereal lighting, pastel colors,
dreamy atmosphere, high detail, 8k --ar 16:9 --style raw
```

### SVG Conversion (Figma MCP)

For clean geometric elements (icons, buttons, shapes):
1. Generate raster in Midjourney
2. Import to Figma
3. Trace/recreate as vector shapes
4. Export as optimized SVG
5. Use inline in React components

### Performance

- **Max file size:** 200KB per asset
- **Optimize PNGs** with TinyPNG before committing
- **Lazy load** background images below the fold
- **Use WebP** for photos, PNG for illustrations

---

## Accessibility

### Color Contrast

All text must meet **WCAG AA standards**:
- Body text: 4.5:1 contrast ratio
- Large text (18px+): 3:1 contrast ratio

**Check:** Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Interactive Elements

- **Focus rings:** 2px solid outline, sky blue (`#5BA5E5`)
- **Keyboard navigation:** All interactive elements must be reachable via Tab
- **ARIA labels:** Required for icon-only buttons

### Motion

Respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Mobile Responsive

### Breakpoints

```css
/* Tailwind defaults */
--mobile: 640px;     /* sm */
--tablet: 768px;     /* md */
--desktop: 1024px;   /* lg */
--wide: 1280px;      /* xl */
```

### Mobile Adjustments

- **Reduce padding:** Use `--space-4` instead of `--space-8` on small screens
- **Single column grids:** Market cards stack vertically below 768px
- **Larger touch targets:** Minimum 44px × 44px for buttons
- **Simplify animations:** Reduce or disable particle effects on mobile
- **Header:** Full-width logo, hamburger menu below 768px

---

## File Structure

```
apps/web/
├── public/
│   ├── textures/
│   │   ├── film-grain.png
│   │   └── cloud-overlay.png
│   ├── particles/
│   │   ├── sparkle-01.svg
│   │   └── sparkle-02.svg
│   └── backgrounds/
│       └── hero-sky.webp
├── src/
│   ├── styles/
│   │   ├── globals.css          # Base styles, CSS variables
│   │   ├── animations.css       # Keyframes, transitions
│   │   └── utilities.css        # Custom Tailwind utilities
│   └── components/
│       └── ui/
│           └── particle-system.tsx  # Reusable particle component
```

---

## Design Checklist

When building a new component, ensure:

- [ ] Uses color palette variables (no hardcoded hex)
- [ ] Generous whitespace (min `--space-6` padding)
- [ ] Hover states with subtle scale (1.02) or shadow
- [ ] Focus states for keyboard navigation
- [ ] Smooth transitions (300ms `cubic-bezier(0.4, 0, 0.2, 1)`)
- [ ] Mobile responsive (test below 640px)
- [ ] Respects `prefers-reduced-motion`
- [ ] Optional texture overlay for visual richness
- [ ] Glass morphism or gradient background
- [ ] Particle effects on key interactions (optional)

---

## Reference Images

**Pinterest Board:** [Link to be added by user]

**Key Inspirations:**
1. **Flower field with sparkles** — Particle density, color saturation
2. **Train on water reflection** — Soft gradients, nostalgic tone
3. **Train on golden hill** — Warm gradient, textured landscape
4. **Glass buildings perspective** — Clean geometry, sky integration
5. **"Northern" poster** — Typography treatment, texture overlay

---

## Version History

- **v1.0 (2025-12-20):** Initial design system for Epic 5
- Future updates: Add dark mode variant, expand component library

---

**Next Steps:**
- Generate Midjourney assets (film grain, cloud textures, particles)
- Build Figma component library for mockups
- Implement shadcn/ui components with design system styles
- Test on multiple devices and screen sizes
