import { RoundingPanel } from "../panels/RoundingPanel";
import { OptionsPanel } from "../panels/OptionsPanel";

export function Sidebar() {
  return (
    <div className="w-[300px] h-fit shrink-0 bg-panel border-r border-b border-border flex flex-col overflow-hidden rounded-br-(--radius) self-start">
      <RoundingPanel />
      <OptionsPanel />
    </div>
  );
}
