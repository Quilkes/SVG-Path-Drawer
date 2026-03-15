import type { GradientStop } from '../types/editor';

// Default style when creating new shapes (can wire to style panel later)
let defaultStyle = {
  fillColor: '#e87d0d',
  strokeColor: '#c8c8c8',
  strokeWidth: 1.5,
  opacity: 0.7,
  fillType: 'solid' as const,
  gradientStops: [] as GradientStop[],
};

export function setDefaultStyle(updates: Partial<typeof defaultStyle>) {
  defaultStyle = { ...defaultStyle, ...updates };
}

export function getStyleFromPanel() {
  return { ...defaultStyle };
}
