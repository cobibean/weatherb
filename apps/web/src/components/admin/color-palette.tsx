'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Our design system colors with pre-calculated percentages
const designColors = [
  { name: 'Sky Light', hex: '#87CEEB', value: 15 },
  { name: 'Sky Medium', hex: '#5BA5E5', value: 15 },
  { name: 'Sky Deep', hex: '#4A90D9', value: 10 },
  { name: 'Sunset Pink', hex: '#FF9AB3', value: 20 },
  { name: 'Sunset Orange', hex: '#FFB347', value: 15 },
  { name: 'Sunset Coral', hex: '#FF8C94', value: 10 },
  { name: 'Success Soft', hex: '#A8E6CF', value: 8 },
  { name: 'Error Soft', hex: '#FFB3B3', value: 7 },
];

const total = designColors.reduce((sum, item) => sum + item.value, 0);

// Pre-calculate percentages (static, no floating point issues)
const colorData = designColors.map(c => ({
  ...c,
  percentage: ((c.value / total) * 100).toFixed(1),
}));

export function ColorPalettePieChart(): React.ReactElement {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [segments, setSegments] = useState<Array<{
    name: string;
    hex: string;
    value: number;
    percentage: string;
    path: string;
  }>>([]);

  // Calculate paths only on client to avoid hydration mismatch
  useEffect(() => {
    let currentAngle = 0;
    const calculated = colorData.map((item) => {
      const angle = (item.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      
      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (endAngle - 90) * (Math.PI / 180);
      
      const radius = 100;
      const x1 = 120 + radius * Math.cos(startRad);
      const y1 = 120 + radius * Math.sin(startRad);
      const x2 = 120 + radius * Math.cos(endRad);
      const y2 = 120 + radius * Math.sin(endRad);
      
      const largeArcFlag = angle > 180 ? 1 : 0;
      const path = `M 120 120 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      
      return { ...item, path };
    });
    setSegments(calculated);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8">
      {/* SVG Pie Chart - added overflow visible and extra padding in viewBox */}
      <div className="relative">
        <svg 
          width="240" 
          height="240" 
          viewBox="-20 -20 280 280"
          style={{ overflow: 'visible' }}
        >
          {segments.length > 0 ? (
            segments.map((segment, index) => (
              <motion.path
                key={segment.name}
                d={segment.path}
                fill={segment.hex}
                stroke="white"
                strokeWidth="2"
                initial={{ scale: 1, opacity: 0.9 }}
                animate={{
                  scale: hoveredIndex === index ? 1.08 : 1,
                  opacity: hoveredIndex === index ? 1 : 0.85,
                }}
                style={{ transformOrigin: '120px 120px' }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
            ))
          ) : (
            // Placeholder while loading
            <circle cx="120" cy="120" r="100" fill="#f0f0f0" />
          )}
          {/* Center circle for donut effect */}
          <circle cx="120" cy="120" r="50" fill="white" />
          <text
            x="120"
            y="115"
            textAnchor="middle"
            className="font-display text-sm font-bold fill-neutral-800"
          >
            Theme
          </text>
          <text
            x="120"
            y="135"
            textAnchor="middle"
            className="font-body text-xs fill-neutral-500"
          >
            Colors
          </text>
        </svg>
        
        {/* Hover tooltip */}
        {hoveredIndex !== null && segments[hoveredIndex] && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-neutral-800 text-white px-4 py-2 rounded-lg text-sm font-body whitespace-nowrap"
          >
            <span className="font-semibold">{segments[hoveredIndex].name}</span>
            <span className="text-neutral-300 ml-2">{segments[hoveredIndex].percentage}%</span>
          </motion.div>
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {colorData.map((color, index) => (
          <div
            key={color.name}
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
              hoveredIndex === index ? 'bg-black/5' : ''
            }`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: color.hex }}
            />
            <div>
              <p className="font-body text-sm font-medium text-neutral-800">
                {color.name}
              </p>
              <p className="font-mono text-xs text-neutral-500">
                {color.hex}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ColorSwatches(): React.ReactElement {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
      {colorData.map((color) => (
        <div key={color.name} className="text-center">
          <div
            className="w-full aspect-square rounded-xl mb-2 shadow-sm"
            style={{ backgroundColor: color.hex }}
          />
          <p className="font-mono text-xs text-neutral-600">{color.hex}</p>
        </div>
      ))}
    </div>
  );
}

