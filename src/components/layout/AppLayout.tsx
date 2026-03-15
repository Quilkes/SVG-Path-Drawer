import { BlenderToolbar } from "./BlenderToolbar";
import { Sidebar } from "./Sidebar";
import { useEditorStore } from "../../store/useEditorStore";
import { RightSidebar } from "./RightSidebar";
import { EditorCanvas } from "../canvas/EditorCanvas";
import { ShortcutsPanel } from "../panels/ShortcutsPanel";
import { Popover } from "../ui/components";
import { FiInfo } from "react-icons/fi";

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <BlenderToolbar />
        <Sidebar />
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {/* Canvas Viewport Header (like 3D Viewport header in Blender) */}
          <div className="h-14 bg-panel2 border-b border-border flex items-center px-3 shrink-0 text-dim text-[11px] justify-between">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
              Editor Viewport
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => useEditorStore.getState().clearAll()}
                className="flex items-center gap-1.5 px-2 py-1 hover:bg-editor-red/20 rounded-(--radius) transition-colors text-dim hover:text-editor-red"
                title="Clear Workspace"
              >
                <span>Clear All</span>
              </button>
              <Popover
                align="right"
                trigger={
                  <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-border2 rounded-(--radius) transition-colors text-dim hover:text-text-head">
                    <FiInfo size={14} />
                    <span>Shortcuts</span>
                  </button>
                }
              >
                <div className="w-[220px]">
                  <div className="px-3 py-2 border-b border-border bg-panel2 font-mono text-[9px] uppercase tracking-widest text-dim">
                    Keyboard Shortcuts
                  </div>
                  <ShortcutsPanel />
                </div>
              </Popover>
            </div>
          </div>
          <EditorCanvas />
        </div>
        <RightSidebar />
      </div>
    </div>
  );
}
