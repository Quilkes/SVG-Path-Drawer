import type { Point, Shape, GuideLine } from '../types/editor';

export function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function getWindingSign(pts: Point[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y);
  }
  return area >= 0 ? 1 : -1;
}

export function getShapeBounds(s: Shape) {
  if (!s || !s.points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  s.points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  return {
    minX, minY, maxX, maxY,
    w: maxX - minX,
    h: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2
  };
}

const GUIDE_THRESH = 8;

export function computeGuides(s: Shape | null, mx: number, my: number, movingSet?: Set<number>): GuideLine[] {
  if (!s) return [];
  const g: GuideLine[] = [];
  s.points.forEach((pt, idx) => {
    if (movingSet && movingSet.has(idx)) return;
    if (Math.abs(my - pt.y) < GUIDE_THRESH * 2) g.push({ type: 'h', y: pt.y });
    if (Math.abs(mx - pt.x) < GUIDE_THRESH * 2) g.push({ type: 'v', x: pt.x });
  });
  return g;
}

export function applyGuideSnap(x: number, y: number, guides: GuideLine[]) {
  let sx = x, sy = y;
  for (const g of guides) {
    if (g.type === 'h' && g.y !== undefined && Math.abs(y - g.y) < GUIDE_THRESH) sy = g.y;
    if (g.type === 'v' && g.x !== undefined && Math.abs(x - g.x) < GUIDE_THRESH) sx = g.x;
  }
  return { x: sx, y: sy };
}

export function snapPoint(x: number, y: number, snapToGrid: boolean) {
  if (!snapToGrid) return { x, y };
  const g = 20;
  return { x: Math.round(x / g) * g, y: Math.round(y / g) * g };
}
