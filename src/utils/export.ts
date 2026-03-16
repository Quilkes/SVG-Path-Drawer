import type { Shape, PolyShape } from '../types/editor';
import { buildPolySVGPath } from './shapeOps';

function fmt(n: number) { return +n.toFixed(3); }

function shapeToSVGElement(s: Shape, idx: number): string {
  const fill = s.fillType === 'gradient'
    ? `url(#g${idx})`
    : s.fillType === 'solid' ? s.fillColor : 'none';
  const stroke = s.strokeWidth > 0
    ? `stroke="${s.strokeColor}" stroke-width="${fmt(s.strokeWidth)}"`
    : `stroke="none"`;
  const base = `fill="${fill}" ${stroke} opacity="${fmt(s.opacity)}"`;

  if (s.kind === 'circle') {
    return `  <circle cx="${fmt(s.cx)}" cy="${fmt(s.cy)}" r="${fmt(s.r)}" ${base}/>\n`;
  }

  // poly
  const d = buildPolySVGPath(s);
  if (!d) return '';
  return `  <path d="${d}" ${base}/>\n`;
}

export function generateSVGString(shapes: Shape[], width: number, height: number): string {
  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n  <defs>\n`;

  shapes.forEach((s, i) => {
    if (s.fillType === 'gradient' && s.gradientStops?.length > 1) {
      if (s.kind === 'circle') {
        svg += `    <radialGradient id="g${i}">\n`;
      } else {
        svg += `    <linearGradient id="g${i}" x1="0%" y1="0%" x2="100%" y2="100%">\n`;
      }
      s.gradientStops.forEach(st => {
        svg += `      <stop offset="${(st.offset * 100).toFixed(1)}%" stop-color="${st.color}"/>\n`;
      });
      svg += `    </${s.kind === 'circle' ? 'radialGradient' : 'linearGradient'}>\n`;
    }
  });

  svg += `  </defs>\n`;
  shapes.forEach((s, i) => { svg += shapeToSVGElement(s, i); });
  svg += `</svg>`;
  return svg;
}

/** @deprecated use generateSVGString */
export function generateSVGPath(s: PolyShape): string {
  return buildPolySVGPath(s);
}
