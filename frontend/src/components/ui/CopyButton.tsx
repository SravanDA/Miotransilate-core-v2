import React, { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

interface CopyButtonProps {
  text: string;
  className?: string;
  iconClassName?: string;
  title?: string;
}

export function CopyButton({
  text,
  className = "",
  iconClassName = "w-3.5 h-3.5",
  title = "Copy to clipboard"
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn("Failed to copy text:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : title}
      className={`inline-flex items-center justify-center p-1 rounded-md transition-all duration-150 cursor-pointer outline-none select-none ${
        copied
          ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20"
          : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover active:scale-95"
      } ${className}`}
      aria-label={copied ? "Copied" : title}
    >
      {copied ? (
        <Check className={`${iconClassName} text-emerald-500 shrink-0`} weight="bold" />
      ) : (
        <Copy className={`${iconClassName} shrink-0`} weight="bold" />
      )}
    </button>
  );
}
