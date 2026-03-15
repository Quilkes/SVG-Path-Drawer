import { type ReactNode, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { motion, AnimatePresence } from "framer-motion";

// ─── Panel Section (Collapsible) ──────────────────────────────────────────
interface PanelSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function PanelSection({
  title,
  children,
  defaultOpen = true,
}: PanelSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border">
      <div
        className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer select-none bg-panel2 hover:bg-[#2f2f2f] transition-colors duration-100"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-mono text-[10px] font-semibold tracking-widest uppercase text-dim">
          {title}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex items-center justify-center"
        >
          <FiChevronDown className="text-[9px] text-dim" />
        </motion.div>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-2.5 py-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Toggle ────────────────────────────────────────────────────────────────
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 mb-[5px] cursor-pointer">
      <div
        className="relative flex-shrink-0 w-7 h-3.5 cursor-pointer"
        onClick={() => onChange(!checked)}
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-colors duration-150",
            checked ? "bg-accent" : "bg-border2",
          )}
        />
        <div
          className={cn(
            "absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all duration-150",
            checked ? "left-[18px] bg-white" : "left-0.5 bg-dim",
          )}
        />
      </div>
      <span className="text-[11px] text-editor-text">{label}</span>
    </label>
  );
}

// ─── Action Button ─────────────────────────────────────────────────────────
interface ActionBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "success" | "danger";
  compact?: boolean;
}

export function ActionBtn({
  children,
  variant = "default",
  compact = false,
  className,
  ...props
}: ActionBtnProps) {
  return (
    <button
      className={cn(
        "w-full border rounded-(--radius) text-[11px] font-sans cursor-pointer text-left flex items-center gap-1.5 transition-all duration-100 focus:outline-none select-none",
        compact ? "px-2 py-1 mb-0" : "px-2.5 py-1.5 mb-1",
        variant === "default" &&
          "bg-panel2 border-border text-editor-text hover:bg-border2 hover:text-text-head",
        variant === "primary" &&
          "bg-accent border-accent2 text-white font-semibold hover:bg-accent2",
        variant === "success" &&
          "bg-panel2 border-editor-green text-editor-green hover:bg-[#2a3a26]",
        variant === "danger" &&
          "bg-panel2 border-editor-red text-editor-red hover:bg-[#3a2626]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── Slider Row ────────────────────────────────────────────────────────────
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onDragStart,
  onDragEnd,
}: SliderProps) {
  return (
    <div className="flex items-center gap-1.5 mb-[5px]">
      <span className="text-dim text-[11px] w-[72px] shrink-0 whitespace-nowrap">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        onMouseUp={onDragEnd}
        onTouchEnd={onDragEnd}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-[3px] appearance-none bg-border2 rounded-sm outline-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-editor-bg"
      />
      <span className="font-mono text-[10px] text-accent ml-auto min-w-[30px] text-right">
        {value}
      </span>
    </div>
  );
}

// ─── Prop Row ──────────────────────────────────────────────────────────────
export function PropRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-[5px]">
      <span className="text-dim text-[11px] w-[72px] shrink-0 whitespace-nowrap">
        {label}
      </span>
      {children}
    </div>
  );
}

// ─── Divider ───────────────────────────────────────────────────────────────
export function Divider() {
  return <div className="h-px bg-border my-1.5" />;
}

// ─── Select ────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function Select({ label, children, ...props }: SelectProps) {
  return (
    <PropRow label={label}>
      <select
        className="flex-1 bg-panel2 border border-border rounded-(--radius) text-editor-text text-[11px] px-1.5 py-[3px] outline-none cursor-pointer focus:border-accent"
        {...props}
      >
        {children}
      </select>
    </PropRow>
  );
}

// ─── Number Input ──────────────────────────────────────────────────────────
export function NumberInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      type="number"
      className="flex-1 bg-panel2 border border-border rounded-(--radius) text-editor-text text-[11px] px-1.5 py-[3px] font-mono outline-none focus:border-accent"
      {...props}
    />
  );
}

// ─── Tool Button ───────────────────────────────────────────────────────────
interface ToolBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function ToolBtn({
  active,
  children,
  className,
  ...props
}: ToolBtnProps) {
  return (
    <button
      className={cn(
        "bg-panel2 border border-border rounded-(--radius) text-editor-text font-mono text-[9px] py-[7px] px-1 cursor-pointer text-center flex flex-col items-center gap-[3px] transition-all duration-100 hover:bg-border2 hover:border-accent hover:text-text-head",
        active && "bg-accent border-accent text-white font-semibold",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
// ─── Popover ──────────────────────────────────────────────────────────────
interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}

export function Popover({ trigger, children, align = "left" }: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer select-none"
      >
        {trigger}
      </div>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                "absolute top-full mt-1 z-50 bg-panel border border-border rounded-(--radius) shadow-xl min-w-[200px] overflow-hidden origin-top",
                align === "left" ? "left-0" : "right-0",
              )}
              onClick={() => setIsOpen(false)}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
import { createPortal } from "react-dom";
import { useRef } from "react";

// ─── Tooltip ──────────────────────────────────────────────────────────────
interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number;
}

export function Tooltip({ content, children, delay = 300 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.top + rect.height / 2,
          left: rect.right + 8,
        });
        setIsVisible(true);
      }
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  return (
    <div
      ref={triggerRef}
      className="relative flex items-center justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: "translateY(-50%)",
            }}
            className="fixed px-2.5 py-1.5 bg-[#2b2b2b] border border-[#444] text-[#eee] text-[10px] font-sans rounded-md shadow-2xl z-9999 whitespace-nowrap pointer-events-none animate-in fade-in zoom-in duration-150 origin-left select-none"
          >
            {/* Arrow */}
            <div className="absolute top-1/2 -left-[4px] -mt-[4px] border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-4 border-r-[#444]" />
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
