import { useEditorStore } from '../../store/useEditorStore';
import { PanelSection, Toggle } from '../ui/components';

export function OptionsPanel() {
  const { viewState, setViewState } = useEditorStore();

  return (
    <PanelSection title="Options">
      <Toggle
        checked={viewState.snapToGrid}
        onChange={(v) => setViewState({ snapToGrid: v })}
        label="Snap to Grid (20px)"
      />
      <Toggle
        checked={viewState.showGuides}
        onChange={(v) => setViewState({ showGuides: v })}
        label="Alignment Guides"
      />
    </PanelSection>
  );
}
