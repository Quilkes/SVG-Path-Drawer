import { useEditorStore } from "../../store/useEditorStore";
import { getStyleFromPanel } from "../../utils/shapeFactory";
import {
  FiMousePointer,
  FiEdit3,
  FiMove,
  FiMaximize2,
  FiSquare,
  FiCircle,
} from "react-icons/fi";
import { cn, Tooltip } from "../ui/components";
import type {
  EditorMode,
  Shape,
  Point,
  GradientStop,
} from "../../types/editor";

export function BlenderToolbar() {
  const { mode, setMode, addShape } = useEditorStore();

  const handleCreateShape = (type: "rect" | "circle") => {
    const style = getStyleFromPanel(); // Gets defaults
    const id = Date.now();
    const cx = 300;
    const cy = 300;
    let pts: Point[] = [];
    const types: ("straight" | "curve")[] = [];

    if (type === "rect") {
      const w = 150;
      const h = 100;
      pts = [
        { x: cx - w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy + h / 2 },
        { x: cx - w / 2, y: cy + h / 2 },
      ];
      pts.forEach(() => types.push("straight"));
    } else {
      const r = 70;
      for (let i = 0; i < 4; i++) {
        const th = i * (Math.PI / 2);
        pts.push({ x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) });
        types.push("curve");
      }
    }

    const s: Shape = {
      id,
      name:
        type === "rect"
          ? "Rect " + id.toString().slice(-4)
          : "Circle " + id.toString().slice(-4),
      kind: "poly",
      points: pts,
      pointTypes: types,
      ctrlPoints: {},
      fillType: style.fillType as "solid" | "gradient",
      fillColor: style.fillColor,
      gradientStops: style.gradientStops as GradientStop[],
      strokeColor: style.strokeColor,
      strokeWidth: style.strokeWidth,
      opacity: style.opacity,
    };
    addShape(s);
  };

  const tools: { m: EditorMode; i: React.ReactNode; t: string }[] = [
    { m: "edit", i: <FiMousePointer size={18} />, t: "Select/Edit" },
    { m: "addpt", i: <FiEdit3 size={18} />, t: "Add Point" },
    { m: "move", i: <FiMove size={18} />, t: "Move Tool" },
    { m: "scale", i: <FiMaximize2 size={18} />, t: "Scale Tool" },
  ];

  return (
    <div className="w-14 shrink-0 border-r border-border flex flex-col items-center py-2 px-0.5 gap-2 overflow-y-auto">
      {tools.map((t) => (
        <Tooltip key={t.m} content={t.t}>
          <button
            onClick={() => setMode(t.m)}
            className={cn(
              "w-[32px] h-[32px] bg-muted flex items-center justify-center rounded-[4px] transition-colors focus:outline-none",
              mode === t.m
                ? "bg-[#3a5888] text-white"
                : "text-dim hover:bg-border2 hover:text-text-head",
            )}
          >
            {t.i}
          </button>
        </Tooltip>
      ))}

      <div className="w-8 h-px bg-border2 my-1" />

      <Tooltip content="Add Rectangle">
        <button
          onClick={() => handleCreateShape("rect")}
          className="w-[32px] h-[32px] flex items-center justify-center rounded-[4px] text-dim hover:bg-border2 hover:text-text-head transition-colors focus:outline-none"
        >
          <FiSquare size={16} />
        </button>
      </Tooltip>

      <Tooltip content="Add Circle">
        <button
          onClick={() => handleCreateShape("circle")}
          className="w-[32px] h-[32px] flex items-center justify-center rounded-[4px] text-dim hover:bg-border2 hover:text-text-head transition-colors focus:outline-none"
        >
          <FiCircle size={16} />
        </button>
      </Tooltip>
    </div>
  );
}
