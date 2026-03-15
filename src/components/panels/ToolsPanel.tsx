import { useEditorStore } from '../../store/useEditorStore';
import { PanelSection, ToolBtn } from '../ui/components';
import { FiTarget, FiEdit3, FiMove, FiMaximize2 } from 'react-icons/fi';
import type { EditorMode } from '../../types/editor';

const tools: { mode: EditorMode; icon: React.ReactNode; label: string }[] = [
  { mode: 'edit',   icon: <FiTarget className="text-[13px]" />,     label: 'Edit'   },
  { mode: 'addpt',  icon: <FiEdit3 className="text-[13px]" />,      label: 'Add Pt' },
  { mode: 'move',   icon: <FiMove className="text-[13px]" />,       label: 'Move'   },
  { mode: 'scale',  icon: <FiMaximize2 className="text-[13px]" />,  label: 'Scale'  },
];

export function ToolsPanel() {
  const { mode, setMode } = useEditorStore();

  return (
    <PanelSection title="Tools">
      <div className="grid grid-cols-2 gap-1 mb-1.5">
        {tools.map(t => (
          <ToolBtn
            key={t.mode}
            active={mode === t.mode}
            onClick={() => setMode(t.mode)}
          >
            {t.icon}
            {t.label}
          </ToolBtn>
        ))}
      </div>
      <div className="text-[10px] text-dim leading-relaxed">
        <span className="text-editor-text font-semibold">Edit</span> — drag pts • R-click=add to sel<br />
        <span className="text-editor-text font-semibold">Add Pt</span> — click edge to insert<br />
        <span className="text-editor-text font-semibold">Move</span> — drag shape • arrow keys nudge<br />
        <span className="text-editor-text font-semibold">Scale</span> — drag to resize from center<br />
        <span className="text-editor-text font-semibold">G</span> — grab &nbsp;
        <span className="text-editor-text font-semibold">A</span> — select all
      </div>
    </PanelSection>
  );
}
