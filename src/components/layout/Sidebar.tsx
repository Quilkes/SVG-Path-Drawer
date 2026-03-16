import { RoundingPanel } from "../panels/RoundingPanel";
import { OptionsPanel } from "../panels/OptionsPanel";
import { motion } from "framer-motion";

export function Sidebar() {
  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="absolute left-0 top-14 w-75 h-fit shrink-0 bg-panel border-r border-b border-border flex flex-col overflow-hidden rounded-br-(--radius) z-10 pointer-events-auto shadow-xl"
    >
      <RoundingPanel />
      <OptionsPanel />
    </motion.div>
  );
}
