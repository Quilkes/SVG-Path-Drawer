import type { Shape, Point, PointType } from '../types/editor';
import { dist, getWindingSign } from './geometry';

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

export function moveShape(s: Shape, dx: number, dy: number): Partial<Shape> {
  const points = s.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
  const ctrlPoints: Record<number, Point> = {};
  Object.entries(s.ctrlPoints || {}).forEach(([k, v]) => {
    ctrlPoints[parseInt(k)] = { x: v.x + dx, y: v.y + dy };
  });
  return { points, ctrlPoints };
}

export function scaleShapeFromCenter(s: Shape, factor: number): Partial<Shape> {
  const b = getShapeBounds(s);
  if (!b) return {};
  const points = s.points.map(p => ({
    x: b.cx + (p.x - b.cx) * factor,
    y: b.cy + (p.y - b.cy) * factor,
  }));
  const ctrlPoints: Record<number, Point> = {};
  Object.entries(s.ctrlPoints || {}).forEach(([k, v]) => {
    ctrlPoints[parseInt(k)] = {
      x: b.cx + (v.x - b.cx) * factor,
      y: b.cy + (v.y - b.cy) * factor,
    };
  });
  return { points, ctrlPoints };
}

/** Low-level: given a flat array of base points and types, insert the rounded arc for corner `idx`. */
function applyOneCorner(
  points: Point[],
  pointTypes: PointType[],
  ctrlPoints: Record<number, Point>,
  idx: number,
  r: number,
): { points: Point[]; pointTypes: PointType[]; ctrlPoints: Record<number, Point> } {
  const n = points.length;
  const prevIdx = (idx - 1 + n) % n;
  const nextIdx = (idx + 1) % n;
  const prev = points[prevIdx];
  const curr = points[idx];
  const next = points[nextIdx];
  const dPrev = dist(curr, prev);
  const dNext = dist(curr, next);
  if (dPrev < 1 || dNext < 1) return { points, pointTypes, ctrlPoints };
  const rC = Math.min(r, dPrev * 0.45, dNext * 0.45);
  if (rC < 1) return { points, pointTypes, ctrlPoints };

  const p1 = { x: curr.x + (prev.x - curr.x) / dPrev * rC, y: curr.y + (prev.y - curr.y) / dPrev * rC };
  const p2 = { x: curr.x + (next.x - curr.x) / dNext * rC, y: curr.y + (next.y - curr.y) / dNext * rC };

  const newPts = [...points];
  const newTypes = [...pointTypes];
  newPts.splice(idx, 1, p1, p2);
  newTypes.splice(idx, 1, 'straight', 'curve');

  const newCtrl: Record<number, Point> = {};
  Object.entries(ctrlPoints).forEach(([k, v]) => {
    const ki = parseInt(k);
    if (ki < idx) newCtrl[ki] = v;
    else if (ki > idx) newCtrl[ki + 1] = v;
  });
  newCtrl[idx + 1] = { x: curr.x, y: curr.y };

  return { points: newPts, pointTypes: newTypes, ctrlPoints: newCtrl };
}

/** 
 * Rebuild the full set of rendered points from basePoints + cornerRadii.
 * Since each rounded corner inserts +1 point, we process corners in reverse
 * index order so earlier indices remain stable.
 */
function buildRoundedShape(base: Point[], baseTypes: PointType[], radii: Record<number, number>): {
  points: Point[];
  pointTypes: PointType[];
  ctrlPoints: Record<number, Point>;
} {
  let pts = [...base];
  let types = [...baseTypes];
  let ctrl: Record<number, Point> = {};

  // Sort descending so higher indices don't shift lower ones
  const sortedIndices = Object.keys(radii)
    .map(Number)
    .sort((a, b) => b - a);

  for (const idx of sortedIndices) {
    const r = radii[idx];
    if (r > 0) {
      ({ points: pts, pointTypes: types, ctrlPoints: ctrl } = applyOneCorner(pts, types, ctrl, idx, r));
    }
  }

  return { points: pts, pointTypes: types, ctrlPoints: ctrl };
}

export function applyCornerRadius(s: Shape, idx: number, r: number): Shape {
  const n = s.points.length;
  if (n < 3) return s;

  // On first rounding, snapshot the base geometry
  const base = s.basePoints ?? [...s.points];
  const baseTypes = s.pointTypes.slice(0, base.length); // original length
  const radii: Record<number, number> = { ...(s.cornerRadii ?? {}), [idx]: r };

  const { points, pointTypes, ctrlPoints } = buildRoundedShape(base, baseTypes, radii);

  return { ...s, points, pointTypes, ctrlPoints, basePoints: base, cornerRadii: radii };
}


export function applyEdgeBulge(s: Shape, i: number, j: number, bulge: number): Shape {
  const n = s.points.length;
  const a = s.points[i], b = s.points[j < n ? j : 0];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return s;
  const winding = getWindingSign(s.points);
  const nx = -dy / len, ny = dx / len;
  const outward = winding >= 0 ? 1 : -1;
  const scale = len * 0.5;
  const ctrl = {
    x: mx + nx * outward * (bulge / 100) * scale,
    y: my + ny * outward * (bulge / 100) * scale,
  };

  const insertAt = i + 1;
  const mid = { x: mx, y: my };
  const points = [...s.points];
  const pointTypes = [...s.pointTypes];
  points.splice(insertAt, 0, mid);
  pointTypes.splice(insertAt, 0, 'curve');

  const newCtrl: Record<number, Point> = {};
  Object.entries(s.ctrlPoints || {}).forEach(([k, v]) => {
    const ki = parseInt(k);
    if (ki <= i) newCtrl[ki] = v;
    else newCtrl[ki + 1] = v;
  });
  newCtrl[insertAt] = ctrl;

  return { ...s, points, pointTypes, ctrlPoints: newCtrl };
}
