import { useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "../../store/useEditorStore";
import type { Shape, PolyShape, Point, GuideLine } from "../../types/editor";
import { computeGuides, applyGuideSnap, snapPoint } from "../../utils/geometry";
import {
  moveShape,
  scaleShapeFromCenter,
  buildPolyCanvasPath,
  getRenderToBaseMap,
  getBasePointTypes,
  rebuildRoundedFromBase,
} from "../../utils/shapeOps";

// ─── Canvas transform helpers ─────────────────────────────────────────────────
interface Transform {
  zoom: number;
  panX: number;
  panY: number;
}

function toWorld(sx: number, sy: number, t: Transform): Point {
  return {
    x: (sx - t.panX) / t.zoom,
    y: (sy - t.panY) / t.zoom,
  };
}

function toScreen(wx: number, wy: number, t: Transform): Point {
  return { x: wx * t.zoom + t.panX, y: wy * t.zoom + t.panY };
}

function getTransform(): Transform {
  const { viewState } = useEditorStore.getState();
  return { zoom: viewState.zoom, panX: viewState.panX, panY: viewState.panY };
}

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ─── Drag / interaction refs (avoid React re-renders during drag) ──────────
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const isBoxSelectingRef = useRef(false);
  const boxStartRef = useRef<Point | null>(null);
  const boxEndRef = useRef<Point | null>(null);
  const hoveredPtRef = useRef<number | null>(null);
  const draggingCtrlIdxRef = useRef<number | null>(null);
  const grabModeRef = useRef(false);
  const grabStartPosRef = useRef<Point | null>(null);
  const grabStartPtsRef = useRef<Point[]>([]);
  const grabStartBasePtsRef = useRef<Point[]>([]);
  const grabAxisRef = useRef<"none" | "x" | "y">("none");
  const guideLinesRef = useRef<GuideLine[]>([]);
  // Pan
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const panStartOffsetRef = useRef<Point>({ x: 0, y: 0 });
  // Circle resize
  const isCircleResizingRef = useRef(false);
  const circleResizeIdRef = useRef<number | null>(null);

  // ─── Build poly path (with transform) ─────────────────────────────────────
  const buildTransformedPolyPath = useCallback(
    (ctx: CanvasRenderingContext2D, s: PolyShape, t: Transform) => {
      const { points: pts, pointTypes: types, ctrlPoints: ctrl } = s;
      const n = pts.length;
      if (n < 2) return;

      const ts = (p: Point) => toScreen(p.x, p.y, t);

      ctx.beginPath();
      const p0 = ts(pts[0]);
      ctx.moveTo(p0.x, p0.y);

      for (let i = 1; i < n; i++) {
        const pi = ts(pts[i]);
        if (types[i] === "curve" && ctrl[i]) {
          const cp = ts(ctrl[i]);
          ctx.quadraticCurveTo(cp.x, cp.y, pi.x, pi.y);
        } else {
          ctx.lineTo(pi.x, pi.y);
        }
      }
      // Close back to p0
      if (types[0] === "curve" && ctrl[0]) {
        const cp = ts(ctrl[0]);
        ctx.quadraticCurveTo(cp.x, cp.y, p0.x, p0.y);
      } else {
        ctx.lineTo(p0.x, p0.y);
      }
      ctx.closePath();
    },
    [],
  );

  // ─── World-space hit-test poly path (ignores transform) ───────────────────
  const buildWorldPolyPath = useCallback(
    (ctx: CanvasRenderingContext2D, s: PolyShape) => {
      buildPolyCanvasPath(ctx, s);
    },
    [],
  );

  // ─── Main draw ────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { shapes, activeId, selectedPointIndices, viewState, mode } =
      useEditorStore.getState();
    const t: Transform = {
      zoom: viewState.zoom,
      panX: viewState.panX,
      panY: viewState.panY,
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── Grid dots ──
    if (viewState.snapToGrid) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let x = t.panX % (20 * t.zoom); x < canvas.width; x += 20 * t.zoom) {
        for (
          let y = t.panY % (20 * t.zoom);
          y < canvas.height;
          y += 20 * t.zoom
        ) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ── Shapes ──
    shapes.forEach((s) =>
      drawShape(
        ctx,
        s,
        s.id === activeId,
        selectedPointIndices,
        canvas,
        t,
        mode,
      ),
    );

    // ── Guides ──
    if (
      viewState.showGuides &&
      (isDraggingRef.current || grabModeRef.current) &&
      guideLinesRef.current.length
    ) {
      ctx.save();
      ctx.strokeStyle = "rgba(74,205,204,0.8)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      guideLinesRef.current.forEach((g) => {
        ctx.beginPath();
        if (g.type === "h") {
          const sy = g.y! * t.zoom + t.panY;
          ctx.moveTo(0, sy);
          ctx.lineTo(canvas.width, sy);
        } else {
          const sx = g.x! * t.zoom + t.panX;
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, canvas.height);
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Box select ──
    if (isBoxSelectingRef.current && boxStartRef.current && boxEndRef.current) {
      const bw = boxEndRef.current.x - boxStartRef.current.x;
      const bh = boxEndRef.current.y - boxStartRef.current.y;
      ctx.strokeStyle = "#4a9eff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = "rgba(74,158,255,0.07)";
      ctx.fillRect(boxStartRef.current.x, boxStartRef.current.y, bw, bh);
      ctx.strokeRect(boxStartRef.current.x, boxStartRef.current.y, bw, bh);
      ctx.setLineDash([]);
    }

    // ── Axis lock indicator ──
    if (
      grabModeRef.current &&
      grabAxisRef.current !== "none" &&
      grabStartPosRef.current
    ) {
      const lock = grabAxisRef.current;
      ctx.save();
      ctx.strokeStyle =
        lock === "x" ? "rgba(255,80,80,0.7)" : "rgba(80,255,120,0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const sp = toScreen(
        grabStartPosRef.current.x,
        grabStartPosRef.current.y,
        t,
      );
      if (lock === "x") {
        ctx.moveTo(0, sp.y);
        ctx.lineTo(canvas.width, sp.y);
      } else {
        ctx.moveTo(sp.x, 0);
        ctx.lineTo(sp.x, canvas.height);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Zoom label ──
    if (Math.abs(t.zoom - 1) > 0.01) {
      ctx.fillStyle = "rgba(160,160,160,0.5)";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.textAlign = "right";
      ctx.fillText(
        `${Math.round(t.zoom * 100)}%`,
        canvas.width - 60,
        canvas.height - 12,
      );
    }
  }, [buildTransformedPolyPath]);

  function drawShape(
    ctx: CanvasRenderingContext2D,
    s: Shape,
    isActive: boolean,
    selectedPointIndices: Set<number>,
    canvas: HTMLCanvasElement,
    t: Transform,
    mode: string,
  ) {
    ctx.save();
    ctx.globalAlpha = s.opacity;

    if (s.kind === "circle") {
      const sc = toScreen(s.cx, s.cy, t);
      const sr = s.r * t.zoom;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, sr, 0, Math.PI * 2);
      if (s.fillType === "solid") {
        ctx.fillStyle = s.fillColor;
        ctx.fill();
      } else if (s.fillType === "gradient" && s.gradientStops?.length > 1) {
        const g = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, sr);
        s.gradientStops.forEach((st) => g.addColorStop(st.offset, st.color));
        ctx.fillStyle = g;
        ctx.fill();
      }
      if (s.strokeWidth > 0) {
        ctx.globalAlpha = Math.min(s.opacity + 0.2, 1);
        ctx.strokeStyle = s.strokeColor;
        ctx.lineWidth = s.strokeWidth;
        ctx.stroke();
      }
      ctx.restore();

      if (!isActive) return;
      // Circle handles: center + 4 cardinal resize handles
      ctx.save();
      const handles = [
        { x: s.cx, y: s.cy, label: "C" }, // center
        { x: s.cx + s.r, y: s.cy, label: "→" }, // right
        { x: s.cx - s.r, y: s.cy, label: "←" }, // left
        { x: s.cx, y: s.cy - s.r, label: "↑" }, // top
        { x: s.cx, y: s.cy + s.r, label: "↓" }, // bottom
      ];
      handles.forEach((h, i) => {
        const sp = toScreen(h.x, h.y, t);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, i === 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#4a9eff" : "#e8c93a";
        ctx.fill();
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      ctx.restore();
      return;
    }

    // ── Poly shape ──
    buildTransformedPolyPath(ctx, s, t);

    if (s.fillType === "gradient" && s.gradientStops?.length > 1) {
      const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      s.gradientStops.forEach((st) => g.addColorStop(st.offset, st.color));
      ctx.fillStyle = g;
      ctx.fill();
    } else if (s.fillType === "solid") {
      ctx.fillStyle = s.fillColor;
      ctx.fill();
    }
    if (s.strokeWidth > 0) {
      ctx.globalAlpha = Math.min(s.opacity + 0.2, 1);
      ctx.strokeStyle = s.strokeColor;
      ctx.lineWidth = s.strokeWidth;
      ctx.stroke();
    }
    ctx.restore();

    if (!isActive) return;

    const showEditOverlay =
      mode === "edit" &&
      (selectedPointIndices.size > 0 ||
        hoveredPtRef.current !== null ||
        draggingCtrlIdxRef.current !== null ||
        isDraggingRef.current ||
        grabModeRef.current);

    if (showEditOverlay) {
      // ── Skeleton ──
      ctx.save();
      ctx.strokeStyle = "rgba(74,158,255,0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      s.points.forEach((pt, i) => {
        const sp = toScreen(pt.x, pt.y, t);
        i === 0 ? ctx.moveTo(sp.x, sp.y) : ctx.lineTo(sp.x, sp.y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Ctrl point lines ──
      const ctrl = s.ctrlPoints || {};
      ctx.strokeStyle = "rgba(74,205,204,0.25)";
      ctx.lineWidth = 1;
      Object.entries(ctrl).forEach(([k, cp]) => {
        const idx = parseInt(k);
        if (idx >= s.points.length) return;
        const pt = s.points[idx];
        const prevIdx = (idx - 1 + s.points.length) % s.points.length;
        const prev = s.points[prevIdx];
        const sp = toScreen(pt.x, pt.y, t);
        const scp = toScreen(cp.x, cp.y, t);
        const sprev = toScreen(prev.x, prev.y, t);
        ctx.beginPath();
        ctx.moveTo(scp.x, scp.y);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(scp.x, scp.y);
        ctx.lineTo(sprev.x, sprev.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(scp.x, scp.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(74,205,204,0.7)";
        ctx.fill();
      });
      ctx.restore();
    }

    // ── Point handles ──
    s.points.forEach((pt, idx) => {
      const isSel = selectedPointIndices.has(idx);
      const isHov = idx === hoveredPtRef.current;
      const r = isSel ? 7 : 5;
      const sp = toScreen(pt.x, pt.y, t);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      if (isSel) ctx.fillStyle = "#e05252";
      else if (isHov) ctx.fillStyle = "#5fb94a";
      else
        ctx.fillStyle =
          s.pointTypes[idx] === "straight" ? "#e8c93a" : "#4a9eff";
      ctx.fill();
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(200,200,200,0.45)";
      ctx.font = "9px JetBrains Mono,monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(idx + 1), sp.x, sp.y - 14);
    });
  }

  // ─── Hit tests (in screen space) ──────────────────────────────────────────
  function getPointAt(sx: number, sy: number): number | null {
    const { shapes, activeId } = useEditorStore.getState();
    const s = shapes.find((sh) => sh.id === activeId);
    if (!s || s.kind !== "poly") return null;
    const t = getTransform();
    const HIT = 10;
    for (let i = s.points.length - 1; i >= 0; i--) {
      const sp = toScreen(s.points[i].x, s.points[i].y, t);
      if (Math.hypot(sx - sp.x, sy - sp.y) < HIT) return i;
    }
    return null;
  }

  function getCtrlPointAt(sx: number, sy: number): number | null {
    const { shapes, activeId } = useEditorStore.getState();
    const s = shapes.find((sh) => sh.id === activeId);
    if (!s || s.kind !== "poly") return null;
    const t = getTransform();
    const ctrl = s.ctrlPoints || {};
    const HIT = 10;

    for (let i = s.points.length - 1; i >= 0; i--) {
      const cp = ctrl[i];
      if (!cp) continue;
      const scp = toScreen(cp.x, cp.y, t);
      if (Math.hypot(sx - scp.x, sy - scp.y) < HIT) return i;
    }
    return null;
  }

  function getEdgeAt(
    sx: number,
    sy: number,
  ): { edgeIdx: number; x: number; y: number } | null {
    const { shapes, activeId } = useEditorStore.getState();
    const s = shapes.find((sh) => sh.id === activeId);
    if (!s || s.kind !== "poly") return null;
    const t = getTransform();
    const pts = s.points;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = toScreen(pts[i].x, pts[i].y, t);
      const b = toScreen(pts[(i + 1) % n].x, pts[(i + 1) % n].y, t);
      const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      if (lenSq === 0) continue;
      const tVal = Math.max(
        0,
        Math.min(
          1,
          ((sx - a.x) * (b.x - a.x) + (sy - a.y) * (b.y - a.y)) / lenSq,
        ),
      );
      const cx = a.x + (b.x - a.x) * tVal;
      const cy = a.y + (b.y - a.y) * tVal;
      if (Math.hypot(sx - cx, sy - cy) < 8) {
        const w = toWorld(cx, cy, t);
        return { edgeIdx: i, x: w.x, y: w.y };
      }
    }
    return null;
  }

  function getShapeAt(sx: number, sy: number): number | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const { shapes } = useEditorStore.getState();
    const t = getTransform();
    const w = toWorld(sx, sy, t);

    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.kind === "circle") {
        if (Math.hypot(w.x - s.cx, w.y - s.cy) <= s.r) return s.id;
        continue;
      }
      if (s.points.length < 3) continue;
      ctx.save();
      buildWorldPolyPath(ctx, s);
      const hit = ctx.isPointInPath(w.x, w.y);
      ctx.restore();
      if (hit) return s.id;
    }
    return null;
  }

  /** -1=center, 0..3 = cardinal handle index */
  function getCircleHandleAt(sx: number, sy: number, s: Shape): number | null {
    if (s.kind !== "circle") return null;
    const t = getTransform();
    const handles = [
      { x: s.cx, y: s.cy },
      { x: s.cx + s.r, y: s.cy },
      { x: s.cx - s.r, y: s.cy },
      { x: s.cx, y: s.cy - s.r },
      { x: s.cx, y: s.cy + s.r },
    ];
    for (let i = 0; i < handles.length; i++) {
      const sp = toScreen(handles[i].x, handles[i].y, t);
      if (Math.hypot(sx - sp.x, sy - sp.y) < 10) return i;
    }
    return null;
  }

  function processWorldPos(
    wx: number,
    wy: number,
    movingSet?: Set<number>,
  ): Point {
    const { viewState, shapes, activeId } = useEditorStore.getState();
    const s = shapes.find((sh) => sh.id === activeId);
    const polyS = s?.kind === "poly" ? s : null;
    let p = snapPoint(wx, wy, viewState.snapToGrid);
    if (viewState.showGuides && polyS) {
      guideLinesRef.current = computeGuides(polyS, p.x, p.y, movingSet);
      p = applyGuideSnap(p.x, p.y, guideLinesRef.current);
    }
    return p;
  }

  // ─── Mouse handlers ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getXY = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { viewState, setViewState } = useEditorStore.getState();
      const { sx, sy } = getXY(e as unknown as MouseEvent);

      if (e.ctrlKey || e.metaKey) {
        // Zoom toward cursor
        const factor = e.deltaY < 0 ? 1.1 : 0.909;
        const newZoom = Math.max(0.08, Math.min(40, viewState.zoom * factor));
        const scaleChange = newZoom / viewState.zoom;
        const newPanX = sx - (sx - viewState.panX) * scaleChange;
        const newPanY = sy - (sy - viewState.panY) * scaleChange;
        setViewState({ zoom: newZoom, panX: newPanX, panY: newPanY });
      } else {
        // Pan
        setViewState({
          panX: viewState.panX - e.deltaX,
          panY: viewState.panY - e.deltaY,
        });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const { sx, sy } = getXY(e);
      const t = getTransform();
      const { x: wx, y: wy } = toWorld(sx, sy, t);

      const pill = document.getElementById("coords-pill");
      if (pill) pill.textContent = `${Math.round(wx)}, ${Math.round(wy)}`;

      const { mode, shapes, activeId, selectedPointIndices, updateShape } =
        useEditorStore.getState();
      const s = shapes.find((sh) => sh.id === activeId);

      // ── Pan dragging ──
      if (isPanningRef.current) {
        const { setViewState } = useEditorStore.getState();
        setViewState({
          panX: panStartOffsetRef.current.x + (sx - panStartRef.current.x),
          panY: panStartOffsetRef.current.y + (sy - panStartRef.current.y),
        });
        redraw();
        return;
      }

      // ── Circle resize ──
      if (
        isCircleResizingRef.current &&
        circleResizeIdRef.current !== null &&
        s &&
        s.kind === "circle"
      ) {
        const w = toWorld(sx, sy, t);
        const newR = Math.max(4, Math.hypot(w.x - s.cx, w.y - s.cy));
        updateShape(s.id, { r: newR });
        redraw();
        return;
      }

      // ── Grab mode ──
      if (
        grabModeRef.current &&
        selectedPointIndices.size > 0 &&
        s &&
        s.kind === "poly"
      ) {
        if (!grabStartPosRef.current) {
          grabStartPosRef.current = { x: wx, y: wy };
          return;
        }
        let dx = wx - grabStartPosRef.current.x;
        let dy = wy - grabStartPosRef.current.y;
        // Axis lock
        if (grabAxisRef.current === "x") dy = 0;
        if (grabAxisRef.current === "y") dx = 0;

        const newPoints = [...s.points];
        const newBasePoints = s.basePoints ? [...s.basePoints] : undefined;
        const renderToBase = newBasePoints ? getRenderToBaseMap(s) : undefined;
        const processedBases = new Set<number>();

        Array.from(selectedPointIndices).forEach((idx, i) => {
          const base = grabStartPtsRef.current[i];
          if (!base) return;
          const snapped = processWorldPos(
            base.x + dx,
            base.y + dy,
            selectedPointIndices,
          );
          newPoints[idx] = snapped;

          // Also update basePoints for the corresponding indices to prevent snap-back
          if (newBasePoints && renderToBase) {
            const baseIdx = renderToBase.get(idx);
            if (baseIdx !== undefined && !processedBases.has(baseIdx)) {
              processedBases.add(baseIdx);
              // Use the cached base point from grab start to prevent exponential adding
              const startBase = grabStartBasePtsRef.current[baseIdx];
              if (startBase && s.basePoints?.[baseIdx]) {
                newBasePoints[baseIdx] = {
                  x: startBase.x + dx,
                  y: startBase.y + dy,
                };
              }
            }
          }
        });
        updateShape(s.id, {
          points: newPoints,
          ...(newBasePoints ? { basePoints: newBasePoints } : {}),
        });
        redraw();
        return;
      }

      // ── Box select ──
      if (isBoxSelectingRef.current) {
        boxEndRef.current = { x: sx, y: sy };
        redraw();
        return;
      }

      // ── Move mode drag ──
      if (isDraggingRef.current && mode === "move" && s) {
        const dsx = sx - dragOffsetRef.current.x;
        const dsy = sy - dragOffsetRef.current.y;
        const dx = dsx / t.zoom,
          dy = dsy / t.zoom;
        const updated = moveShape(s, dx, dy);
        updateShape(s.id, updated);
        dragOffsetRef.current = { x: sx, y: sy };
        redraw();
        return;
      }

      // ── Scale mode drag ──
      if (isDraggingRef.current && mode === "scale" && s) {
        const dsx = sx - dragOffsetRef.current.x;
        const factor = 1 + dsx * 0.005;
        const updated = scaleShapeFromCenter(s, factor);
        updateShape(s.id, updated);
        dragOffsetRef.current = { x: sx, y: sy };
        redraw();
        return;
      }

      // ── Edit mode point drag ──
      if (isDraggingRef.current && mode === "edit" && s && s.kind === "poly") {
        if (draggingCtrlIdxRef.current !== null) {
          const idx = draggingCtrlIdxRef.current;
          const nextCtrl = {
            ...(s.ctrlPoints || {}),
            [idx]: toWorld(sx, sy, t),
          };
          updateShape(s.id, { ctrlPoints: nextCtrl });
          dragOffsetRef.current = { x: sx, y: sy };
          redraw();
          return;
        }

        const dx = (sx - dragOffsetRef.current.x) / t.zoom;
        const dy = (sy - dragOffsetRef.current.y) / t.zoom;
        const newPoints = [...s.points];
        const newBasePoints = s.basePoints ? [...s.basePoints] : undefined;
        const renderToBase = newBasePoints ? getRenderToBaseMap(s) : undefined;
        const processedBases = new Set<number>();

        selectedPointIndices.forEach((idx) => {
          const snapped = processWorldPos(
            s.points[idx].x + dx,
            s.points[idx].y + dy,
            selectedPointIndices,
          );
          newPoints[idx] = snapped;
          // Keep basePoints in sync
          if (newBasePoints && renderToBase) {
            const baseIdx = renderToBase.get(idx);
            if (baseIdx !== undefined && !processedBases.has(baseIdx)) {
              processedBases.add(baseIdx);
              if (s.basePoints?.[baseIdx]) {
                newBasePoints[baseIdx] = {
                  x: s.basePoints[baseIdx].x + dx,
                  y: s.basePoints[baseIdx].y + dy,
                };
              }
            }
          }
        });
        updateShape(s.id, {
          points: newPoints,
          ...(newBasePoints ? { basePoints: newBasePoints } : {}),
        });
        dragOffsetRef.current = { x: sx, y: sy };
        redraw();
        return;
      }

      // ── Hover ──
      if (mode === "edit" && !grabModeRef.current) {
        const prev = hoveredPtRef.current;
        hoveredPtRef.current = getPointAt(sx, sy);
        const hoveredCtrl = getCtrlPointAt(sx, sy);
        canvas.style.cursor =
          hoveredPtRef.current !== null || hoveredCtrl !== null
            ? "pointer"
            : "crosshair";
        if (prev !== hoveredPtRef.current) redraw();
      } else if (mode === "addpt") {
        canvas.style.cursor = getEdgeAt(sx, sy) ? "cell" : "crosshair";
      } else if (mode === "move") {
        canvas.style.cursor = "move";
      } else if (mode === "scale") {
        canvas.style.cursor = "ew-resize";
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
      const { sx, sy } = getXY(e);

      // ── Middle mouse = pan ──
      if (e.button === 1) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: sx, y: sy };
        const { viewState } = useEditorStore.getState();
        panStartOffsetRef.current = { x: viewState.panX, y: viewState.panY };
        canvas.style.cursor = "grabbing";
        return;
      }

      const isRight = e.button === 2;
      const isLeft = e.button === 0;
      const {
        mode,
        shapes,
        activeId,
        selectPoint,
        deselectAllPoints,
        setActiveShape,
        selectedPointIndices,
        updateShape,
        snapshot: snap,
      } = useEditorStore.getState();
      void snap;

      const clickedPt = getPointAt(sx, sy);
      const clickedCtrl = getCtrlPointAt(sx, sy);
      const hitShapeId = getShapeAt(sx, sy);
      const s = shapes.find((sh) => sh.id === activeId);

      // ── Switch active shape ──
      if (hitShapeId && hitShapeId !== activeId && clickedPt === null) {
        snap();
        setActiveShape(hitShapeId);
        redraw();
        return;
      }

      // ── Commit grab ──
      if (grabModeRef.current) {
        snap();
        grabModeRef.current = false;
        grabAxisRef.current = "none";
        grabStartPosRef.current = null;
        grabStartPtsRef.current = [];
        grabStartBasePtsRef.current = [];
        guideLinesRef.current = [];
        canvas.style.cursor = "crosshair";
        updateModeUI();
        redraw();
        return;
      }

      // ── Circle resize handle ──
      if (s && s.kind === "circle" && isLeft) {
        const h = getCircleHandleAt(sx, sy, s);
        if (h !== null) {
          if (h === 0) {
            // center -> move via drag
            isDraggingRef.current = true;
            dragOffsetRef.current = { x: sx, y: sy };
            useEditorStore.getState().setMode("move");
          } else {
            // cardinal handle -> resize
            isCircleResizingRef.current = true;
            circleResizeIdRef.current = s.id;
            snap();
          }
          return;
        }
      }

      if (mode === "move" && isLeft) {
        isDraggingRef.current = true;
        dragOffsetRef.current = { x: sx, y: sy };
        canvas.style.cursor = "grabbing";
        return;
      }
      if (mode === "scale" && isLeft) {
        isDraggingRef.current = true;
        dragOffsetRef.current = { x: sx, y: sy };
        return;
      }

      // ── Add point on edge ──
      if (mode === "addpt" && isLeft) {
        const edge = getEdgeAt(sx, sy);
        if (edge && s && s.kind === "poly") {
          snap();
          const pt = processWorldPos(edge.x, edge.y);

          if (s.basePoints && s.cornerRadii) {
            const basePoints = [...s.basePoints];
            const baseTypes = getBasePointTypes(s);
            let cornerRadii: Record<number, number> = { ...s.cornerRadii };
            const renderToBase = getRenderToBaseMap(s);

            const a = edge.edgeIdx;
            const b = (edge.edgeIdx + 1) % s.points.length;
            const baseA = renderToBase.get(a);
            const baseB = renderToBase.get(b);

            let insertAt = edge.edgeIdx + 1;
            if (baseA !== undefined) {
              insertAt = (baseA + 1) % basePoints.length;
              if (baseB !== undefined && baseB > baseA) {
                insertAt = baseB;
              }
              if (baseB === 0 && baseA === basePoints.length - 1) {
                insertAt = 0;
              }
            }

            basePoints.splice(insertAt, 0, pt);
            baseTypes.splice(insertAt, 0, "straight");

            const shifted: Record<number, number> = {};
            Object.entries(cornerRadii).forEach(([k, v]) => {
              const ki = parseInt(k, 10);
              shifted[ki < insertAt ? ki : ki + 1] = v;
            });
            shifted[insertAt] = 0;
            cornerRadii = shifted;

            const rebuilt = rebuildRoundedFromBase(
              basePoints,
              baseTypes,
              cornerRadii,
            );
            const nextShape = {
              ...s,
              ...rebuilt,
              basePoints,
              cornerRadii,
            };

            const nextMap = getRenderToBaseMap(nextShape);
            let selectedIdx = insertAt;
            for (let ri = 0; ri < nextShape.points.length; ri++) {
              if (nextMap.get(ri) === insertAt) {
                selectedIdx = ri;
                break;
              }
            }

            updateShape(s.id, nextShape);
            deselectAllPoints();
            useEditorStore.getState().setSelectedPoints(new Set([selectedIdx]));
          } else {
            const newPoints = [...s.points];
            const newTypes = [...s.pointTypes];
            const newCtrl = { ...s.ctrlPoints };
            newPoints.splice(edge.edgeIdx + 1, 0, pt);
            newTypes.splice(edge.edgeIdx + 1, 0, "straight");
            const remapped: Record<number, Point> = {};
            Object.entries(newCtrl).forEach(([k, v]) => {
              const ki = parseInt(k, 10);
              remapped[ki <= edge.edgeIdx ? ki : ki + 1] = v;
            });
            updateShape(s.id, {
              points: newPoints,
              pointTypes: newTypes,
              ctrlPoints: remapped,
            });
            deselectAllPoints();
            useEditorStore
              .getState()
              .setSelectedPoints(new Set([edge.edgeIdx + 1]));
          }
          redraw();
        }
        return;
      }

      // ── Edit mode ──
      if (mode === "edit") {
        if (isRight) {
          if (clickedPt !== null) selectPoint(clickedPt, true);
          redraw();
          return;
        }
        if (isLeft && clickedCtrl !== null) {
          draggingCtrlIdxRef.current = clickedCtrl;
          isDraggingRef.current = true;
          dragOffsetRef.current = { x: sx, y: sy };
          redraw();
          return;
        }
        if (clickedPt !== null) {
          if (e.shiftKey) {
            selectPoint(clickedPt, true);
          } else {
            if (!selectedPointIndices.has(clickedPt)) {
              deselectAllPoints();
              useEditorStore.getState().setSelectedPoints(new Set([clickedPt]));
            }
            isDraggingRef.current = true;
            dragOffsetRef.current = { x: sx, y: sy };
          }
          redraw();
        } else {
          isBoxSelectingRef.current = true;
          boxStartRef.current = { x: sx, y: sy };
          boxEndRef.current = { x: sx, y: sy };
          if (!e.shiftKey) deselectAllPoints();
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.style.cursor = "crosshair";
        redraw();
        return;
      }

      if (isCircleResizingRef.current) {
        isCircleResizingRef.current = false;
        circleResizeIdRef.current = null;
        useEditorStore.getState().snapshot();
        redraw();
        return;
      }

      const { snapshot: snap } = useEditorStore.getState();
      if (isDraggingRef.current) {
        snap();
        isDraggingRef.current = false;
        draggingCtrlIdxRef.current = null;
      }

      if (isBoxSelectingRef.current) {
        const { sx, sy } = getXY(e);
        boxEndRef.current = { x: sx, y: sy };
        const bs = boxStartRef.current!;
        const t = getTransform();
        const minSX = Math.min(bs.x, sx),
          maxSX = Math.max(bs.x, sx);
        const minSY = Math.min(bs.y, sy),
          maxSY = Math.max(bs.y, sy);

        if (maxSX - minSX < 2 && maxSY - minSY < 2) {
          useEditorStore.getState().setActiveShape(null);
        } else {
          const { shapes, activeId } = useEditorStore.getState();
          const s = shapes.find((sh) => sh.id === activeId);
          if (s && s.kind === "poly") {
            const toAdd = new Set<number>();
            s.points.forEach((pt, idx) => {
              const sp = toScreen(pt.x, pt.y, t);
              if (
                sp.x >= minSX &&
                sp.x <= maxSX &&
                sp.y >= minSY &&
                sp.y <= maxSY
              )
                toAdd.add(idx);
            });
            useEditorStore
              .getState()
              .setSelectedPoints(
                new Set([
                  ...useEditorStore.getState().selectedPointIndices,
                  ...toAdd,
                ]),
              );
          }
        }
        isBoxSelectingRef.current = false;
        boxStartRef.current = null;
        boxEndRef.current = null;
        redraw();
      }

      if (!grabModeRef.current) {
        guideLinesRef.current = [];
        redraw();
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [buildTransformedPolyPath, buildWorldPolyPath, redraw]);

  // ─── Keyboard handler ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const {
        mode,
        shapes,
        activeId,
        undo,
        redo,
        snapshot: snap,
        selectedPointIndices,
        updateShape,
        removeSelectedPoints,
        selectAllPoints,
        deselectAllPoints,
        setSelectedPoints,
        clipboard,
        setClipboard,
      } = useEditorStore.getState();
      const s = shapes.find((sh) => sh.id === activeId);

      // Undo / Redo
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        undo();
        e.preventDefault();
        redraw();
        return;
      }
      if (
        (e.key === "y" && (e.ctrlKey || e.metaKey)) ||
        (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        redo();
        e.preventDefault();
        redraw();
        return;
      }

      // Grab axis lock
      if (grabModeRef.current) {
        if (e.key.toLowerCase() === "x") {
          grabAxisRef.current = grabAxisRef.current === "x" ? "none" : "x";
          // Reset start so we measure from current cursor position fresh
          grabStartPosRef.current = null;
          updateModeUI();
          redraw();
          e.preventDefault();
          return;
        }
        if (e.key.toLowerCase() === "y") {
          grabAxisRef.current = grabAxisRef.current === "y" ? "none" : "y";
          grabStartPosRef.current = null;
          updateModeUI();
          redraw();
          e.preventDefault();
          return;
        }
        if (e.key === "Escape") {
          // Cancel grab
          if (s && s.kind === "poly") {
            const restored = [...s.points];
            Array.from(selectedPointIndices).forEach((idx, i) => {
              restored[idx] = grabStartPtsRef.current[i] ?? restored[idx];
            });
            updateShape(s.id, { points: restored });
          }
          grabModeRef.current = false;
          grabAxisRef.current = "none";
          grabStartPosRef.current = null;
          grabStartPtsRef.current = [];
          guideLinesRef.current = [];
          const canvas = canvasRef.current;
          if (canvas) canvas.style.cursor = "crosshair";
          updateModeUI();
          redraw();
          e.preventDefault();
          return;
        }
      }

      // Nudge in move mode
      if (
        mode === "move" &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
        s
      ) {
        const step = e.shiftKey ? 10 : 1;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        updateShape(s.id, moveShape(s, dx, dy));
        redraw();
        e.preventDefault();
        return;
      }

      // Escape
      if (e.key === "Escape") {
        deselectAllPoints();
        isBoxSelectingRef.current = false;
        boxStartRef.current = null;
        boxEndRef.current = null;
        redraw();
        return;
      }

      // Delete / X
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        if (selectedPointIndices.size > 0) {
          snap();
          removeSelectedPoints();
          redraw();
        }
        e.preventDefault();
        return;
      }
      // X without ctrl/meta for delete (not in grab mode)
      if (
        e.key.toLowerCase() === "x" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !grabModeRef.current
      ) {
        if (selectedPointIndices.size > 0) {
          snap();
          removeSelectedPoints();
          redraw();
        }
        e.preventDefault();
        return;
      }

      // Grab (G)
      if (
        e.key.toLowerCase() === "g" &&
        mode === "edit" &&
        selectedPointIndices.size > 0 &&
        !grabModeRef.current &&
        s &&
        s.kind === "poly"
      ) {
        grabModeRef.current = true;
        grabAxisRef.current = "none";
        grabStartPosRef.current = null;
        grabStartPtsRef.current = Array.from(selectedPointIndices).map(
          (idx) => ({ ...s.points[idx] }),
        );
        if (s.kind === "poly" && s.basePoints) {
          grabStartBasePtsRef.current = s.basePoints.map((p) => ({ ...p }));
        } else {
          grabStartBasePtsRef.current = [];
        }
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = "none";
        updateModeUI();
        e.preventDefault();
        return;
      }

      // Select all (A)
      if (
        e.key.toLowerCase() === "a" &&
        !e.ctrlKey &&
        !e.metaKey &&
        mode === "edit" &&
        s &&
        s.kind === "poly"
      ) {
        if (selectedPointIndices.size === s.points.length) deselectAllPoints();
        else selectAllPoints();
        redraw();
        e.preventDefault();
        return;
      }

      // Extrude (E)
      if (
        e.key.toLowerCase() === "e" &&
        !e.ctrlKey &&
        !e.metaKey &&
        mode === "edit" &&
        selectedPointIndices.size > 0 &&
        s &&
        s.kind === "poly"
      ) {
        snap();

        let freshS: PolyShape;
        let newSel = new Set<number>();

        if (s.basePoints && s.cornerRadii) {
          const basePoints = [...s.basePoints];
          const baseTypes = getBasePointTypes(s);
          let cornerRadii: Record<number, number> = { ...s.cornerRadii };
          const renderToBase = getRenderToBaseMap(s);

          const selectedBase = new Set<number>();
          Array.from(selectedPointIndices).forEach((ri) => {
            const bi = renderToBase.get(ri);
            if (bi !== undefined) selectedBase.add(bi);
          });

          const sortedBase = Array.from(selectedBase).sort((a, b) => a - b);
          const insertedBaseIndices: number[] = [];
          let offset = 0;

          sortedBase.forEach((baseIdx) => {
            const sourceIdx = baseIdx + offset;
            const insertAt = sourceIdx + 1;
            const sourcePt = basePoints[sourceIdx];
            basePoints.splice(insertAt, 0, { ...sourcePt });
            baseTypes.splice(insertAt, 0, baseTypes[sourceIdx]);

            const shifted: Record<number, number> = {};
            Object.entries(cornerRadii).forEach(([k, v]) => {
              const ki = parseInt(k, 10);
              shifted[ki < insertAt ? ki : ki + 1] = v;
            });
            shifted[insertAt] = 0;
            cornerRadii = shifted;

            insertedBaseIndices.push(insertAt);
            offset++;
          });

          const rebuilt = rebuildRoundedFromBase(
            basePoints,
            baseTypes,
            cornerRadii,
          );
          freshS = {
            ...s,
            ...rebuilt,
            basePoints,
            cornerRadii,
          };

          const nextMap = getRenderToBaseMap(freshS);
          insertedBaseIndices.forEach((bi) => {
            for (let ri = 0; ri < freshS.points.length; ri++) {
              if (nextMap.get(ri) === bi) {
                newSel.add(ri);
                break;
              }
            }
          });

          updateShape(s.id, freshS);
          setSelectedPoints(newSel);
        } else {
          const sorted = Array.from(selectedPointIndices).sort((a, b) => a - b);
          const newPoints = [...s.points];
          const newTypes = [...s.pointTypes];
          const newCtrl = { ...s.ctrlPoints };
          newSel = new Set<number>();
          let offset = 0;

          sorted.forEach((idx) => {
            const insertAt = idx + 1 + offset;
            const pt = { ...s.points[idx] }; // duplicate at same position
            newPoints.splice(insertAt, 0, pt);
            newTypes.splice(insertAt, 0, s.pointTypes[idx]);
            // Re-index ctrl points above insertAt
            const tempCtrl: Record<number, Point> = {};
            Object.entries(newCtrl).forEach(([k, v]) => {
              const ki = parseInt(k, 10);
              tempCtrl[ki < insertAt ? ki : ki + 1] = v;
            });
            Object.keys(newCtrl).forEach(
              (k) => delete newCtrl[parseInt(k, 10)],
            );
            Object.assign(newCtrl, tempCtrl);
            newSel.add(insertAt);
            offset++;
          });
          freshS = {
            ...s,
            points: newPoints,
            pointTypes: newTypes,
            ctrlPoints: newCtrl,
          };
          updateShape(s.id, {
            points: newPoints,
            pointTypes: newTypes,
            ctrlPoints: newCtrl,
          });
          setSelectedPoints(newSel);
        }

        // Auto-enter grab
        grabModeRef.current = true;
        grabAxisRef.current = "none";
        grabStartPosRef.current = null;
        grabStartPtsRef.current = Array.from(newSel)
          .sort((a, b) => a - b)
          .map((idx) => ({ ...freshS.points[idx] }));
        if (freshS.kind === "poly" && freshS.basePoints) {
          // This creates a snapshot of the base points exactly as they are at Grab start
          grabStartBasePtsRef.current = freshS.basePoints.map((p) => ({
            ...p,
          }));
        } else {
          grabStartBasePtsRef.current = [];
        }
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = "none";
        updateModeUI();
        redraw();
        e.preventDefault();
        return;
      }

      // Zoom with + / -
      if (e.key === "+" || e.key === "=" || e.key === "NumpadAdd") {
        const { viewState, setViewState } = useEditorStore.getState();
        const canvas = canvasRef.current;
        const cx = canvas ? canvas.width / 2 : 0;
        const cy = canvas ? canvas.height / 2 : 0;
        const factor = 1.2;
        const nz = Math.min(40, viewState.zoom * factor);
        setViewState({
          zoom: nz,
          panX: cx - (cx - viewState.panX) * (nz / viewState.zoom),
          panY: cy - (cy - viewState.panY) * (nz / viewState.zoom),
        });
        redraw();
        e.preventDefault();
        return;
      }
      if (e.key === "-" || e.key === "NumpadSubtract") {
        const { viewState, setViewState } = useEditorStore.getState();
        const canvas = canvasRef.current;
        const cx = canvas ? canvas.width / 2 : 0;
        const cy = canvas ? canvas.height / 2 : 0;
        const factor = 0.833;
        const nz = Math.max(0.08, viewState.zoom * factor);
        setViewState({
          zoom: nz,
          panX: cx - (cx - viewState.panX) * (nz / viewState.zoom),
          panY: cy - (cy - viewState.panY) * (nz / viewState.zoom),
        });
        redraw();
        e.preventDefault();
        return;
      }
      // Numpad 0 = reset view
      if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        useEditorStore.getState().setViewState({ zoom: 1, panX: 0, panY: 0 });
        redraw();
        e.preventDefault();
        return;
      }

      // Copy / Paste
      if (
        e.key.toLowerCase() === "c" &&
        (e.ctrlKey || e.metaKey) &&
        s &&
        s.kind === "poly"
      ) {
        if (selectedPointIndices.size > 0) {
          setClipboard({
            points: Array.from(selectedPointIndices).map((idx) => ({
              ...s.points[idx],
            })),
            types: Array.from(selectedPointIndices).map(
              (idx) => s.pointTypes[idx],
            ),
          });
        }
        e.preventDefault();
        return;
      }
      if (
        e.key.toLowerCase() === "v" &&
        (e.ctrlKey || e.metaKey) &&
        s &&
        clipboard &&
        s.kind === "poly"
      ) {
        snap();
        const newPoints = [...s.points];
        const newTypes = [...s.pointTypes];
        const newSel = new Set<number>();
        clipboard.points.forEach((pt, i) => {
          newPoints.push({ x: pt.x + 20, y: pt.y + 20 });
          newTypes.push(clipboard.types[i]);
          newSel.add(newPoints.length - 1);
        });
        updateShape(s.id, { points: newPoints, pointTypes: newTypes });
        setSelectedPoints(newSel);
        redraw();
        e.preventDefault();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redraw]);

  // ─── Store subscription → redraw ──────────────────────────────────────────
  useEffect(() => {
    return useEditorStore.subscribe(() => redraw());
  }, [redraw]);

  // ─── Canvas resize observer ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      redraw();
    });
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [redraw]);

  // ─── Initial snapshot ─────────────────────────────────────────────────────
  useEffect(() => {
    useEditorStore.getState().snapshot();
    redraw();
  }, []);

  return (
    <div
      className="flex-1 relative overflow-hidden bg-editor-bg"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <canvas
        ref={canvasRef}
        id="editor-canvas"
        className="block w-full h-full cursor-crosshair"
      />
      <ModePill />
      <CoordsPill />
    </div>
  );
}

// ─── Support components ────────────────────────────────────────────────────
function updateModeUI() {
  const { mode, grabMode } = useEditorStore.getState();
  const pill = document.getElementById("mode-pill");
  if (!pill) return;
  const map: Record<string, [string, string]> = {
    edit: [
      "Edit",
      "drag pts · G=grab · E=extrude · R-click=multi-sel · ±=zoom · mid-btn=pan",
    ],
    addpt: ["Add Pt", "click on edge to insert point"],
    move: ["Move", "drag shape · arrows to nudge (Shift=10px)"],
    scale: ["Scale", "drag left/right to scale from center"],
  };
  if (grabMode) {
    pill.innerHTML =
      '<b class="text-accent">Grab</b> — move mouse · click to confirm · <b class="text-editor-red">X</b>=lock horiz · <b class="text-editor-green">Y</b>=lock vert · Esc=cancel';
  } else {
    const [label, hint] = map[mode] || map.edit;
    pill.innerHTML = `<b class="text-accent">${label}</b> — ${hint}`;
  }
}

function ModePill() {
  return (
    <div
      id="mode-pill"
      className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-[rgba(26,26,26,0.95)] border border-border backdrop-blur-md px-4 py-[5px] rounded-[20px] font-mono text-[10px] text-dim pointer-events-none whitespace-nowrap max-w-[92%] overflow-hidden text-ellipsis"
      dangerouslySetInnerHTML={{
        __html:
          '<b class="text-accent">Edit</b> — drag pts · G=grab · E=extrude · R-click=multi-sel · ±=zoom · mid-btn=pan',
      }}
    />
  );
}

function CoordsPill() {
  return (
    <div
      id="coords-pill"
      className="absolute top-2.5 right-3 font-mono text-[10px] text-dim pointer-events-none"
    >
      0, 0
    </div>
  );
}
