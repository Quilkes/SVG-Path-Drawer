import { StylePanel } from "../panels/StylePanel";
import { ExportPanel } from "../panels/ExportPanel";

export function RightSidebar() {
  return (
    <div className="w-[280px] shrink-0 bg-panel border-l border-border flex flex-col overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:bg-border2 [&::-webkit-scrollbar-thumb]:rounded-[3px]">
      <StylePanel />
      <ExportPanel />
    </div>
  );
}
