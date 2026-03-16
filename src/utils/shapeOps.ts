import type { Shape, PolyShape, Point, PointType } from "../types/editor";
import { dist, getWindingSign } from "./geometry";

// ─── Bounds ─────────────────────────────────────────────────────────────────
export function getShapeBounds(s: Shape) {
  if (!s) return null;
  if (s.kind === "circle") {
    return {
      minX: s.cx - s.r,
      minY: s.cy - s.r,
      maxX: s.cx + s.r,
      maxY: s.cy + s.r,
      w: s.r * 2,
      h: s.r * 2,
      cx: s.cx,
      cy: s.cy,
    };
  }
  if (!s.points.length) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  s.points.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  return {
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX,
    h: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

// ─── Move ────────────────────────────────────────────────────────────────────
export function moveShape(s: Shape, dx: number, dy: number): Partial<Shape> {
  if (s.kind === "circle") {
    return { cx: s.cx + dx, cy: s.cy + dy };
  }
  const points = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  const ctrlPoints: Record<number, Point> = {};
  Object.entries(s.ctrlPoints || {}).forEach(([k, v]) => {
    ctrlPoints[parseInt(k)] = { x: v.x + dx, y: v.y + dy };
  });
  // Also move basePoints so rounding stays correct after move
  const basePoints = s.basePoints
    ? s.basePoints.map((p) => ({ x: p.x + dx, y: p.y + dy }))
    : undefined;
  return { points, ctrlPoints, basePoints };
}

// ─── Scale ───────────────────────────────────────────────────────────────────
export function scaleShapeFromCenter(s: Shape, factor: number): Partial<Shape> {
  if (s.kind === "circle") {
    return { r: Math.max(4, s.r * factor) };
  }
  const b = getShapeBounds(s);
  if (!b) return {};
  const points = s.points.map((p) => ({
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
  const basePoints = s.basePoints
    ? s.basePoints.map((p) => ({
        x: b.cx + (p.x - b.cx) * factor,
        y: b.cy + (p.y - b.cy) * factor,
      }))
    : undefined;
  return { points, ctrlPoints, basePoints };
}

export function getRenderToBaseMap(shape: PolyShape): Map<number, number> {
  const renderToBase = new Map<number, number>();
  if (!shape.basePoints || !shape.cornerRadii) {
    for (let i = 0; i < shape.points.length; i++) {
      renderToBase.set(i, i);
    }
    return renderToBase;
  }

  const radii = shape.cornerRadii;
  let offset = 0;
  for (let baseIdx = 0; baseIdx < shape.basePoints.length; baseIdx++) {
    const r = radii[baseIdx] ?? 0;
    if (r > 0) {
      renderToBase.set(baseIdx + offset, baseIdx);
      renderToBase.set(baseIdx + offset + 1, baseIdx);
      offset += 1;
    } else {
      renderToBase.set(baseIdx + offset, baseIdx);
    }
  }
  return renderToBase;
}

// ─── Corner Radius (Quadratic Arc) ──────────────────────────────────────────
/**
 * Resolves all rounded corners in a single pass over the immutable base geometry.
 * This prevents sequential calculations from breaking adjacency tangents.
 */
function buildRoundedShape(
  base: Point[],
  baseTypes: PointType[],
  radii: Record<number, number>,
): {
  points: Point[];
  pointTypes: PointType[];
  ctrlPoints: Record<number, Point>;
} {
  const n = base.length;
  if (n < 3)
    return { points: [...base], pointTypes: [...baseTypes], ctrlPoints: {} };

  const newPts: Point[] = [];
  const newTypes: PointType[] = [];
  const newCtrl: Record<number, Point> = {};

  // Find tangent length for each corner.
  // We clamp so that adjacent corners don't consume more than the shared edge.
  for (let i = 0; i < n; i++) {
    const r = radii[i] || 0;
    if (r <= 0) {
      newPts.push(base[i]);
      newTypes.push(baseTypes[i]);
      continue;
    }

    const prevIdx = (i - 1 + n) % n;
    const nextIdx = (i + 1) % n;
    const prev = base[prevIdx];
    const curr = base[i];
    const next = base[nextIdx];

    const dPrev = dist(curr, prev);
    const dNext = dist(curr, next);

    // Clamp radius so it doesn't exceed 49% of either adjacent edge
    const rC = Math.min(r, dPrev * 0.49, dNext * 0.49);

    if (rC < 0.5) {
      newPts.push(curr);
      newTypes.push(baseTypes[i]);
      continue;
    }

    // Tangent points equidistant from the corner
    const p1: Point = {
      x: curr.x + ((prev.x - curr.x) / dPrev) * rC,
      y: curr.y + ((prev.y - curr.y) / dPrev) * rC,
    };
    const p2: Point = {
      x: curr.x + ((next.x - curr.x) / dNext) * rC,
      y: curr.y + ((next.y - curr.y) / dNext) * rC,
    };

    // p1 ends the incoming straight line
    newPts.push(p1);
    newTypes.push("straight"); // The line TO p1 is straight

    // p2 ends the curve line, using the original corner 'curr' as the control point
    newPts.push(p2);
    newTypes.push("curve");
    newCtrl[newPts.length - 1] = { x: curr.x, y: curr.y };
  }

  return { points: newPts, pointTypes: newTypes, ctrlPoints: newCtrl };
}

export function getBasePointTypes(s: PolyShape): PointType[] {
  if (!s.basePoints || !s.cornerRadii) return [...s.pointTypes];

  const renderToBase = getRenderToBaseMap(s);
  const baseToRender = new Map<number, number>();
  for (let rIdx = 0; rIdx < s.points.length; rIdx++) {
    const bIdx = renderToBase.get(rIdx);
    if (bIdx !== undefined && !baseToRender.has(bIdx)) {
      baseToRender.set(bIdx, rIdx);
    }
  }

  return s.basePoints.map((_, i) => {
    const rIdx = baseToRender.get(i);
    // Rounded entries are generated from straight base corners.
    if ((s.cornerRadii![i] || 0) > 0) return "straight";
    return rIdx !== undefined ? s.pointTypes[rIdx] : "straight";
  });
}

export function rebuildRoundedFromBase(
  base: Point[],
  baseTypes: PointType[],
  radii: Record<number, number>,
): {
  points: Point[];
  pointTypes: PointType[];
  ctrlPoints: Record<number, Point>;
} {
  return buildRoundedShape(base, baseTypes, radii);
}

function applyCornerRadiusLocally(
  s: PolyShape,
  idx: number,
  r: number,
): PolyShape {
  const n = s.points.length;
  if (n < 3 || idx < 0 || idx >= n) return s;

  const prevIdx = (idx - 1 + n) % n;
  const nextIdx = (idx + 1) % n;
  const prev = s.points[prevIdx];
  const curr = s.points[idx];
  const next = s.points[nextIdx];

  const dPrev = dist(curr, prev);
  const dNext = dist(curr, next);
  if (dPrev < 0.001 || dNext < 0.001) return s;

  const rC = Math.max(0, Math.min(r, dPrev * 0.49, dNext * 0.49));
  if (rC < 0.5) return s;

  const p1: Point = {
    x: curr.x + ((prev.x - curr.x) / dPrev) * rC,
    y: curr.y + ((prev.y - curr.y) / dPrev) * rC,
  };
  const p2: Point = {
    x: curr.x + ((next.x - curr.x) / dNext) * rC,
    y: curr.y + ((next.y - curr.y) / dNext) * rC,
  };

  const points = [...s.points];
  const pointTypes = [...s.pointTypes];
  points.splice(idx, 1, p1, p2);
  pointTypes.splice(idx, 1, "straight", "curve");

  const ctrlPoints: Record<number, Point> = {};
  Object.entries(s.ctrlPoints || {}).forEach(([k, v]) => {
    const ki = parseInt(k, 10);
    if (ki < idx) ctrlPoints[ki] = v;
    else if (ki > idx) ctrlPoints[ki + 1] = v;
  });
  ctrlPoints[idx + 1] = { x: curr.x, y: curr.y };

  return { ...s, points, pointTypes, ctrlPoints };
}

export function rebuildPolyFromBase(
  s: PolyShape,
  basePoints: Point[],
  baseTypes: PointType[],
  cornerRadii: Record<number, number>,
): PolyShape {
  const maxIdx = basePoints.length - 1;
  const cleanRadii: Record<number, number> = {};
  Object.entries(cornerRadii).forEach(([k, v]) => {
    const idx = parseInt(k, 10);
    if (Number.isInteger(idx) && idx >= 0 && idx <= maxIdx && v > 0) {
      cleanRadii[idx] = v;
    }
  });

  if (!Object.keys(cleanRadii).length) {
    return {
      ...s,
      points: [...basePoints],
      pointTypes: [...baseTypes],
      ctrlPoints: {},
      basePoints: undefined,
      cornerRadii: undefined,
    };
  }

  const rebuilt = rebuildRoundedFromBase(basePoints, baseTypes, cleanRadii);
  return {
    ...s,
    ...rebuilt,
    basePoints: [...basePoints],
    cornerRadii: cleanRadii,
  };
}

export function applyCornerRadius(
  s: PolyShape,
  idx: number,
  r: number,
): PolyShape {
  const n = s.points.length;
  if (n < 3) return s;

  // Legacy/edited curve-only paths may not have basePoints metadata.
  // In that case, apply locally so existing curved edges are preserved.
  const hasLegacyCurveData =
    !s.basePoints &&
    (s.pointTypes.some((t) => t === "curve") ||
      Object.keys(s.ctrlPoints || {}).length > 0);
  if (hasLegacyCurveData) {
    return applyCornerRadiusLocally(s, idx, r);
  }

  const base = s.basePoints ?? [...s.points];
  const baseTypes = getBasePointTypes(s);

  const radii: Record<number, number> = { ...(s.cornerRadii ?? {}), [idx]: r };

  return rebuildPolyFromBase(s, base, baseTypes, radii);
}

// ─── Path builder (canvas) ────────────────────────────────────────────────────
/**
 * Builds the 2D canvas path for a poly shape using cubic bezier segments.
 * Both ctrl handles per segment are stored as ctrlPoints[i] for each point i.
 * We use quadratic when only one handle is available.
 */
export function buildPolyCanvasPath(
  ctx: CanvasRenderingContext2D,
  s: PolyShape,
) {
  const { points: pts, pointTypes: types, ctrlPoints: ctrl } = s;
  const n = pts.length;
  if (n < 2) return;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  for (let i = 1; i < n; i++) {
    if (types[i] === "curve") {
      const cp = ctrl[i];
      if (cp) {
        ctx.quadraticCurveTo(cp.x, cp.y, pts[i].x, pts[i].y);
      } else {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
    } else {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
  }

  // Close segment back to point 0
  if (types[0] === "curve") {
    const cp = ctrl[0];
    if (cp) {
      ctx.quadraticCurveTo(cp.x, cp.y, pts[0].x, pts[0].y);
    } else {
      ctx.lineTo(pts[0].x, pts[0].y);
    }
  }
  ctx.closePath();
}

// ─── SVG path data builder (for export) ─────────────────────────────────────
export function buildPolySVGPath(s: PolyShape): string {
  const { points: pts, pointTypes: types, ctrlPoints: ctrl } = s;
  const n = pts.length;
  if (n < 2) return "";

  const fmt = (v: number) => +v.toFixed(3);

  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < n; i++) {
    if (types[i] === "curve" && ctrl[i]) {
      d += ` Q ${fmt(ctrl[i].x)} ${fmt(ctrl[i].y)} ${fmt(pts[i].x)} ${fmt(pts[i].y)}`;
    } else {
      d += ` L ${fmt(pts[i].x)} ${fmt(pts[i].y)}`;
    }
  }
  if (types[0] === "curve" && ctrl[0]) {
    d += ` Q ${fmt(ctrl[0].x)} ${fmt(ctrl[0].y)} ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  }
  d += " Z";
  return d;
}

// ─── Void exports (keep geometry helpers re-exported for convenience) ─────────
export { dist, getWindingSign };
