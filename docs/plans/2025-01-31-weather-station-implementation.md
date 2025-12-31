# Weather Station Control Room Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform WeatherB into a 1970s weather station control room with retro-futuristic analog instruments, warm sunset palette, and tactile interactions that evoke curiosity and wonder.

**Architecture:** Component-first approach building reusable analog instrument primitives (gauges, meters, readouts) using SVG and Framer Motion. CSS variables for theming. Canvas-based particle system. All existing functionality preserved, only visual layer replaced.

**Tech Stack:** Next.js 16.1, React 19, Framer Motion, Tailwind CSS, shadcn/ui (refactored), IBM Plex Mono + Space Mono fonts, SVG, Canvas API

**Design Reference:** `/Users/cobibean/DEV/weatherb/docs/plans/2025-01-31-weather-station-design.md`

**Branch:** `redesign/weather-station` (worktree at `/Users/cobibean/.claude-worktrees/weatherb/weather-station`)

---

## Phase 1: Foundation (4-6 hours)

### Task 1.1: Install Fonts

**Files:**
- Modify: `apps/web/src/app/layout.tsx:1-20`

**Step 1: Install Google Fonts package**

```bash
cd apps/web
pnpm add @next/font
```

**Step 2: Import fonts in layout**

Add to `apps/web/src/app/layout.tsx`:

```typescript
import { IBM_Plex_Mono, Space_Mono } from 'next/font/google';

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});
```

**Step 3: Add font variables to body className**

Update the `<body>` tag className:

```typescript
<body className={`${ibmPlexMono.variable} ${spaceMono.variable} antialiased`}>
```

**Step 4: Test fonts load**

Run: `cd apps/web && pnpm dev`
Check: Browser DevTools > Network > Fonts tab shows IBM Plex Mono and Space Mono loading

**Step 5: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/package.json
git commit -m "feat(design): add IBM Plex Mono and Space Mono fonts"
```

---

### Task 1.2: Define CSS Variables

**Files:**
- Modify: `apps/web/src/app/globals.css:1-50`

**Step 1: Add weather station color palette**

Add to `apps/web/src/app/globals.css` after the existing `:root` block:

```css
:root {
  /* Weather Station Color Palette - Sunset/Golden Hour */
  --color-cream: #F5F1E8;
  --color-beige: #E8DCC8;
  --color-peach: #FFB088;
  --color-coral: #FF8866;
  --color-gold: #FFD56B;
  --color-purple: #9B8BB4;
  --color-rose: #D4A5A5;
  --color-amber: #FFA500;

  /* Admin Dark Theme */
  --color-navy: #1A1F2E;
  --color-gray-blue: #2A3142;

  /* Typography */
  --font-mono: var(--font-ibm-plex-mono), var(--font-space-mono), 'Courier New', monospace;

  /* Effects */
  --glow-warm: 0 0 20px rgba(255, 176, 136, 0.3);
  --glow-amber: 0 0 15px rgba(255, 165, 0, 0.5);
  --shadow-panel: 0 4px 12px rgba(0, 0, 0, 0.15);

  /* Gradients */
  --gradient-temp-cold-hot: linear-gradient(90deg, #6B9BD1 0%, #FF8866 100%);
  --gradient-peach: linear-gradient(135deg, #FFB088 0%, #FF8866 100%);
  --gradient-purple: linear-gradient(135deg, #9B8BB4 0%, #D4A5A5 100%);
  --gradient-background: linear-gradient(180deg, #F5F1E8 0%, #E8DCC8 100%);
}
```

**Step 2: Add Tailwind config for custom colors**

Modify `apps/web/tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      weather: {
        cream: 'var(--color-cream)',
        beige: 'var(--color-beige)',
        peach: 'var(--color-peach)',
        coral: 'var(--color-coral)',
        gold: 'var(--color-gold)',
        purple: 'var(--color-purple)',
        rose: 'var(--color-rose)',
        amber: 'var(--color-amber)',
        navy: 'var(--color-navy)',
        grayBlue: 'var(--color-gray-blue)',
      },
    },
    fontFamily: {
      mono: 'var(--font-mono)',
    },
    boxShadow: {
      'warm': 'var(--glow-warm)',
      'amber': 'var(--glow-amber)',
      'panel': 'var(--shadow-panel)',
    },
  },
},
```

**Step 3: Test CSS variables**

Run: `cd apps/web && pnpm dev`
Check: Browser DevTools > Elements > :root shows all custom properties

**Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/tailwind.config.ts
git commit -m "feat(design): add weather station CSS variables and Tailwind config"
```

---

### Task 1.3: Create Particle System

**Files:**
- Create: `apps/web/src/components/effects/particle-field.tsx`

**Step 1: Write ParticleField component**

Create `apps/web/src/components/effects/particle-field.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Create particles (20-30 max)
    const particles: Particle[] = Array.from({ length: 25 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.3 + 0.1,
    }));

    // Animation loop
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle (warm peach/gold)
        ctx.fillStyle = `rgba(255, 176, 136, ${particle.opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
```

**Step 2: Test particle rendering**

Create test page at `apps/web/src/app/test-particles/page.tsx`:

```typescript
import { ParticleField } from '@/components/effects/particle-field';

export default function TestParticles() {
  return (
    <div className="min-h-screen bg-weather-cream">
      <ParticleField />
      <div className="relative z-10 p-8">
        <h1 className="font-mono text-4xl">Particle Test</h1>
      </div>
    </div>
  );
}
```

Run: `pnpm dev` and visit `http://localhost:3000/test-particles`
Expected: Floating peach-colored particles visible on cream background

**Step 3: Add prefers-reduced-motion support**

Update `ParticleField` to disable for accessibility:

```typescript
useEffect(() => {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // ... rest of particle code
}, []);
```

**Step 4: Commit**

```bash
git add apps/web/src/components/effects/particle-field.tsx apps/web/src/app/test-particles/page.tsx
git commit -m "feat(effects): add particle field system with accessibility support"
```

---

### Task 1.4: Create Base Component Primitives

**Files:**
- Create: `apps/web/src/components/instruments/instrument-panel.tsx`
- Create: `apps/web/src/components/instruments/panel-button.tsx`

**Step 1: Write InstrumentPanel container**

Create `apps/web/src/components/instruments/instrument-panel.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface InstrumentPanelProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function InstrumentPanel({ children, className = '', glow = true }: InstrumentPanelProps) {
  return (
    <motion.div
      className={`
        relative bg-weather-cream rounded-2xl p-6 border-2 border-weather-beige
        ${glow ? 'shadow-warm' : 'shadow-panel'}
        ${className}
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Grain texture overlay */}
      <div
        className="absolute inset-0 rounded-2xl opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
        }}
      />
      {children}
    </motion.div>
  );
}
```

**Step 2: Write PanelButton component**

Create `apps/web/src/components/instruments/panel-button.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PanelButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'peach' | 'purple' | 'neutral';
  disabled?: boolean;
  className?: string;
}

export function PanelButton({
  children,
  onClick,
  variant = 'peach',
  disabled = false,
  className = ''
}: PanelButtonProps) {
  const variants = {
    peach: 'bg-gradient-to-br from-weather-peach to-weather-coral hover:shadow-warm',
    purple: 'bg-gradient-to-br from-weather-purple to-weather-rose hover:shadow-warm',
    neutral: 'bg-weather-beige hover:bg-weather-gold',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative px-6 py-3 rounded-lg font-mono font-semibold text-black
        uppercase tracking-wide text-sm
        ${variants[variant]}
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
    >
      {/* Inner shadow for depth */}
      <div className="absolute inset-0 rounded-lg shadow-inner opacity-20 pointer-events-none" />
      {children}
    </motion.button>
  );
}
```

**Step 3: Test components**

Update `apps/web/src/app/test-particles/page.tsx`:

```typescript
import { ParticleField } from '@/components/effects/particle-field';
import { InstrumentPanel } from '@/components/instruments/instrument-panel';
import { PanelButton } from '@/components/instruments/panel-button';

export default function TestParticles() {
  return (
    <div className="min-h-screen bg-weather-cream">
      <ParticleField />
      <div className="relative z-10 p-8 max-w-4xl mx-auto space-y-6">
        <h1 className="font-mono text-4xl uppercase">Component Test</h1>

        <InstrumentPanel>
          <h2 className="font-mono text-xl uppercase mb-4">Instrument Panel</h2>
          <p className="font-mono text-sm">This is a test panel with warm glow.</p>
        </InstrumentPanel>

        <InstrumentPanel glow={false}>
          <div className="flex gap-4">
            <PanelButton variant="peach">YES</PanelButton>
            <PanelButton variant="purple">NO</PanelButton>
            <PanelButton variant="neutral">CANCEL</PanelButton>
          </div>
        </InstrumentPanel>
      </div>
    </div>
  );
}
```

Run: `pnpm dev` and check test page
Expected: Panels with grain texture, buttons with gradients and press animations

**Step 4: Commit**

```bash
git add apps/web/src/components/instruments/
git commit -m "feat(instruments): add InstrumentPanel and PanelButton base components"
```

---

## Phase 2: Core Components (8-10 hours)

### Task 2.1: Build AnalogGauge Component

**Files:**
- Create: `apps/web/src/components/instruments/analog-gauge.tsx`

**Step 1: Write AnalogGauge component**

Create `apps/web/src/components/instruments/analog-gauge.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AnalogGaugeProps {
  value: number;
  min: number;
  max: number;
  label: string;
  unit?: string;
  arcDegrees?: number; // Default 180 for semicircle
  gradient?: string;
}

export function AnalogGauge({
  value,
  min,
  max,
  label,
  unit = '',
  arcDegrees = 180,
  gradient = 'var(--gradient-temp-cold-hot)',
}: AnalogGaugeProps) {
  const [displayValue, setDisplayValue] = useState(min);

  useEffect(() => {
    // Animate value change
    const timeout = setTimeout(() => setDisplayValue(value), 100);
    return () => clearTimeout(timeout);
  }, [value]);

  // Calculate needle rotation (-90 to +90 for 180° arc)
  const normalizedValue = (displayValue - min) / (max - min);
  const startAngle = -arcDegrees / 2;
  const needleRotation = startAngle + normalizedValue * arcDegrees;

  // SVG dimensions
  const size = 200;
  const center = size / 2;
  const radius = 70;
  const needleLength = 60;

  // Arc path for gradient track
  const startRad = (startAngle - 90) * (Math.PI / 180);
  const endRad = (startAngle + arcDegrees - 90) * (Math.PI / 180);

  const arcPath = `
    M ${center + radius * Math.cos(startRad)} ${center + radius * Math.sin(startRad)}
    A ${radius} ${radius} 0 ${arcDegrees > 180 ? 1 : 0} 1
    ${center + radius * Math.cos(endRad)} ${center + radius * Math.sin(endRad)}
  `;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6B9BD1" />
            <stop offset="100%" stopColor="#FF8866" />
          </linearGradient>
        </defs>

        {/* Arc track */}
        <path
          d={arcPath}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {Array.from({ length: 9 }).map((_, i) => {
          const angle = startAngle + (i / 8) * arcDegrees;
          const tickStart = radius - 5;
          const tickEnd = radius + 5;
          const x1 = center + tickStart * Math.cos((angle - 90) * (Math.PI / 180));
          const y1 = center + tickStart * Math.sin((angle - 90) * (Math.PI / 180));
          const x2 = center + tickEnd * Math.cos((angle - 90) * (Math.PI / 180));
          const y2 = center + tickEnd * Math.sin((angle - 90) * (Math.PI / 180));

          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#000"
              strokeWidth="2"
              opacity="0.3"
            />
          );
        })}

        {/* Needle */}
        <motion.g
          initial={{ rotate: startAngle }}
          animate={{ rotate: needleRotation }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        >
          <line
            x1={center}
            y1={center}
            x2={center}
            y2={center - needleLength}
            stroke="#000"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={center} cy={center} r="6" fill="#000" />
        </motion.g>
      </svg>

      {/* Center readout */}
      <motion.div
        className="font-mono text-4xl font-bold -mt-16 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {Math.round(displayValue)}{unit}
      </motion.div>

      {/* Label */}
      <div className="font-mono text-xs uppercase tracking-widest opacity-60">
        {label}
      </div>
    </div>
  );
}
```

**Step 2: Test AnalogGauge**

Update test page:

```typescript
<InstrumentPanel>
  <AnalogGauge
    value={42}
    min={20}
    max={60}
    label="Target Temp"
    unit="°F"
  />
</InstrumentPanel>
```

Run: `pnpm dev` and verify needle animates from start to 42°F

**Step 3: Commit**

```bash
git add apps/web/src/components/instruments/analog-gauge.tsx
git commit -m "feat(instruments): add AnalogGauge with animated needle"
```

---

### Task 2.2: Build BarMeter Component

**Files:**
- Create: `apps/web/src/components/instruments/bar-meter.tsx`

**Step 1: Write BarMeter component**

Create `apps/web/src/components/instruments/bar-meter.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';

interface BarMeterProps {
  value: number; // 0-100
  label: string;
  variant?: 'peach' | 'purple';
  showPercentage?: boolean;
  reverse?: boolean; // Fill from right
}

export function BarMeter({
  value,
  label,
  variant = 'peach',
  showPercentage = true,
  reverse = false,
}: BarMeterProps) {
  const gradients = {
    peach: 'from-weather-peach to-weather-coral',
    purple: 'from-weather-purple to-weather-rose',
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs uppercase tracking-wide opacity-60">
          {label}
        </span>
        {showPercentage && (
          <span className="font-mono text-sm font-semibold">
            {value.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="relative h-8 bg-weather-beige rounded-full overflow-hidden">
        <motion.div
          className={`absolute top-0 h-full bg-gradient-to-r ${gradients[variant]} ${
            reverse ? 'right-0' : 'left-0'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
      </div>
    </div>
  );
}
```

**Step 2: Build DualBarMeter for YES/NO odds**

Add to same file:

```typescript
interface DualBarMeterProps {
  yesPercentage: number;
  noPercentage: number;
  poolSize?: string;
}

export function DualBarMeter({ yesPercentage, noPercentage, poolSize }: DualBarMeterProps) {
  return (
    <div className="space-y-3">
      <BarMeter value={yesPercentage} label="YES" variant="peach" />
      <BarMeter value={noPercentage} label="NO" variant="purple" reverse />

      {poolSize && (
        <div className="text-center mt-4">
          <div className="font-mono text-xs uppercase tracking-wide opacity-60 mb-1">
            Pool
          </div>
          <div className="font-mono text-2xl font-bold text-weather-amber drop-shadow-amber">
            {poolSize}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Test meters**

Update test page:

```typescript
<InstrumentPanel>
  <DualBarMeter
    yesPercentage={65.5}
    noPercentage={34.5}
    poolSize="125 FLR"
  />
</InstrumentPanel>
```

Expected: Two bars filling in opposite directions with pool size below

**Step 4: Commit**

```bash
git add apps/web/src/components/instruments/bar-meter.tsx
git commit -m "feat(instruments): add BarMeter and DualBarMeter components"
```

---

### Task 2.3: Build DigitalReadout Component

**Files:**
- Create: `apps/web/src/components/instruments/digital-readout.tsx`

**Step 1: Write DigitalReadout with flip animation**

Create `apps/web/src/components/instruments/digital-readout.tsx`:

```typescript
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface DigitalReadoutProps {
  value: string | number;
  label?: string;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
}

export function DigitalReadout({
  value,
  label,
  unit,
  size = 'md',
  glow = true,
}: DigitalReadoutProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const sizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <div className="font-mono text-xs uppercase tracking-widest opacity-60">
          {label}
        </div>
      )}

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={String(displayValue)}
            className={`
              font-mono font-bold ${sizes[size]}
              ${glow ? 'text-weather-amber drop-shadow-amber' : 'text-black'}
            `}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: 90, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {displayValue}
            {unit && <span className="text-sm ml-1">{unit}</span>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

**Step 2: Test digital readout**

Update test page:

```typescript
<InstrumentPanel>
  <DigitalReadout
    value="42.0"
    label="Temperature"
    unit="°F"
    size="lg"
  />
</InstrumentPanel>
```

**Step 3: Commit**

```bash
git add apps/web/src/components/instruments/digital-readout.tsx
git commit -m "feat(instruments): add DigitalReadout with flip animation"
```

---

### Task 2.4: Build CountdownTimer Component

**Files:**
- Create: `apps/web/src/components/instruments/countdown-timer.tsx`

**Step 1: Write CountdownTimer with circular segments**

Create `apps/web/src/components/instruments/countdown-timer.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: Date;
  label?: string;
}

export function CountdownTimer({ targetDate, label = 'Resolves In' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, total: 0 });
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, total: difference });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  // Calculate percentage for visual
  const totalHours = 24; // Assume 24h max
  const hoursElapsed = totalHours - timeLeft.hours;
  const percentage = (hoursElapsed / totalHours) * 100;

  const size = 160;
  const center = size / 2;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  // Pulsing when < 1 hour
  const isUrgent = timeLeft.total > 0 && timeLeft.hours === 0;

  return (
    <div className="flex flex-col items-center">
      <div className="font-mono text-xs uppercase tracking-widest opacity-60 mb-4">
        {label}
      </div>

      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1, repeat: isUrgent ? Infinity : 0 }}
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-beige)"
          strokeWidth="8"
        />

        {/* Progress circle */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={isUrgent ? 'var(--color-amber)' : 'var(--color-peach)'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: circumference - (percentage / 100) * circumference,
          }}
          transition={{ duration: 1 }}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
          }}
        />

        {/* Center time display */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-mono text-2xl font-bold"
          fill={isUrgent ? 'var(--color-amber)' : '#000'}
        >
          {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </text>
      </motion.svg>
    </div>
  );
}
```

**Step 2: Test countdown timer**

Update test page:

```typescript
const tomorrow = new Date();
tomorrow.setHours(tomorrow.getHours() + 4);

<InstrumentPanel>
  <CountdownTimer targetDate={tomorrow} />
</InstrumentPanel>
```

Expected: Circular timer with filling arc and ticking time display

**Step 3: Commit**

```bash
git add apps/web/src/components/instruments/countdown-timer.tsx
git commit -m "feat(instruments): add CountdownTimer with circular progress"
```

---

### Task 2.5: Build DialControl Component

**Files:**
- Create: `apps/web/src/components/instruments/dial-control.tsx`

**Step 1: Write interactive dial for bet amount**

Create `apps/web/src/components/instruments/dial-control.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

interface DialControlProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
}

export function DialControl({
  value,
  min,
  max,
  onChange,
  label = 'Amount',
  unit = 'FLR',
}: DialControlProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);

  // Calculate needle rotation based on value
  const normalizedValue = (value - min) / (max - min);
  const rotation = -135 + normalizedValue * 270; // -135° to +135°

  const handleDrag = (event: MouseEvent | TouchEvent) => {
    if (!dialRef.current) return;

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    const angle = Math.atan2(clientY - centerY, clientX - centerX);
    let degrees = (angle * 180) / Math.PI + 90;

    // Normalize to -135 to +135
    if (degrees < -135) degrees += 360;
    if (degrees > 135) return;

    const normalized = (degrees + 135) / 270;
    const newValue = min + normalized * (max - min);
    onChange(Math.max(min, Math.min(max, newValue)));
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      handleDrag(e);
    };

    const onEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging]);

  return (
    <div className="flex flex-col items-center">
      <div className="font-mono text-xs uppercase tracking-widest opacity-60 mb-4">
        {label}
      </div>

      <div
        ref={dialRef}
        className="relative w-48 h-48 cursor-pointer"
        onMouseDown={() => setIsDragging(true)}
        onTouchStart={() => setIsDragging(true)}
      >
        <svg width="100%" height="100%" viewBox="0 0 200 200">
          {/* Dial arc */}
          <path
            d="M 30 150 A 80 80 0 1 1 170 150"
            fill="none"
            stroke="var(--color-beige)"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Progress arc */}
          <motion.path
            d="M 30 150 A 80 80 0 1 1 170 150"
            fill="none"
            stroke="var(--color-peach)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="377"
            initial={{ strokeDashoffset: 377 }}
            animate={{
              strokeDashoffset: 377 - (normalizedValue * 377),
            }}
          />

          {/* Needle */}
          <motion.g
            animate={{ rotate: rotation }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ transformOrigin: '100px 100px' }}
          >
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="40"
              stroke="#000"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="8" fill="#000" />
          </motion.g>
        </svg>

        {/* Center value display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center mt-8">
            <div className="font-mono text-3xl font-bold text-weather-amber drop-shadow-amber">
              {value.toFixed(2)}
            </div>
            <div className="font-mono text-xs uppercase opacity-60 mt-1">
              {unit}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Test dial control**

Update test page:

```typescript
const [betAmount, setBetAmount] = useState(5);

<InstrumentPanel>
  <DialControl
    value={betAmount}
    min={0}
    max={100}
    onChange={setBetAmount}
    label="Bet Amount"
  />
</InstrumentPanel>
```

Expected: Interactive dial that rotates when dragged, updates value

**Step 3: Commit**

```bash
git add apps/web/src/components/instruments/dial-control.tsx
git commit -m "feat(instruments): add interactive DialControl component"
```

---

## Phase 3: Home Page (6-8 hours)

### Task 3.1: Create Hero Three-Panel Display

**Files:**
- Modify: `apps/web/src/components/home/home-client.tsx`

**Step 1: Add hero market display section**

Update `apps/web/src/components/home/home-client.tsx` to add hero display above grid:

```typescript
import { AnalogGauge } from '@/components/instruments/analog-gauge';
import { DualBarMeter } from '@/components/instruments/bar-meter';
import { CountdownTimer } from '@/components/instruments/countdown-timer';
import { InstrumentPanel } from '@/components/instruments/instrument-panel';

// Inside component, before market grid:
const heroMarket = markets[0]; // Featured market

{heroMarket && (
  <div className="mb-12">
    <h2 className="font-mono text-sm uppercase tracking-widest opacity-60 mb-6 text-center">
      Featured Market
    </h2>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Panel 1: Temperature Gauge */}
      <InstrumentPanel>
        <AnalogGauge
          value={heroMarket.threshold / 10}
          min={heroMarket.threshold / 10 - 20}
          max={heroMarket.threshold / 10 + 20}
          label="Target Temp"
          unit="°F"
        />
      </InstrumentPanel>

      {/* Panel 2: Odds Meter */}
      <InstrumentPanel>
        <DualBarMeter
          yesPercentage={heroMarket.yesOdds * 100}
          noPercentage={heroMarket.noOdds * 100}
          poolSize={`${heroMarket.poolSize} FLR`}
        />
      </InstrumentPanel>

      {/* Panel 3: Countdown Timer */}
      <InstrumentPanel>
        <CountdownTimer
          targetDate={new Date(heroMarket.resolveTime)}
        />
        <div className="font-mono text-sm uppercase text-center mt-4 opacity-80">
          {heroMarket.city}
        </div>
      </InstrumentPanel>
    </div>
  </div>
)}
```

**Step 2: Test hero display**

Run: `pnpm dev`
Expected: Three panels displaying temperature gauge, odds bars, and countdown

**Step 3: Make responsive for mobile**

Update grid to stack on mobile:

```typescript
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
```

Test on mobile viewport (DevTools): Panels should stack vertically

**Step 4: Commit**

```bash
git add apps/web/src/components/home/home-client.tsx
git commit -m "feat(home): add hero three-panel instrument cluster"
```

---

### Task 3.2: Update Market Grid Cards

**Files:**
- Create: `apps/web/src/components/markets/market-card-retro.tsx`

**Step 1: Create retro market card component**

Create `apps/web/src/components/markets/market-card-retro.tsx`:

```typescript
'use client';

import { motion } from 'framer-motion';
import { PanelButton } from '@/components/instruments/panel-button';
import { BarMeter } from '@/components/instruments/bar-meter';

interface MarketCardRetroProps {
  city: string;
  threshold: number;
  resolveTime: Date;
  yesOdds: number;
  noOdds: number;
  poolSize: string;
  onBetYes: () => void;
  onBetNo: () => void;
  isClosingSoon?: boolean;
  isClosed?: boolean;
}

export function MarketCardRetro({
  city,
  threshold,
  resolveTime,
  yesOdds,
  noOdds,
  poolSize,
  onBetYes,
  onBetNo,
  isClosingSoon = false,
  isClosed = false,
}: MarketCardRetroProps) {
  const resolveTimeStr = new Date(resolveTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <motion.div
      className={`
        relative bg-weather-cream rounded-2xl border-2
        ${isClosingSoon ? 'border-weather-amber shadow-amber' : 'border-weather-beige'}
        ${isClosed ? 'opacity-60' : 'hover:shadow-warm'}
        p-6 transition-all duration-200
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!isClosed ? { y: -4 } : {}}
    >
      {/* Grain texture */}
      <div
        className="absolute inset-0 rounded-2xl opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* Closing soon badge */}
      {isClosingSoon && !isClosed && (
        <motion.div
          className="absolute -top-3 -right-3 bg-weather-amber text-black font-mono text-xs uppercase px-3 py-1 rounded-full font-bold"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          Closing Soon
        </motion.div>
      )}

      {/* Closed stamp */}
      {isClosed && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-6xl uppercase opacity-20 rotate-12 pointer-events-none">
          CLOSED
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className="font-mono text-2xl uppercase font-bold mb-2">
          {city}
        </h3>
        <div className="font-mono text-sm opacity-60 space-y-1">
          <div>TARGET: {threshold}°F</div>
          <div>RESOLVES {resolveTimeStr}</div>
        </div>
      </div>

      {/* Mini bars */}
      <div className="mb-4 space-y-2">
        <BarMeter value={yesOdds * 100} label="YES" variant="peach" />
        <BarMeter value={noOdds * 100} label="NO" variant="purple" reverse />
      </div>

      {/* Pool */}
      <div className="text-center mb-4">
        <div className="font-mono text-xs uppercase opacity-60">Pool</div>
        <div className="font-mono text-xl font-bold">{poolSize}</div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <PanelButton
          variant="peach"
          onClick={onBetYes}
          disabled={isClosed}
          className="flex-1"
        >
          Bet YES
        </PanelButton>
        <PanelButton
          variant="purple"
          onClick={onBetNo}
          disabled={isClosed}
          className="flex-1"
        >
          Bet NO
        </PanelButton>
      </div>
    </motion.div>
  );
}
```

**Step 2: Replace old cards with retro cards**

Update `apps/web/src/components/home/home-client.tsx`:

```typescript
import { MarketCardRetro } from '@/components/markets/market-card-retro';

// In grid section:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {markets.slice(1).map((market, index) => (
    <MarketCardRetro
      key={market.id}
      city={market.city}
      threshold={market.threshold / 10}
      resolveTime={market.resolveTime}
      yesOdds={market.yesOdds}
      noOdds={market.noOdds}
      poolSize={`${market.poolSize} FLR`}
      onBetYes={() => handleOpenBetModal(market, 'yes')}
      onBetNo={() => handleOpenBetModal(market, 'no')}
      isClosingSoon={market.closingSoon}
      isClosed={market.isClosed}
    />
  ))}
</div>
```

**Step 3: Test market cards**

Run: `pnpm dev`
Expected: Grid of retro-styled market cards with mini gauges and panel buttons

**Step 4: Commit**

```bash
git add apps/web/src/components/markets/market-card-retro.tsx apps/web/src/components/home/home-client.tsx
git commit -m "feat(markets): add retro market card design"
```

---

### Task 3.3: Update Header Navigation

**Files:**
- Modify: `apps/web/src/components/layout/header.tsx`

**Step 1: Redesign header with vintage aesthetic**

Update `apps/web/src/components/layout/header.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { WalletButton } from './wallet-button';
import { ThermometerSun } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Markets' },
  { href: '/positions', label: 'Positions' },
  { href: '/suggest', label: 'Suggest' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-lg bg-weather-cream/80 border-b-2 border-weather-beige">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-weather-peach to-weather-coral flex items-center justify-center shadow-warm group-hover:scale-105 transition-transform">
              <ThermometerSun className="w-6 h-6 text-black" />
            </div>
            <div>
              <div className="font-mono text-xl font-bold uppercase">
                WeatherB
              </div>
              <div className="font-mono text-xs uppercase tracking-wider opacity-60">
                Temp Prediction Markets
              </div>
            </div>
          </Link>

          {/* Nav tabs */}
          <div className="hidden md:flex items-center gap-2 bg-weather-beige rounded-full p-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative px-6 py-2 rounded-full font-mono text-sm uppercase font-semibold transition-colors"
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-gradient-to-br from-weather-peach to-weather-coral rounded-full shadow-warm"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${isActive ? 'text-black' : 'text-black/60 hover:text-black'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Wallet button */}
          <div className="flex items-center gap-4">
            <WalletButton />
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex gap-2 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex-1 px-4 py-2 rounded-lg font-mono text-sm uppercase font-semibold text-center
                  ${isActive
                    ? 'bg-gradient-to-br from-weather-peach to-weather-coral text-black'
                    : 'bg-weather-beige text-black/60'
                  }
                `}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
```

**Step 2: Update wallet button styling**

Update `apps/web/src/components/layout/wallet-button.tsx` to match aesthetic:

```typescript
// Add green LED indicator when connected
{address && (
  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
)}
```

**Step 3: Test header**

Run: `pnpm dev`
Expected: Floating pill nav bar with animated active indicator, logo with thermometer icon

**Step 4: Commit**

```bash
git add apps/web/src/components/layout/header.tsx apps/web/src/components/layout/wallet-button.tsx
git commit -m "feat(header): redesign with vintage weather station aesthetic"
```

---

### Task 3.4: Create Betting Modal with Dial

**Files:**
- Create: `apps/web/src/components/modals/bet-modal-retro.tsx`

**Step 1: Write betting modal component**

Create `apps/web/src/components/modals/bet-modal-retro.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { DialControl } from '@/components/instruments/dial-control';
import { PanelButton } from '@/components/instruments/panel-button';
import { DigitalReadout } from '@/components/instruments/digital-readout';

interface BetModalRetroProps {
  isOpen: boolean;
  onClose: () => void;
  market: {
    city: string;
    threshold: number;
    side: 'yes' | 'no';
    currentOdds: number;
  };
  onConfirm: (amount: number) => Promise<void>;
}

export function BetModalRetro({ isOpen, onClose, market, onConfirm }: BetModalRetroProps) {
  const [betAmount, setBetAmount] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const potentialWin = betAmount * market.currentOdds;
  const multiplier = market.currentOdds;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(betAmount);
      onClose();
    } catch (error) {
      console.error('Bet failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const presets = [1, 5, 10, 25];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              className="bg-weather-cream rounded-2xl border-2 border-weather-beige shadow-warm max-w-md w-full pointer-events-auto overflow-hidden"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Grain texture */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
                }}
              />

              <div className="relative p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-mono text-xl uppercase font-bold">
                    Place Bet {market.side.toUpperCase()}
                  </h2>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-weather-beige hover:bg-weather-gold transition-colors flex items-center justify-center"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Market info */}
                <div className="mb-6 p-4 bg-weather-beige rounded-lg">
                  <div className="font-mono text-sm uppercase opacity-60 mb-1">Market</div>
                  <div className="font-mono font-semibold">
                    {market.city} - {market.threshold}°F
                  </div>
                </div>

                {/* Dial control */}
                <div className="mb-6">
                  <DialControl
                    value={betAmount}
                    min={0.01}
                    max={100}
                    onChange={setBetAmount}
                    label="Bet Amount"
                  />
                </div>

                {/* Preset buttons */}
                <div className="flex gap-2 mb-6">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setBetAmount(preset)}
                      className="flex-1 py-2 rounded-lg bg-weather-beige hover:bg-weather-gold font-mono font-semibold transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Calculation display */}
                <div className="mb-6 p-4 bg-gradient-to-br from-weather-gold to-weather-peach rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm uppercase opacity-80">If Win:</span>
                    <span className="font-mono text-2xl font-bold">
                      {potentialWin.toFixed(2)} FLR
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm uppercase opacity-80">Return:</span>
                    <span className="font-mono text-xl font-bold">
                      {multiplier.toFixed(2)}x
                    </span>
                  </div>
                </div>

                {/* Confirm button */}
                <PanelButton
                  variant={market.side === 'yes' ? 'peach' : 'purple'}
                  onClick={handleConfirm}
                  disabled={isSubmitting || betAmount < 0.01}
                  className="w-full"
                >
                  {isSubmitting ? 'Confirming...' : `Confirm Bet ${market.side.toUpperCase()}`}
                </PanelButton>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Integrate modal into home page**

Update `apps/web/src/components/home/home-client.tsx` to use new modal

**Step 3: Test betting modal**

Click bet button on any market card
Expected: Modal zooms in with dial control, preset buttons, calculation display

**Step 4: Commit**

```bash
git add apps/web/src/components/modals/bet-modal-retro.tsx
git commit -m "feat(modals): add retro betting modal with dial control"
```

---

## Phase 4: Positions & Admin (6-8 hours)

### Task 4.1: Update Positions Page

**Files:**
- Modify: `apps/web/src/app/positions/page.tsx`

**Step 1: Add stats panel with analog displays**

Update positions page with three-panel stats:

```typescript
import { AnalogGauge } from '@/components/instruments/analog-gauge';
import { DigitalReadout } from '@/components/instruments/digital-readout';
import { InstrumentPanel } from '@/components/instruments/instrument-panel';

// Add above positions table:
<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
  <InstrumentPanel>
    <DigitalReadout
      value={activePositions}
      label="Active Positions"
      size="lg"
      glow={false}
    />
  </InstrumentPanel>

  <InstrumentPanel>
    <DigitalReadout
      value={`${claimableWinnings} FLR`}
      label="Claimable Winnings"
      size="lg"
    />
  </InstrumentPanel>

  <InstrumentPanel>
    <AnalogGauge
      value={winRate}
      min={0}
      max={100}
      label="Win Rate"
      unit="%"
      arcDegrees={180}
    />
  </InstrumentPanel>
</div>
```

**Step 2: Style positions table with monospace aesthetic**

Update table styling:

```typescript
<table className="w-full">
  <thead className="font-mono text-xs uppercase tracking-wider bg-weather-beige">
    <tr>
      <th className="p-4 text-left">Market</th>
      <th className="p-4 text-left">Bet</th>
      <th className="p-4 text-left">Odds</th>
      <th className="p-4 text-left">Status</th>
    </tr>
  </thead>
  <tbody className="font-mono">
    {/* Alternating cream/beige rows */}
  </tbody>
</table>
```

**Step 3: Add LED status indicators**

```typescript
{/* Status cell */}
<td className="p-4">
  <div className="flex items-center gap-2">
    <div className={`w-2 h-2 rounded-full ${
      status === 'won' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
      status === 'lost' ? 'bg-red-500' :
      'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'
    }`} />
    <span className="uppercase text-sm">{status}</span>
  </div>
</td>
```

**Step 4: Test positions page**

Run: `pnpm dev` and navigate to `/positions`
Expected: Three stat panels, monospace table with LED indicators

**Step 5: Commit**

```bash
git add apps/web/src/app/positions/page.tsx
git commit -m "feat(positions): add analog stats panel and LED indicators"
```

---

### Task 4.2: Update Admin Panel Theme

**Files:**
- Modify: `apps/web/src/app/admin/(dashboard)/layout.tsx`

**Step 1: Apply dark navy theme to admin**

Update admin layout:

```typescript
<body className="bg-weather-navy text-weather-cream">
  {/* Admin content */}
</body>
```

**Step 2: Update admin sidebar with backlight effect**

Modify `apps/web/src/components/admin/sidebar.tsx`:

```typescript
{/* Active nav item */}
<Link
  className={`
    ${isActive
      ? 'text-weather-amber bg-weather-grayBlue shadow-amber'
      : 'text-weather-cream/60 hover:text-weather-amber'
    }
  `}
>
```

**Step 3: Update admin dashboard gauges**

Create analog gauge displays for dashboard metrics:

```typescript
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  <InstrumentPanel className="bg-weather-grayBlue border-weather-navy">
    <AnalogGauge
      value={totalMarkets}
      min={0}
      max={100}
      label="Total Markets"
    />
  </InstrumentPanel>
  {/* More gauges... */}
</div>
```

**Step 4: Test admin dark theme**

Navigate to `/admin`
Expected: Dark navy background, amber accents, lit panel effects

**Step 5: Commit**

```bash
git add apps/web/src/app/admin/ apps/web/src/components/admin/
git commit -m "feat(admin): apply dark navy theme with amber accents"
```

---

## Phase 5: Polish & Testing (4-6 hours)

### Task 5.1: Add Background Effects

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

**Step 1: Add gradient background and particle field**

Update root layout:

```typescript
import { ParticleField } from '@/components/effects/particle-field';

<body className="relative" style={{
  background: 'var(--gradient-background)',
}}>
  <ParticleField />
  <div className="relative z-10">
    {children}
  </div>
</body>
```

**Step 2: Test background**

Expected: Warm gradient background with floating particles

**Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(background): add gradient and particle field"
```

---

### Task 5.2: Animation Polish

**Files:**
- Modify: `apps/web/src/app/home/page.tsx`

**Step 1: Add page load boot-up sequence**

```typescript
const [isBooting, setIsBooting] = useState(true);

useEffect(() => {
  const timer = setTimeout(() => setIsBooting(false), 1500);
  return () => clearTimeout(timer);
}, []);

{isBooting ? (
  <div className="min-h-screen flex items-center justify-center">
    <motion.div
      className="font-mono text-2xl uppercase tracking-widest"
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      Initializing...
    </motion.div>
  </div>
) : (
  {/* Normal content with staggered animations */}
)}
```

**Step 2: Add stagger to market cards**

```typescript
{markets.map((market, index) => (
  <motion.div
    key={market.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
  >
    <MarketCardRetro {...market} />
  </motion.div>
))}
```

**Step 3: Test animations**

Expected: Boot sequence, then hero panels animate in sequence, cards stagger

**Step 4: Commit**

```bash
git add apps/web/src/app/home/page.tsx
git commit -m "feat(animations): add boot sequence and staggered reveals"
```

---

### Task 5.3: Responsive Breakpoints

**Files:**
- Multiple component files

**Step 1: Test mobile layouts**

Use DevTools device emulation to test all pages at 375px, 768px, 1024px widths

**Step 2: Fix hero panel stacking**

Ensure three panels stack vertically on mobile with maintained aspect ratios

**Step 3: Fix modal fullscreen on mobile**

Update betting modal:

```typescript
<motion.div
  className="... md:max-w-md md:rounded-2xl max-md:w-full max-md:h-full max-md:rounded-none"
>
```

**Step 4: Test and commit**

```bash
git add .
git commit -m "feat(responsive): optimize mobile layouts and breakpoints"
```

---

### Task 5.4: Accessibility Audit

**Files:**
- All component files

**Step 1: Add aria-labels to all gauges**

```typescript
<svg aria-label={`Temperature gauge showing ${value} degrees Fahrenheit`}>
```

**Step 2: Verify color contrast**

Run: Axe DevTools browser extension
Fix any contrast issues flagged

**Step 3: Test keyboard navigation**

Tab through entire app, ensure:
- All interactive elements focusable
- Modal traps focus
- Visible focus rings (amber glow)

**Step 4: Add focus styles**

```css
*:focus-visible {
  outline: 2px solid var(--color-amber);
  outline-offset: 2px;
}
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat(a11y): improve accessibility with aria-labels and focus styles"
```

---

### Task 5.5: Build & Deploy Test

**Step 1: Run production build**

```bash
cd apps/web
pnpm build
```

Expected: Build succeeds with no errors

**Step 2: Check bundle size**

Verify Lighthouse Performance score ≥ 90

**Step 3: Test on multiple browsers**

- Chrome
- Firefox
- Safari

**Step 4: Create deployment commit**

```bash
git add .
git commit -m "feat(weather-station): complete retro design implementation"
```

---

## Testing Checklist

After implementation, verify:

- [ ] Fonts load (IBM Plex Mono, Space Mono)
- [ ] CSS variables defined
- [ ] Particle field renders (20-30 particles)
- [ ] AnalogGauge needle animates smoothly
- [ ] BarMeter fills with gradient
- [ ] DigitalReadout flips on value change
- [ ] CountdownTimer ticks and pulses when < 1 hour
- [ ] DialControl responds to mouse/touch drag
- [ ] Hero three-panel display shows live data
- [ ] Market cards have grain texture and warm glow
- [ ] Betting modal opens with zoom animation
- [ ] Header has animated active indicator
- [ ] Positions page shows stats in analog gauges
- [ ] Admin panel uses dark navy theme
- [ ] Background gradient and particles visible
- [ ] Boot-up sequence plays on load
- [ ] Mobile layouts stack properly
- [ ] Keyboard navigation works
- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 95
- [ ] prefers-reduced-motion disables animations

---

## Deployment

**When ready to deploy:**

1. Merge `redesign/weather-station` to `main`:

```bash
cd /Users/cobibean/DEV/weatherb
git checkout main
git merge redesign/weather-station
git push origin main
```

2. Vercel will auto-deploy from `main` branch

3. Monitor deployment at vercel.com

---

## Rollback Plan

If issues arise:

1. Revert to previous design:

```bash
git revert HEAD
git push origin main
```

2. Alternative: Keep both branches live, use Vercel preview URLs for testing

---

## Success Metrics

Track after 1 week:

- User engagement (time on site, pages per session)
- Wallet connection rate
- Bet placement rate
- Social media shares/mentions
- Bounce rate changes

**Target improvements:**
- +20% wallet connections
- +15% bet placements
- -10% bounce rate

---

**Total Estimated Time:** 28-38 hours over 4-5 days

**Components Created:** 10 new instrument components
**Pages Updated:** 4 (Home, Positions, Admin, Modals)
**Files Modified:** ~25 files
**Lines of Code:** ~2,500 lines

**Next Steps After Implementation:**
1. User testing session (5-10 users)
2. Gather feedback on curiosity/wonder response
3. A/B test against previous design
4. Iterate based on metrics
