# WeatherB Assets Guide

## Hero Background

**Location:** `/public/backgrounds/hero-clouds.jpg`

**Specs:**
- Dimensions: 1920 x 797px
- Size: **178KB** ✅ (optimized from 5.2MB!)
- Format: JPEG (70% quality)

**Also Available:**
- `hero-clouds.png` (1.8MB PNG) - Use for higher quality if needed

**Usage:**
```tsx
// In page or component
<div
  className="relative min-h-[400px]"
  style={{
    backgroundImage: 'url(/backgrounds/hero-clouds.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }}
>
  {/* Hero content */}
</div>

// Or with Next.js Image (recommended)
import Image from 'next/image';

<div className="relative w-full h-[400px]">
  <Image
    src="/backgrounds/hero-clouds.jpg"
    alt="Sky background"
    fill
    className="object-cover"
    priority
    quality={85}
  />
  {/* Hero content */}
</div>
```

## Cloud Particles

**Location:** `/public/particles/cloudsvg1.svg`

**Specs:**
- Format: SVG (vector)
- Size: 236KB
- Contains: 9 cloud sprites in one file

**Usage via ParticleSystem component:**
```tsx
import { ParticleSystem } from '@/components/ui/particle-system';

// Floating clouds
<div className="relative h-screen">
  <ParticleSystem
    count={8}
    type="cloud"
    width={100}
    height={100}
    animate
  />
  {/* Your content */}
</div>

// Sparkles (CSS-based, no SVG needed)
<ParticleSystem
  count={12}
  type="sparkle"
  width={100}
  height={100}
  animate
/>
```

## Particle System Component

**Location:** `/src/components/ui/particle-system.tsx`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `count` | `number` | `5` | Number of particles to render |
| `type` | `'cloud' \| 'sparkle'` | `'cloud'` | Particle type |
| `className` | `string` | `''` | Additional CSS classes |
| `width` | `number` | `100` | Area width percentage |
| `height` | `number` | `100` | Area height percentage |
| `animate` | `boolean` | `true` | Enable floating animation |

### Examples

**Hero Section with Floating Clouds:**
```tsx
<section className="relative h-96 overflow-hidden bg-gradient-to-b from-sky-200 to-orange-100">
  <ParticleSystem count={6} type="cloud" />
  <div className="relative z-10">
    <h1>Welcome to WeatherB</h1>
  </div>
</section>
```

**Card Hover Effect:**
```tsx
<div className="relative group">
  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
    <ParticleSystem count={3} type="sparkle" />
  </div>
  <div className="relative z-10 p-6">
    {/* Card content */}
  </div>
</div>
```

**Market Card with Subtle Animation:**
```tsx
<motion.div
  className="relative p-6 bg-white/70 backdrop-blur-md rounded-2xl"
  whileHover={{ scale: 1.02 }}
>
  <ParticleSystem count={4} type="cloud" animate={false} />
  {/* Market details */}
</motion.div>
```

## Textures

### Paper Grain Texture

**Location:** `/public/textures/paper-grain.jpg`

**Specs:**
- Size: 512 x 512px (tileable)
- File size: **43KB** ✅
- Format: JPEG

**Usage:**
```tsx
// As CSS background overlay
<div className="relative">
  <div
    className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
    style={{
      backgroundImage: 'url(/textures/paper-grain.jpg)',
      backgroundSize: '512px 512px',
      backgroundRepeat: 'repeat',
    }}
  />
  {/* Your content */}
</div>

// Or via Tailwind class (add to globals.css)
.grain-overlay::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url('/textures/paper-grain.jpg');
  background-size: 512px 512px;
  opacity: 0.03;
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

### Halftone Blue Texture

**Location:** `/public/textures/halftone-blue.jpg`

**Specs:**
- Size: 512 x 512px
- File size: **94KB** ✅ (optimized from 12MB!)
- Format: JPEG
- Use case: Alternative texture for specific components

**Usage:**
```tsx
// Subtle background texture for cards
<div
  className="relative p-6 rounded-2xl"
  style={{
    backgroundImage: 'url(/textures/halftone-blue.jpg)',
    backgroundSize: 'cover',
    backgroundBlendMode: 'soft-light',
  }}
>
  {/* Card content */}
</div>
```

## Future Optimizations

### TODO: Lazy Load Particles
Only render particles when in viewport using `IntersectionObserver`.

### TODO: Add More Textures
- Cloud texture overlay for cards
- Sparkle sprite sheet (individual PNGs)

## Design System Integration

All assets follow the "Nostalgic Futurism" design language:
- **Colors:** Sky blues (#5BA5E5, #87CEEB) with sunset accents (#FFB347, #FF9AB3)
- **Textures:** Soft, dreamy, film grain aesthetic
- **Animation:** Subtle, 3-7 second float cycles
- **Opacity:** 30-70% for ethereal effect

See `/docs/design-system.md` for full guidelines.
