import { useEditorStore } from '../../store/useEditorStore';
import { PanelSection } from '../ui/components';
import { getStyleFromPanel } from '../../utils/shapeFactory';
import { FaSquareFull, FaCircle, FaTimes } from 'react-icons/fa';

export function ShapesPanel() {
  const { shapes, activeId, shapeCounter, addShape, removeShape, setActiveShape, snapshot } = useEditorStore();

  const createRect = () => {
    const { width: W, height: H } = getCanvasSize();
    const cx = W / 2, cy = H / 2;
    const w = Math.min(200, W * 0.35), h = Math.min(140, H * 0.35);
    const id = Date.now();
    snapshot();
    addShape({
      id,
      name: `Rect ${shapeCounter + 1}`,
      kind: 'poly',
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

  const createCircle = () => {
    const { width: W, height: H } = getCanvasSize();
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) * 0.18;
    const N = 8;
    const points = [], pointTypes = [], ctrlPoints: Record<number, { x: number; y: number }> = {};
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
      pointTypes.push('curve' as const);
    }
    const rCtrl = r / Math.cos(Math.PI / N);
    for (let i = 0; i < N; i++) {
      const midAngle = ((i + 0.5) / N) * Math.PI * 2 - Math.PI / 2;
      ctrlPoints[i] = { x: cx + Math.cos(midAngle) * rCtrl, y: cy + Math.sin(midAngle) * rCtrl };
    }
    const id = Date.now();
    snapshot();
    addShape({
      id,
      name: `Circle ${shapeCounter + 1}`,
      kind: 'poly',
      points,
      pointTypes: ['curve', 'curve', 'curve', 'curve', 'curve', 'curve', 'curve', 'curve'] as const,
      ctrlPoints,
      ...getStyleFromPanel(),
    });
    setActiveShape(id);
  };

  return (
    <PanelSection title="Shapes">
      <div className="grid grid-cols-2 gap-1 mb-1.5">
        <button
          onClick={createRect}
          className="bg-panel2 border border-border rounded-[var(--radius)] text-editor-text font-mono text-[9px] py-[7px] px-1 cursor-pointer text-center flex flex-col items-center gap-[3px] transition-all duration-100 hover:bg-border2 hover:border-accent"
        >
          <FaSquareFull className="text-[13px]" />
          Rectangle
        </button>
        <button
          onClick={createCircle}
          className="bg-panel2 border border-border rounded-[var(--radius)] text-editor-text font-mono text-[9px] py-[7px] px-1 cursor-pointer text-center flex flex-col items-center gap-[3px] transition-all duration-100 hover:bg-border2 hover:border-accent"
        >
          <FaCircle className="text-[13px]" />
          Circle
        </button>
      </div>

      {/* Shape list */}
      <div>
        {[...shapes].reverse().map(s => (
          <div
            key={s.id}
            onClick={() => setActiveShape(s.id)}
            className={`flex items-center gap-1.5 px-1.5 py-1 rounded-[var(--radius)] mb-[3px] cursor-pointer border transition-all duration-100 ${
              s.id === activeId
                ? 'border-accent bg-[#2a1f0e]'
                : 'border-transparent hover:bg-panel2'
            }`}
          >
            <div
              className="w-2.5 h-2.5 rounded-[2px] shrink-0 border"
              style={{
                background: s.fillType === 'none' ? 'transparent' : s.fillColor,
                borderColor: s.strokeColor,
              }}
            />
            <span className="text-[11px] flex-1 text-editor-text">{s.name}</span>
            <button
              className="bg-transparent border-none text-dim cursor-pointer text-[12px] p-0 px-0.5 hover:text-editor-red transition-colors duration-100"
              onClick={(e) => {
                e.stopPropagation();
                snapshot();
                removeShape(s.id);
              }}
            >
              <FaTimes />
            </button>
          </div>
        ))}
      </div>
    </PanelSection>
  );
}

// Helpers
function getCanvasSize() {
  const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement | null;
  return { width: canvas?.width ?? 800, height: canvas?.height ?? 600 };
}
