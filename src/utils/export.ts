import type { Shape } from '../types/editor';

export function generateSVGPath(s: Shape): string {
  const pts = s.points;
  const types = s.pointTypes;
  const ctrl = s.ctrlPoints || {};
  const n = pts.length;
  
  if (n < 2) return '';
  
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  
  for (let i = 1; i < n; i++) {
    if (types[i] === 'curve') {
      const cp = ctrl[i];
      if (cp) {
        d += ` Q ${cp.x.toFixed(2)} ${cp.y.toFixed(2)} ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
      } else {
        d += ` Q ${pts[i - 1].x.toFixed(2)} ${pts[i - 1].y.toFixed(2)} ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
      }
    } else {
      d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    }
  }
  
  // Closing segment
  if (types[0] === 'curve') {
    const cp = ctrl[0];
    if (cp) {
      d += ` Q ${cp.x.toFixed(2)} ${cp.y.toFixed(2)} ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    } else {
      d += ` Q ${pts[n - 1].x.toFixed(2)} ${pts[n - 1].y.toFixed(2)} ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    }
  }
  
  return d + ' Z';
}

export function generateSVGString(shapes: Shape[], width: number, height: number): string {
  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">\n  <defs>\n`;
  
  shapes.forEach((s, i) => {
    if (s.fillType === 'gradient' && s.gradientStops && s.gradientStops.length > 1) {
      svg += `    <linearGradient id="g${i}" x1="0%" y1="0%" x2="100%" y2="100%">\n`;
      s.gradientStops.forEach(st => {
        svg += `      <stop offset="${(st.offset * 100).toFixed(1)}%" stop-color="${st.color}"/>\n`;
      });
      svg += `    </linearGradient>\n`;
    }
  });
  
  svg += `  </defs>\n`;
  
  shapes.forEach((s, i) => {
    const d = generateSVGPath(s);
    if (!d) return;
    
    const fill = s.fillType === 'gradient' ? `url(#g${i})` : s.fillType === 'solid' ? s.fillColor : 'none';
    const stroke = s.strokeWidth > 0 ? `stroke="${s.strokeColor}" stroke-width="${s.strokeWidth}"` : `stroke="none"`;
    
    svg += `  <path d="${d}" fill="${fill}" ${stroke} opacity="${s.opacity}"/>\n`;
  });
  
  svg += `</svg>`;
  return svg;
}

