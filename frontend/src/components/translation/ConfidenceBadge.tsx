import { Sparkle as Sparkles } from "@phosphor-icons/react";

interface ConfidenceBadgeProps {
  confidence?: number;
  status?: string;
  size?: "sm" | "md";
  className?: string;
}

export function ConfidenceBadge({
  confidence,
  status,
  size = "sm",
  className = ""
}: ConfidenceBadgeProps) {
  let score = confidence;
  if (score === undefined || score === null || score <= 0) {
    if (status === "Approved") {
      score = 100;
    } else if (status === "Pending Review" || status === "Draft") {
      score = 95;
    } else {
      return null;
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded border border-border-subtle bg-bg-main text-text-secondary select-none transition-colors ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${className}`}
      title={`AI Confidence: ${score}%`}
    >
      <Sparkles className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} text-accent-blue`} />
      <span>{score}% Confidence</span>
    </div>
  );
}
