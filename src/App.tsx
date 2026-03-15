import { useState, useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { FiMonitor } from "react-icons/fi";

export default function App() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isDesktop) {
    return (
      <div className="fixed inset-0 bg-[#0b0b0b] z-9999 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
          <FiMonitor size={32} className="text-accent" />
        </div>
        <h1 className="text-2xl font-semibold text-text-head mb-3 font-mono tracking-tight">
          Desktop Environment Required
        </h1>
        <p className="text-dim text-sm max-w-xs leading-relaxed">
          The SVG Path Drawer is a professional design tool optimized for
          precision cursor input and large displays. Please switch to a desktop
          to start creating.
        </p>
        <div className="mt-8 flex gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
          <div className="w-1.5 h-1.5 rounded-full bg-dim/20" />
          <div className="w-1.5 h-1.5 rounded-full bg-dim/20" />
        </div>
      </div>
    );
  }

  return <AppLayout />;
}
