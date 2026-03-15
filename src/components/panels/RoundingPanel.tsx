import { useRef, useEffect } from "react";
import { useEditorStore, getActiveShape } from "../../store/useEditorStore";
import { PanelSection, ActionBtn, Slider, Divider } from "../ui/components";
import { applyCornerRadius, applyEdgeBulge } from "../../utils/shapeOps";
import type { Shape } from "../../types/editor";

export function RoundingPanel() {
  const store = useEditorStore();
  const {
    viewState,
    setViewState,
    selectedPointIndices,
    updateShape,
    snapshot,
    removeSelectedPoints,
  } = store;
  const activeShape = getActiveShape(store);

  // ─── Selection Reset Logic ──────────────────────────────────────────────
  // Reset sliders when the actual point selection changes to avoid 
  // carrying over values from previous adjustments.
  const lastSelection = useRef<string>("");
  useEffect(() => {
    const current = Array.from(selectedPointIndices).sort((a, b) => a - b).join(",");
    if (current !== lastSelection.current) {
      setViewState({ cornerRadius: 0, edgeBulge: 0 });
      lastSelection.current = current;
    }
  }, [selectedPointIndices, setViewState]);

  // Stores the shape state captured at drag-start so we can re-apply
  // the operation from scratch on every slider tick (prevents stacking).
  const preDragShape = useRef<Shape | null>(null);
  // Tracks the point-index selection at drag-start
  const preDragSelection = useRef<Set<number>>(new Set());

  // ─── Toggle straight / curve ────────────────────────────────────────────
  const toggleCurve = () => {
    if (!activeShape) return;
    snapshot();
    const newTypes = [...activeShape.pointTypes];
    selectedPointIndices.forEach((idx) => {
      newTypes[idx] = newTypes[idx] === "curve" ? "straight" : "curve";
    });
    updateShape(activeShape.id, { pointTypes: newTypes });
  };

  /**
   * When a shape has been rounded before, its rendered points include extra
   * arc-split points. We need to map a rendered index back to the original
   * base-point index so applyCornerRadius knows which corner the user means.
   *
   * For each base corner that has a radius > 0, one rendered point was
   * replaced by two; we account for that shift.
   */
  const getBaseIndicesForSelection = (shape: typeof activeShape, sel: Set<number>): Set<number> => {
    if (!shape || !shape.basePoints || !shape.cornerRadii) return sel;
    const radii = shape.cornerRadii;
    // Build a map: rendered index → base index
    // Each rounded corner (radius>0) turns base[i] → rendered[j], rendered[j+1]
    // Process in ASC order like buildRoundedShape does (reversed), but for
    // mapping we just need to know the offset.
    const renderToBase = new Map<number, number>();
    let offset = 0;
    for (let baseIdx = 0; baseIdx < shape.basePoints.length; baseIdx++) {
      const r = radii[baseIdx] ?? 0;
      if (r > 0) {
        // base[baseIdx] → rendered[baseIdx + offset] and [baseIdx + offset + 1]
        renderToBase.set(baseIdx + offset, baseIdx);
        renderToBase.set(baseIdx + offset + 1, baseIdx);
        offset += 1;
      } else {
        renderToBase.set(baseIdx + offset, baseIdx);
      }
    }
    const result = new Set<number>();
    sel.forEach((ri) => {
      const bi = renderToBase.get(ri);
      if (bi !== undefined) result.add(bi);
    });
    return result;
  };

  // ─── Corner radius ───────────────────────────────────────────────────────
  const handleCornerDragStart = () => {
    if (!activeShape || selectedPointIndices.size === 0) return;
    preDragShape.current = activeShape;
    preDragSelection.current = new Set(selectedPointIndices);
  };

  const handleCornerChange = (val: number) => {
    setViewState({ cornerRadius: val });
    const base = preDragShape.current;
    if (!base || preDragSelection.current.size === 0) return;

    // Resolve base-point indices (handles re-adjustment of already-rounded shapes)
    const baseIndices = getBaseIndicesForSelection(base, preDragSelection.current);
    const indicesToUse = baseIndices.size > 0 ? baseIndices : preDragSelection.current;

    // Always start fresh from basePoints if available, so radius changes
    // don't stack on top of each other
    const startShape: Shape = base.basePoints
      ? {
          ...base,
          points: [...base.basePoints],
          pointTypes: (base.basePoints.map((_, i) => base.pointTypes[i] ?? "straight") as import("../../types/editor").PointType[]),
          ctrlPoints: {},
          cornerRadii: { ...(base.cornerRadii ?? {}) },
        }
      : { ...base, points: [...base.points], pointTypes: [...base.pointTypes], ctrlPoints: { ...base.ctrlPoints } };

    const sorted = Array.from(indicesToUse).sort((a, b) => b - a);
    let s: Shape = startShape;
    sorted.forEach((idx) => {
      s = applyCornerRadius(s, idx, val);
    });
    updateShape(s.id, s);
  };

  const handleCornerDragEnd = () => {
    if (preDragShape.current) snapshot();
    preDragShape.current = null;
  };

  // One-shot apply button (with deselect)
  const handleApplyCorner = () => {
    if (!activeShape || selectedPointIndices.size === 0) return;
    snapshot();
    const r = viewState.cornerRadius;

    // Resolve base-point indices
    const baseIndices = getBaseIndicesForSelection(activeShape, selectedPointIndices);
    const indicesToUse = baseIndices.size > 0 ? baseIndices : selectedPointIndices;

    const startShape: Shape = activeShape.basePoints
      ? {
          ...activeShape,
          points: [...activeShape.basePoints],
          pointTypes: (activeShape.basePoints.map((_, i) => activeShape.pointTypes[i] ?? "straight") as import("../../types/editor").PointType[]),
          ctrlPoints: {},
          cornerRadii: { ...(activeShape.cornerRadii ?? {}) },
        }
      : { ...activeShape, points: [...activeShape.points], pointTypes: [...activeShape.pointTypes], ctrlPoints: { ...activeShape.ctrlPoints } };

    const sorted = Array.from(indicesToUse).sort((a, b) => b - a);
    let s: Shape = startShape;
    sorted.forEach((idx) => {
      s = applyCornerRadius(s, idx, r);
    });
    updateShape(s.id, s);
    store.deselectAllPoints();
  };

  // ─── Edge bulge ──────────────────────────────────────────────────────────
  const getEdgeIndices = () => {
    if (!activeShape) return null;
    const sel = Array.from(selectedPointIndices).sort((a, b) => a - b);
    if (sel.length !== 2) return null;
    const [i, j] = sel;
    const n = activeShape.points.length;
    const isAdj = j === i + 1 || (i === 0 && j === n - 1);
    return isAdj ? ([i, j] as const) : null;
  };

  const handleEdgeDragStart = () => {
    if (!activeShape) return;
    if (!getEdgeIndices()) return;
    preDragShape.current = activeShape;
    preDragSelection.current = new Set(selectedPointIndices);
  };

  const handleEdgeChange = (val: number) => {
    const signed = val * viewState.edgeBulgeSign;
    setViewState({ edgeBulge: signed });

    const base = preDragShape.current;
    if (!base) return;
    const sel = Array.from(preDragSelection.current).sort((a, b) => a - b);
    if (sel.length !== 2) return;
    const [i, j] = sel;
    const n = base.points.length;
    if (!(j === i + 1 || (i === 0 && j === n - 1))) return;

    const s = applyEdgeBulge(
      {
        ...base,
        points: [...base.points],
        pointTypes: [...base.pointTypes],
        ctrlPoints: { ...base.ctrlPoints },
      },
      i,
      j,
      signed,
    );
    updateShape(s.id, s);
  };

  const handleEdgeDragEnd = () => {
    if (preDragShape.current) snapshot();
    preDragShape.current = null;
  };

  const handleFlipEdge = () => {
    setViewState({
      edgeBulgeSign: -viewState.edgeBulgeSign,
      edgeBulge: -viewState.edgeBulge,
    });
  };

  const handleApplyEdge = () => {
    if (!activeShape) return;
    const indices = getEdgeIndices();
    if (!indices) {
      alert("Select exactly 2 adjacent points to define an edge.");
      return;
    }
    const [i, j] = indices;
    snapshot();
    const bulge = viewState.edgeBulge * viewState.edgeBulgeSign;
    const s = applyEdgeBulge(
      {
        ...activeShape,
        points: [...activeShape.points],
        pointTypes: [...activeShape.pointTypes],
        ctrlPoints: { ...activeShape.ctrlPoints },
      },
      i,
      j,
      bulge,
    );
    updateShape(s.id, s);
    store.deselectAllPoints();
  };

  return (
    <PanelSection title="Selection & Rounding">
      <div className="flex items-center gap-1.5 mb-[5px]">
        <span className="text-dim text-[11px] w-[72px] shrink-0">Selected</span>
        <span className="inline-block bg-accent text-white rounded-[10px] px-1.5 py-px text-[9px] font-mono font-semibold ml-auto">
          {selectedPointIndices.size}
        </span>
      </div>

      <ActionBtn onClick={toggleCurve}>⟷ Toggle Straight / Curve</ActionBtn>
      <ActionBtn
        variant="danger"
        onClick={() => {
          snapshot();
          removeSelectedPoints();
        }}
      >
        ✕ Delete Selected (X)
      </ActionBtn>

      <Divider />

      {/* Corner / Edge tabs */}
      <div className="bg-[#1e1e1e] border border-border rounded-(--radius) p-2 mt-0.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.8px] text-dim mb-1.5">
          Corner / Edge Rounding
        </div>
        <div className="flex gap-[3px] mb-2">
          {(["corner", "edge"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewState({ roundMode: m })}
              className={`flex-1 py-1 border rounded-(--radius) text-[10px] font-mono cursor-pointer text-center transition-all duration-100 ${
                viewState.roundMode === m
                  ? "bg-accent border-accent text-white"
                  : "bg-panel2 border-border text-dim hover:border-accent hover:text-editor-text"
              }`}
            >
              {m === "corner" ? "Corner" : "Edge Bulge"}
            </button>
          ))}
        </div>

        {viewState.roundMode === "corner" && (
          <>
            <Slider
              label="Radius"
              value={viewState.cornerRadius}
              min={1}
              max={200}
              step={1}
              onDragStart={handleCornerDragStart}
              onChange={handleCornerChange}
              onDragEnd={handleCornerDragEnd}
            />
            <ActionBtn variant="primary" onClick={handleApplyCorner}>
              ↻ Apply & Deselect
            </ActionBtn>
            <p className="text-[10px] text-dim leading-relaxed mt-1.5">
              Select corner pt(s) → drag slider to preview live. "Apply &
              Deselect" commits and clears selection.
            </p>
          </>
        )}

        {viewState.roundMode === "edge" && (
          <>
            <Slider
              label="Bulge"
              value={Math.abs(viewState.edgeBulge)}
              min={0}
              max={100}
              step={1}
              onDragStart={handleEdgeDragStart}
              onChange={handleEdgeChange}
              onDragEnd={handleEdgeDragEnd}
            />
            <button
              onClick={handleFlipEdge}
              className="w-full py-[5px] mt-[5px] bg-panel2 border border-border rounded-(--radius) text-editor-cyan text-[10px] font-mono cursor-pointer text-center hover:border-editor-cyan hover:bg-[#1a2a2a] transition-all duration-100"
            >
              ⇅ Flip Direction
            </button>
            <ActionBtn
              variant="primary"
              className="mt-[5px]"
              onClick={handleApplyEdge}
            >
              ↻ Apply & Deselect
            </ActionBtn>
            <p className="text-[10px] text-dim leading-relaxed mt-1.5">
              Select 2 adjacent pts → drag slider to preview live.
            </p>
          </>
        )}
      </div>
    </PanelSection>
  );
}
