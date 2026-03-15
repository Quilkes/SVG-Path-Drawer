import { useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "../../store/useEditorStore";
import type { Shape, Point, GuideLine } from "../../types/editor";
import { computeGuides, applyGuideSnap, snapPoint } from "../../utils/geometry";
import { moveShape, scaleShapeFromCenter } from "../../utils/shapeOps";

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Local mutable refs for drag/grab logic (NOT React state, to avoid re-renders during drag)
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const isBoxSelectingRef = useRef(false);
  const boxStartRef = useRef<Point | null>(null);
  const boxEndRef = useRef<Point | null>(null);
  const hoveredPtRef = useRef<number | null>(null);
  const grabModeRef = useRef(false);
  const grabStartPosRef = useRef<Point | null>(null);
  const grabStartPtsRef = useRef<Point[]>([]);
  const guideLinesRef = useRef<GuideLine[]>([]);

  // ─── Rebuild path (used for hit-testing and draw) ────────────────────────
  const buildPolyPath = useCallback(
    (ctx: CanvasRenderingContext2D, s: Shape) => {
      const { points: pts, pointTypes: types, ctrlPoints: ctrl } = s;
      const n = pts.length;
      if (n < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < n; i++) {
        if (types[i] === "curve") {
          const cp = ctrl[i];
          if (cp) ctx.quadraticCurveTo(cp.x, cp.y, pts[i].x, pts[i].y);
          else
            ctx.quadraticCurveTo(
              pts[i - 1].x,
              pts[i - 1].y,
              pts[i].x,
              pts[i].y,
            );
        } else {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      }
      if (types[0] === "curve") {
        const cp = ctrl[0];
        if (cp) ctx.quadraticCurveTo(cp.x, cp.y, pts[0].x, pts[0].y);
        else
          ctx.quadraticCurveTo(pts[n - 1].x, pts[n - 1].y, pts[0].x, pts[0].y);
      }
      ctx.closePath();
    },
    [],
  );

  // ─── Main draw function ───────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { shapes, activeId, selectedPointIndices, viewState } =
      useEditorStore.getState();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid dots
    if (viewState.snapToGrid) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let x = 0; x < canvas.width; x += 20) {
        for (let y = 0; y < canvas.height; y += 20) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw all shapes
    shapes.forEach((s) =>
      drawPoly(ctx, s, s.id === activeId, selectedPointIndices, canvas),
    );

    // Guides
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
          ctx.moveTo(0, g.y!);
          ctx.lineTo(canvas.width, g.y!);
        } else {
          ctx.moveTo(g.x!, 0);
          ctx.lineTo(g.x!, canvas.height);
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Box selection
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
  }, [buildPolyPath]);

  function drawPoly(
    ctx: CanvasRenderingContext2D,
    s: Shape,
    isActive: boolean,
    selectedPointIndices: Set<number>,
    canvas: HTMLCanvasElement,
  ) {
    if (s.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = s.opacity;

    buildPolyPath(ctx, s);

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

    // Skeleton
    ctx.save();
    ctx.strokeStyle = "rgba(74,158,255,0.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    s.points.forEach((pt, i) =>
      i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y),
    );
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Ctrl lines
    const ctrl = s.ctrlPoints || {};
    ctx.strokeStyle = "rgba(74,205,204,0.25)";
    ctx.lineWidth = 1;
    Object.entries(ctrl).forEach(([k, cp]) => {
      const idx = parseInt(k);
      if (idx >= s.points.length) return;
      const pt = s.points[idx];
      const prevIdx = (idx - 1 + s.points.length) % s.points.length;
      const prev = s.points[prevIdx];
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y);
      ctx.lineTo(prev.x, prev.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(74,205,204,0.7)";
      ctx.fill();
    });
    ctx.restore();

    // Point handles
    s.points.forEach((pt, idx) => {
      const isSel = selectedPointIndices.has(idx);
      const isHov = idx === hoveredPtRef.current;
      const r = isSel ? 7 : 5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
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
      ctx.fillText(String(idx + 1), pt.x, pt.y - 14);
    });
  }

  // ─── Hit tests ────────────────────────────────────────────────────────────
  function getPointAt(x: number, y: number): number | null {
    const { shapes, activeId } = useEditorStore.getState();
    const s = shapes.find((sh) => sh.id === activeId);
    if (!s) return null;
    for (let i = s.points.length - 1; i >= 0; i--) {
      const dx = x - s.points[i].x,
        dy = y - s.points[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < 10) return i;
    }
    return null;
  }

  function getEdgeAt(
    x: number,
    y: number,
  ): { edgeIdx: number; x: number; y: number } | null {
    const { shapes, activeId } = useEditorStore.getState();
    const s = shapes.find((sh) => sh.id === activeId);
    if (!s) return null;
    const pts = s.points;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i],
        b = pts[(i + 1) % n];
      const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      if (lenSq === 0) continue;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / lenSq,
        ),
      );
      const cx2 = a.x + (b.x - a.x) * t,
        cy2 = a.y + (b.y - a.y) * t;
      if (Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2) < 8)
        return { edgeIdx: i, x: cx2, y: cy2 };
    }
    return null;
  }

  function getShapeAt(x: number, y: number): number | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const { shapes } = useEditorStore.getState();
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.points.length < 3) continue;
      ctx.save();
      buildPolyPath(ctx, s);
      const hit = ctx.isPointInPath(x, y);
      ctx.restore();
      if (hit) return s.id;
    }
    return null;
  }

  function processPos(x: number, y: number, movingSet?: Set<number>): Point {
    const { viewState, shapes, activeId } = useEditorStore.getState();
    const s = shapes.find((sh) => sh.id === activeId) ?? null;
    let p = snapPoint(x, y, viewState.snapToGrid);
    if (viewState.showGuides) {
      guideLinesRef.current = computeGuides(s, p.x, p.y, movingSet);
      p = applyGuideSnap(p.x, p.y, guideLinesRef.current);
    }
    return p;
  }

  // ─── Mouse handlers ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const pill = document.getElementById("coords-pill");
      if (pill) pill.textContent = `${Math.round(x)}, ${Math.round(y)}`;

      const { mode, shapes, activeId, selectedPointIndices, updateShape } =
        useEditorStore.getState();
      const s = shapes.find((sh) => sh.id === activeId);

      if (grabModeRef.current && selectedPointIndices.size > 0 && s) {
        if (!grabStartPosRef.current) {
          grabStartPosRef.current = { x, y };
          return;
        }
        const dx = x - grabStartPosRef.current.x,
          dy = y - grabStartPosRef.current.y;
        const newPoints = [...s.points];
        Array.from(selectedPointIndices).forEach((idx, i) => {
          const base = grabStartPtsRef.current[i];
          if (!base) return;
          const snapped = processPos(
            base.x + dx,
            base.y + dy,
            selectedPointIndices,
          );
          newPoints[idx] = snapped;
        });
        updateShape(s.id, { points: newPoints });
        redraw();
        return;
      }

      if (isBoxSelectingRef.current) {
        boxEndRef.current = { x, y };
        redraw();
        return;
      }

      if (isDraggingRef.current && mode === "move" && s) {
        const dx = x - dragOffsetRef.current.x,
          dy = y - dragOffsetRef.current.y;
        const updated = moveShape(s, dx, dy);
        updateShape(s.id, updated);
        dragOffsetRef.current = { x, y };
        redraw();
      } else if (isDraggingRef.current && mode === "scale" && s) {
        const dx = x - dragOffsetRef.current.x;
        const factor = 1 + dx * 0.005;
        const updated = scaleShapeFromCenter(s, factor);
        updateShape(s.id, updated);
        dragOffsetRef.current = { x, y };
        redraw();
      } else if (isDraggingRef.current && mode === "edit" && s) {
        const { selectedPointIndices } = useEditorStore.getState();
        const dx = x - dragOffsetRef.current.x,
          dy = y - dragOffsetRef.current.y;
        const newPoints = [...s.points];
        selectedPointIndices.forEach((idx) => {
          const snapped = processPos(
            s.points[idx].x + dx,
            s.points[idx].y + dy,
            selectedPointIndices,
          );
          newPoints[idx] = snapped;
        });
        updateShape(s.id, { points: newPoints });
        dragOffsetRef.current = { x, y };
        redraw();
      } else if (mode === "edit" && !grabModeRef.current) {
        const prev = hoveredPtRef.current;
        hoveredPtRef.current = getPointAt(x, y);
        canvas.style.cursor =
          hoveredPtRef.current !== null ? "pointer" : "crosshair";
        if (prev !== hoveredPtRef.current) redraw();
      } else if (mode === "addpt") {
        canvas.style.cursor = getEdgeAt(x, y) ? "cell" : "crosshair";
      } else if (mode === "move") {
        canvas.style.cursor = "move";
      } else if (mode === "scale") {
        canvas.style.cursor = "ew-resize";
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const isRight = e.button === 2,
        isLeft = e.button === 0;
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

      const clickedPt = getPointAt(x, y);
      const hitShapeId = getShapeAt(x, y);

      if (hitShapeId && hitShapeId !== activeId && clickedPt === null) {
        snap();
        setActiveShape(hitShapeId);
        return;
      }

      if (grabModeRef.current) {
        snap();
        grabModeRef.current = false;
        grabStartPosRef.current = null;
        grabStartPtsRef.current = [];
        guideLinesRef.current = [];
        canvas.style.cursor = "crosshair";
        updateModeUI();
        redraw();
        return;
      }

      if (mode === "move" && isLeft) {
        isDraggingRef.current = true;
        dragOffsetRef.current = { x, y };
        canvas.style.cursor = "grabbing";
        return;
      }
      if (mode === "scale" && isLeft) {
        isDraggingRef.current = true;
        dragOffsetRef.current = { x, y };
        canvas.style.cursor = "ew-resize";
        return;
      }

      if (mode === "addpt" && isLeft) {
        const edge = getEdgeAt(x, y);
        if (edge) {
          const s = shapes.find((sh) => sh.id === activeId);
          if (!s) return;
          snap();
          const pt = snapPoint(
            x,
            y,
            useEditorStore.getState().viewState.snapToGrid,
          );
          const newPoints = [...s.points];
          const newTypes = [...s.pointTypes];
          const newCtrl = { ...s.ctrlPoints };
          newPoints.splice(edge.edgeIdx + 1, 0, pt);
          newTypes.splice(edge.edgeIdx + 1, 0, "straight");
          const remapped: Record<number, Point> = {};
          Object.entries(newCtrl).forEach(([k, v]) => {
            const ki = parseInt(k);
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
          redraw();
        }
        return;
      }

      if (mode === "edit") {
        if (isRight) {
          if (clickedPt !== null) selectPoint(clickedPt, true);
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
            dragOffsetRef.current = { x, y };
          }
          redraw();
        } else {
          isBoxSelectingRef.current = true;
          boxStartRef.current = { x, y };
          boxEndRef.current = { x, y };
          if (!e.shiftKey) deselectAllPoints();
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const { snapshot: snap } = useEditorStore.getState();
      if (isDraggingRef.current) {
        snap();
        isDraggingRef.current = false;
      }

      if (isBoxSelectingRef.current) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left,
          y = e.clientY - rect.top;
        boxEndRef.current = { x, y };
        const bs = boxStartRef.current!;
        const minX = Math.min(bs.x, x),
          maxX = Math.max(bs.x, x);
        const minY = Math.min(bs.y, y),
          maxY = Math.max(bs.y, y);

        // If it was just a click (or tiny drag) on an empty area, deselect the shape
        if (maxX - minX < 2 && maxY - minY < 2) {
          useEditorStore.getState().setActiveShape(null);
        } else {
          const { shapes, activeId } = useEditorStore.getState();
          const s = shapes.find((sh) => sh.id === activeId);
          if (s) {
            const toAdd = new Set<number>();
            s.points.forEach((pt, idx) => {
              if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY)
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

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [buildPolyPath, redraw]);

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

      if (e.key === "Escape") {
        if (grabModeRef.current && s) {
          const restored = [...s.points];
          Array.from(selectedPointIndices).forEach((idx, i) => {
            restored[idx] = grabStartPtsRef.current[i];
          });
          updateShape(s.id, { points: restored });
          grabModeRef.current = false;
          grabStartPtsRef.current = [];
          guideLinesRef.current = [];
          const canvas = canvasRef.current;
          if (canvas) canvas.style.cursor = "crosshair";
          updateModeUI();
        } else {
          deselectAllPoints();
          isBoxSelectingRef.current = false;
          boxStartRef.current = null;
          boxEndRef.current = null;
        }
        redraw();
        return;
      }

      if (
        (e.key === "Delete" ||
          e.key === "Backspace" ||
          e.key.toLowerCase() === "x") &&
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

      if (
        e.key.toLowerCase() === "g" &&
        mode === "edit" &&
        selectedPointIndices.size > 0 &&
        !grabModeRef.current &&
        s
      ) {
        grabModeRef.current = true;
        grabStartPosRef.current = null;
        grabStartPtsRef.current = Array.from(selectedPointIndices).map(
          (idx) => ({ ...s.points[idx] }),
        );
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = "none";
        updateModeUI();
        e.preventDefault();
        return;
      }

      if (
        e.key.toLowerCase() === "a" &&
        !e.ctrlKey &&
        !e.metaKey &&
        mode === "edit" &&
        s
      ) {
        if (selectedPointIndices.size === s.points.length) deselectAllPoints();
        else selectAllPoints();
        redraw();
        e.preventDefault();
        return;
      }

      if (e.key.toLowerCase() === "c" && (e.ctrlKey || e.metaKey) && s) {
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
        clipboard
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

  // ─── Subscribe to Zustand for redraws ─────────────────────────────────────
  useEffect(() => {
    return useEditorStore.subscribe(() => redraw());
  }, [redraw]);

  // ─── Canvas resize ────────────────────────────────────────────────────────
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

// ─── Floating Pills ────────────────────────────────────────────────────────
function updateModeUI() {
  // Trigger a re-render of the mode pill by directly updating the DOM
  // (stays out of React state to avoid canvas lag)
  const { mode, grabMode } = useEditorStore.getState();
  const pill = document.getElementById("mode-pill");
  if (!pill) return;
  const map: Record<string, [string, string]> = {
    edit: ["Edit", "drag pts • R-click=add to sel • G=grab"],
    addpt: ["Add Pt", "click on a shape edge to insert a point"],
    move: ["Move", "drag shape • arrow keys to nudge (Shift=10px)"],
    scale: ["Scale", "drag left/right to scale from shape center"],
  };
  if (grabMode) {
    pill.innerHTML =
      '<b class="text-accent">Grab</b> — move mouse • click to confirm • Esc to cancel';
  } else {
    const [label, hint] = map[mode] || map.edit;
    pill.innerHTML = `<b class="text-accent">${label}</b> — ${hint}`;
  }
}

function ModePill() {
  return (
    <div
      id="mode-pill"
      className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-[rgba(26,26,26,0.95)] border border-border backdrop-blur-md px-4 py-[5px] rounded-[20px] font-mono text-[10px] text-dim pointer-events-none whitespace-nowrap max-w-[90%] overflow-hidden text-ellipsis"
      dangerouslySetInnerHTML={{
        __html:
          '<b class="text-accent">Edit</b> — drag pts • R-click=add to sel • G=grab',
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
