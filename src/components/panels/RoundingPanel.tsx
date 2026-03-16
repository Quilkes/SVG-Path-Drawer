import { useRef, useEffect } from "react";
import { useEditorStore, getActivePolyShape } from "../../store/useEditorStore";
import { PanelSection, ActionBtn, Divider } from "../ui/components";
import { applyCornerRadius, getRenderToBaseMap } from "../../utils/shapeOps";
import type { PolyShape } from "../../types/editor";

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
  const activeShape = getActivePolyShape(store);

  // ─── Reset sliders when selection changes ─────────────────────────────────
  const lastSelection = useRef<string>("");
  useEffect(() => {
    const current = Array.from(selectedPointIndices)
      .sort((a, b) => a - b)
      .join(",");
    if (current !== lastSelection.current) {
      setViewState({ cornerRadius: 0 });
      lastSelection.current = current;
    }
  }, [selectedPointIndices, setViewState]);

  // Pre-drag snapshot so we can re-apply from scratch on every tick
  const preDragShape = useRef<PolyShape | null>(null);
  const preDragSelection = useRef<Set<number>>(new Set());

  // ─── Map rendered indices → base indices ─────────────────────────────────
  const getBaseIndicesForSelection = (
    shape: PolyShape,
    sel: Set<number>,
  ): Set<number> => {
    const renderToBase = getRenderToBaseMap(shape);
    const result = new Set<number>();
    sel.forEach((ri) => {
      const bi = renderToBase.get(ri);
      if (bi !== undefined) result.add(bi);
    });
    return result;
  };

  // ─── Apply helper ─────────────────────────────────────────────────────────
  const applyRadius = (base: PolyShape, sel: Set<number>, val: number) => {
    const baseIndices = getBaseIndicesForSelection(base, sel);
    const indicesToUse = baseIndices.size > 0 ? baseIndices : sel;
    // applyCornerRadius already handles reading basePoints correctly and does a full rebuild.
    return Array.from(indicesToUse)
      .sort((a, b) => b - a)
      .reduce<PolyShape>((s, idx) => applyCornerRadius(s, idx, val), base);
  };

  // ─── Slider drag handlers ─────────────────────────────────────────────────
  const handleDragStart = () => {
    if (!activeShape || selectedPointIndices.size === 0) return;
    preDragShape.current = activeShape;
    preDragSelection.current = new Set(selectedPointIndices);
  };

  const handleChange = (val: number) => {
    const clamped = Math.max(0, Math.min(500, val));
    setViewState({ cornerRadius: clamped });
    const base = preDragShape.current;
    if (!base || preDragSelection.current.size === 0) return;
    updateShape(base.id, applyRadius(base, preDragSelection.current, clamped));
  };

  const handleDragEnd = () => {
    if (preDragShape.current) snapshot();
    preDragShape.current = null;
  };

  // One-shot apply (direct input / apply button)
  const handleApplyCorner = () => {
    if (!activeShape || selectedPointIndices.size === 0) return;
    snapshot();
    const r = viewState.cornerRadius;
    updateShape(
      activeShape.id,
      applyRadius(activeShape, selectedPointIndices, r),
    );
    store.deselectAllPoints();
  };

  // Toggle straight / curve
  const toggleCurve = () => {
    if (!activeShape) return;
    snapshot();
    let baseS = activeShape;
    let baked = false;
    if (activeShape.basePoints) {
      baked = true;
      baseS = { ...activeShape, basePoints: undefined, cornerRadii: undefined };
    }
    const newTypes = [...baseS.pointTypes];
    selectedPointIndices.forEach((idx) => {
      newTypes[idx] = newTypes[idx] === "curve" ? "straight" : "curve";
    });

    const updates: any = { pointTypes: newTypes };
    if (baked) {
      updates.basePoints = undefined;
      updates.cornerRadii = undefined;
    }

    updateShape(baseS.id, updates);
  };

  const radius = viewState.cornerRadius;
  const hasSelection = selectedPointIndices.size > 0;

  return (
    <PanelSection title="Selection & Rounding">
      <div className="flex items-center gap-1.5 mb-[5px]">
        <span className="text-dim text-[11px] w-[72px] shrink-0">Selected</span>
        <span className="inline-block bg-accent text-white rounded-[10px] px-1.5 py-px text-[9px] font-mono font-semibold ml-auto">
          {selectedPointIndices.size}
        </span>
      </div>

      <ActionBtn onClick={toggleCurve} compact>
        ⟷ Toggle Straight / Curve
      </ActionBtn>
      <ActionBtn
        variant="danger"
        compact
        onClick={() => {
          snapshot();
          removeSelectedPoints();
        }}
      >
        ✕ Delete Selected (X)
      </ActionBtn>

      <Divider />

      <div className="bg-[#1e1e1e] border border-border rounded-(--radius) p-2 mt-0.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.8px] text-dim mb-2">
          Corner Radius
        </div>

        {/* Slider + number input row */}
        <div className="flex items-center gap-1.5 mb-[5px]">
          <span className="text-dim text-[11px] w-[44px] shrink-0">Radius</span>
          <input
            type="range"
            min={0}
            max={500}
            step={1}
            value={radius}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onMouseUp={handleDragEnd}
            onTouchEnd={handleDragEnd}
            onChange={(e) => handleChange(parseFloat(e.target.value))}
            className="flex-1 h-[3px] appearance-none bg-border2 rounded-sm outline-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-editor-bg"
          />
          <input
            type="number"
            min={0}
            max={500}
            step={1}
            value={radius}
            onChange={(e) => {
              if (!preDragShape.current && activeShape) {
                preDragShape.current = activeShape;
                preDragSelection.current = new Set(selectedPointIndices);
              }
              handleChange(parseFloat(e.target.value) || 0);
            }}
            onBlur={handleDragEnd}
            className="w-[46px] bg-panel border border-border rounded-(--radius) text-accent text-[11px] font-mono px-1.5 py-[2px] outline-none focus:border-accent text-right"
          />
        </div>

        <ActionBtn variant="primary" onClick={handleApplyCorner}>
          ↻ Apply & Deselect
        </ActionBtn>

        {!hasSelection && (
          <p className="text-[10px] text-dim leading-relaxed mt-1.5 opacity-70">
            Select corner point(s) to preview rounding live.
          </p>
        )}
      </div>
    </PanelSection>
  );
}
