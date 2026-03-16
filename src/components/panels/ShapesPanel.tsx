import { useEditorStore } from '../../store/useEditorStore';
import { PanelSection } from '../ui/components';
import { getStyleFromPanel } from '../../utils/shapeFactory';
import { FaSquareFull, FaCircle, FaTimes } from 'react-icons/fa';
import { BsTriangleFill } from 'react-icons/bs';

export function ShapesPanel() {
  const { shapes, activeId, shapeCounter, addShape, removeShape, setActiveShape, snapshot } = useEditorStore();

  const createRect = () => {
    const { width: W, height: H } = getCanvasCenter();
    const cx = W / 2, cy = H / 2;
    const w = Math.min(200, W * 0.35), h = Math.min(140, H * 0.35);
    const id = Date.now();
    snapshot();
    addShape({
      id, name: `Rect ${shapeCounter + 1}`, kind: 'poly',
      points: [
        { x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy + h / 2 }, { x: cx - w / 2, y: cy + h / 2 },
      ],
      pointTypes: ['straight', 'straight', 'straight', 'straight'],
      ctrlPoints: {},
      ...getStyleFromPanel(),
    });
    setActiveShape(id);
  };

  const createTriangle = () => {
    const { width: W, height: H } = getCanvasCenter();
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) * 0.22;
    const id = Date.now();
    snapshot();
    addShape({
      id, name: `Triangle ${shapeCounter + 1}`, kind: 'poly',
      points: [
        { x: cx,                y: cy - r             },
        { x: cx + r * 0.866,   y: cy + r * 0.5       },
        { x: cx - r * 0.866,   y: cy + r * 0.5       },
      ],
      pointTypes: ['straight', 'straight', 'straight'],
      ctrlPoints: {},
      ...getStyleFromPanel(),
    });
    setActiveShape(id);
  };

  /**
   * True circle shape — uses 'circle' kind so it renders as a perfect arc.
   */
  const createCircle = () => {
    const { width: W, height: H } = getCanvasCenter();
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) * 0.18;
    const id = Date.now();
    snapshot();
    addShape({
      id,
      name: `Circle ${shapeCounter + 1}`,
      kind: 'circle',
      cx, cy, r,
      ...getStyleFromPanel(),
    });
    setActiveShape(id);
  };

  return (
    <PanelSection title="Shapes">
      <div className="grid grid-cols-3 gap-1 mb-1.5">
        {[
          { label: 'Rectangle', icon: <FaSquareFull className="text-[13px]" />, action: createRect },
          { label: 'Circle',    icon: <FaCircle     className="text-[13px]" />, action: createCircle },
          { label: 'Triangle',  icon: <BsTriangleFill className="text-[12px]" />, action: createTriangle },
        ].map(({ label, icon, action }) => (
          <button
            key={label}
            onClick={action}
            className="bg-panel2 border border-border rounded-(--radius) text-editor-text font-mono text-[9px] py-[7px] px-1 cursor-pointer text-center flex flex-col items-center gap-[3px] transition-all duration-100 hover:bg-border2 hover:border-accent"
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Shape list */}
      <div>
        {[...shapes].reverse().map(s => (
          <div
            key={s.id}
            onClick={() => setActiveShape(s.id)}
            className={`flex items-center gap-1.5 px-1.5 py-1 rounded-(--radius) mb-[3px] cursor-pointer border transition-all duration-100 ${
              s.id === activeId ? 'border-accent bg-[#2a1f0e]' : 'border-transparent hover:bg-panel2'
            }`}
          >
            <div
              className={`w-2.5 h-2.5 shrink-0 border ${s.kind === 'circle' ? 'rounded-full' : 'rounded-[2px]'}`}
              style={{
                background: s.fillType === 'none' ? 'transparent' : s.fillColor,
                borderColor: s.strokeColor,
              }}
            />
            <span className="text-[11px] flex-1 text-editor-text">{s.name}</span>
            <span className="text-[8px] font-mono text-dim/50 uppercase">{s.kind}</span>
            <button
              className="bg-transparent border-none text-dim cursor-pointer text-[12px] p-0 px-0.5 hover:text-editor-red transition-colors duration-100"
              onClick={(e) => { e.stopPropagation(); snapshot(); removeShape(s.id); }}
            >
              <FaTimes />
            </button>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

function getCanvasCenter() {
  const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement | null;
  return { width: canvas?.width ?? 800, height: canvas?.height ?? 600 };
}
