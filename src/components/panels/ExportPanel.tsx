import { useState } from "react";
import { useEditorStore } from "../../store/useEditorStore";
import { PanelSection, ActionBtn } from "../ui/components";
import { generateSVGString } from "../../utils/export";
import { FiCopy, FiCheck } from "react-icons/fi";

export function ExportPanel() {
  const { shapes } = useEditorStore();
  const [copied, setCopied] = useState(false);

  const handleCopySVG = () => {
    if (!shapes.length) return;
    const canvas = document.getElementById("editor-canvas") as HTMLCanvasElement | null;
    const W = canvas?.width ?? 800,
      H = canvas?.height ?? 600;
    const svg = generateSVGString(shapes, W, H);

    navigator.clipboard.writeText(svg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <PanelSection title="Export">
      <ActionBtn
        variant={copied ? "success" : "primary"}
        onClick={handleCopySVG}
        disabled={!shapes.length}
        className="justify-center"
      >
        {copied ? (
          <>
            <FiCheck /> Copied!
          </>
        ) : (
          <>
            <FiCopy /> Copy SVG Code
          </>
        )}
      </ActionBtn>
      {!shapes.length && (
        <p className="text-[10px] text-dim mt-2 text-center italic">
          Draw something to enable export
        </p>
      )}
    </PanelSection>
  );
}
