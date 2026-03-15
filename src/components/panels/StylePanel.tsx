import { useState } from "react";
import { useEditorStore, getActiveShape } from "../../store/useEditorStore";
import {
  PanelSection,
  Slider,
  ActionBtn,
  Divider,
  PropRow,
} from "../ui/components";
import type { FillType, GradientStop } from "../../types/editor";
import { FiPlus, FiX } from "react-icons/fi";

export function StylePanel() {
  const store = useEditorStore();
  const { updateShape } = store;
  const activeShape = getActiveShape(store);

  // Local gradient stops state
  const [gradientStops, setGradientStops] = useState<GradientStop[]>(
    activeShape?.gradientStops ?? [
      { color: "#e87d0d", offset: 0 },
      { color: "#4a9eff", offset: 1 },
    ],
  );

  if (!activeShape) {
    return (
      <PanelSection title="Fill & Stroke">
        <p className="text-dim text-[11px]">No shape selected.</p>
      </PanelSection>
    );
  }

  const update = (partial: Partial<typeof activeShape>) => {
    updateShape(activeShape.id, partial);
  };

  const addStop = () => {
    const newStop: GradientStop = { color: "#5fb94a", offset: 0.5 };
    const updated = [...gradientStops, newStop];
    setGradientStops(updated);
    update({ gradientStops: updated });
  };

  const removeStop = (i: number) => {
    const updated = gradientStops.filter((_, idx) => idx !== i);
    setGradientStops(updated);
    update({ gradientStops: updated });
  };

  const updateStop = (i: number, changes: Partial<GradientStop>) => {
    const updated = gradientStops.map((s, idx) =>
      idx === i ? { ...s, ...changes } : s,
    );
    setGradientStops(updated);
    update({ gradientStops: updated });
  };

  return (
    <PanelSection title="Fill & Stroke">
      {/* Fill type */}
      <PropRow label="Fill type">
        <select
          value={activeShape.fillType}
          onChange={(e) => update({ fillType: e.target.value as FillType })}
          className="flex-1 bg-panel2 border border-border rounded-(--radius) text-editor-text text-[11px] px-1.5 py-[3px] outline-none cursor-pointer focus:border-accent"
        >
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
          <option value="none">None</option>
        </select>
      </PropRow>

      {/* Solid fill */}
      {activeShape.fillType === "solid" && (
        <PropRow label="Fill color">
          <input
            type="color"
            value={activeShape.fillColor}
            onChange={(e) => update({ fillColor: e.target.value })}
            className="w-7 h-[22px] border border-border rounded-(--radius) cursor-pointer bg-transparent p-px"
          />
        </PropRow>
      )}

      {/* Gradient fill */}
      {activeShape.fillType === "gradient" && (
        <>
          <div className="text-dim text-[11px] mb-[5px]">Gradient stops</div>
          {gradientStops.map((stop, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1">
              <input
                type="color"
                value={stop.color}
                onChange={(e) => updateStop(i, { color: e.target.value })}
                className="w-7 h-[22px] border border-border rounded-(--radius) cursor-pointer bg-transparent p-px"
              />
              <input
                type="number"
                value={Math.round(stop.offset * 100)}
                min={0}
                max={100}
                onChange={(e) =>
                  updateStop(i, { offset: parseInt(e.target.value) / 100 })
                }
                className="w-full bg-panel2 border border-border rounded-(--radius) text-editor-text text-[11px] px-[5px] py-[3px] font-mono outline-none"
              />
              {gradientStops.length > 2 && (
                <button
                  onClick={() => removeStop(i)}
                  className="bg-transparent border border-border rounded-(--radius) text-dim text-sm leading-none cursor-pointer px-[5px] py-px hover:border-editor-red hover:text-editor-red transition-colors duration-100"
                >
                  <FiX />
                </button>
              )}
            </div>
          ))}
          <ActionBtn variant="success" onClick={addStop}>
            <FiPlus /> Add Stop
          </ActionBtn>
        </>
      )}

      <Divider />

      {/* Stroke */}
      <PropRow label="Stroke color">
        <input
          type="color"
          value={activeShape.strokeColor}
          onChange={(e) => update({ strokeColor: e.target.value })}
          className="w-7 h-[22px] border border-border rounded-(--radius) cursor-pointer bg-transparent p-px"
        />
      </PropRow>
      <Slider
        label="Stroke width"
        value={activeShape.strokeWidth}
        min={0}
        max={20}
        step={0.5}
        onChange={(val) => update({ strokeWidth: val })}
      />
      <Slider
        label="Opacity"
        value={activeShape.opacity}
        min={0}
        max={1}
        step={0.05}
        onChange={(val) => update({ opacity: val })}
      />
    </PanelSection>
  );
}
