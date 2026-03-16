import { StylePanel } from "../panels/StylePanel";
import { ExportPanel } from "../panels/ExportPanel";
import { motion } from "framer-motion";

export function RightSidebar() {
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="absolute right-0 top-14 bottom-0 w-[280px] shrink-0 bg-panel/85 backdrop-blur-xl border-l border-border/50 ring-1 ring-white/5 flex flex-col overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border2 [&::-webkit-scrollbar-thumb]:rounded-[3px] z-10 pointer-events-auto shadow-2xl"
    >
      <StylePanel />
      <ExportPanel />
    </motion.div>
  );
}
