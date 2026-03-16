import { BlenderToolbar } from "./BlenderToolbar";
import { Sidebar } from "./Sidebar";
import { useEditorStore } from "../../store/useEditorStore";
import { RightSidebar } from "./RightSidebar";
import { EditorCanvas } from "../canvas/EditorCanvas";
import { ShortcutsPanel } from "../panels/ShortcutsPanel";
import { Popover } from "../ui/components";
import { FiInfo, FiSidebar, FiMaximize } from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

export function AppLayout() {
  const { viewState, setViewState } = useEditorStore();
  const isZen = viewState.zenMode;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "Tab" || e.key.toLowerCase() === "f") &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        setViewState({ zenMode: !useEditorStore.getState().viewState.zenMode });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setViewState]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      <div className="flex flex-1 overflow-hidden relative">
        <AnimatePresence>
          {!isZen && (
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="z-30"
            >
              <BlenderToolbar />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 relative overflow-hidden flex flex-col">
          {/* Canvas Viewport Header */}
          <AnimatePresence>
            {!isZen && (
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="h-14 bg-panel2/90 backdrop-blur-md border-b border-border/50 flex items-center px-3 shrink-0 text-dim text-[11px] justify-between z-20 relative ring-1 ring-white/5"
              >
                <span className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setViewState({
                        leftSidebarOpen: !viewState.leftSidebarOpen,
                      })
                    }
                    className={`p-1.5 rounded-(--radius) transition-colors ${viewState.leftSidebarOpen ? "bg-accent/20 text-accent" : "hover:bg-border2 text-dim hover:text-text-head"}`}
                    title="Toggle Left Sidebar"
                  >
                    <FiSidebar size={14} />
                  </button>
                  <div className="w-2 h-2 rounded-full bg-accent ml-2 shadow-[0_0_8px_rgba(255,100,0,0.6)]"></div>
                  <span className="font-medium tracking-wide">
                    Editor Viewport
                  </span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewState({ zenMode: true })}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-border2 rounded-(--radius) transition-colors text-dim hover:text-text-head mr-2"
                    title="Zen Mode (Tab or F)"
                  >
                    <FiMaximize size={12} />
                    <span>Zen Mode</span>
                  </button>

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
                    <div className="w-55">
                      <div className="px-3 py-2 border-b border-border bg-panel2 font-mono text-[9px] uppercase tracking-widest text-dim">
                        Keyboard Shortcuts
                      </div>
                      <ShortcutsPanel />
                    </div>
                  </Popover>

                  <button
                    onClick={() =>
                      setViewState({
                        rightSidebarOpen: !viewState.rightSidebarOpen,
                      })
                    }
                    className={`p-1.5 rounded-(--radius) transition-colors ml-1 ${viewState.rightSidebarOpen ? "bg-accent/20 text-accent" : "hover:bg-border2 text-dim hover:text-text-head"}`}
                    title="Toggle Right Sidebar"
                  >
                    <FiSidebar size={14} className="rotate-180" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <EditorCanvas />

          <AnimatePresence>
            {!isZen && viewState.leftSidebarOpen && (
              <Sidebar key="left-sidebar" />
            )}
            {!isZen && viewState.rightSidebarOpen && (
              <RightSidebar key="right-sidebar" />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
