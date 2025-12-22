#!/usr/bin/env node

/**
 * Split cloudsvg1.svg into 9 individual cloud sprites
 * Each cloud will be extracted to cloud-01.svg through cloud-09.svg
 */

const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../public/particles/cloudsvg1.svg');
const outputDir = path.join(__dirname, '../public/particles');

console.log('Reading source SVG...');
const svgContent = fs.readFileSync(inputPath, 'utf8');

// Extract the main <g> groups (each represents a cloud)
// The SVG has multiple <g> elements with clip paths
const groupRegex = /<g[^>]*clip-path="url\(#clipPath\d+\)"[^>]*>[\s\S]*?<\/g>/g;
const groups = svgContent.match(groupRegex);

if (!groups || groups.length === 0) {
  console.error('No cloud groups found in SVG');
  process.exit(1);
}

console.log(`Found ${groups.length} cloud groups`);

// Create individual SVG files
groups.forEach((group, index) => {
  const cloudNumber = String(index + 1).padStart(2, '0');
  const outputPath = path.join(outputDir, `cloud-${cloudNumber}.svg`);

  // Extract viewBox from original
  const viewBoxMatch = svgContent.match(/viewBox="([^"]*)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 1000 666';

  // Create a clean SVG with just this cloud
  const individualSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg
   version="1.1"
   viewBox="${viewBox}"
   xmlns="http://www.w3.org/2000/svg">
  ${group}
</svg>
`;

  fs.writeFileSync(outputPath, individualSvg, 'utf8');
  console.log(`Created: cloud-${cloudNumber}.svg`);
});

console.log(`\n✅ Successfully split ${groups.length} clouds!`);
console.log(`Output location: ${outputDir}/cloud-*.svg`);
