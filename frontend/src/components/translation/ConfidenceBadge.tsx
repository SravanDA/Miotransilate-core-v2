import { Sparkle as Sparkles, Warning } from "@phosphor-icons/react";

interface ConfidenceBadgeProps {
  confidence?: number;
  status?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBadge({
  confidence,
  status,
  size = "sm",
  showLabel = false,
  className = ""
}: ConfidenceBadgeProps) {
  // Approved by human review = 100% verified, no badge needed
  if (status === "Approved" && (confidence === undefined || confidence === null || confidence <= 0)) {
    return (
      <div
        className={`inline-flex items-center gap-1 font-mono font-medium rounded-md border select-none transition-colors whitespace-nowrap shrink-0 text-emerald-400 bg-emerald-500/10 border-emerald-500/20 ${
          size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
        } ${className}`}
        title="Approved by human reviewer"
      >
        <Sparkles className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0 opacity-80`} weight="fill" />
        <span className="tabular-nums font-semibold">Verified</span>
      </div>
    );
  }

  // No real confidence data = show "Unverified" honestly
  if (confidence === undefined || confidence === null || confidence <= 0) {
    if (status === "No Trans" || status === "No Eng" || status === "Deprecated") {
      return null; // No badge for untranslated/deprecated
    }
    return (
      <div
        className={`inline-flex items-center gap-1 font-mono font-medium rounded-md border select-none transition-colors whitespace-nowrap shrink-0 text-zinc-400 bg-zinc-500/10 border-zinc-500/20 ${
          size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
        } ${className}`}
        title="No verified confidence score available — manual review recommended"
      >
        <Warning className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0 opacity-70`} weight="fill" />
        <span className="font-medium">Unverified</span>
      </div>
    );
  }

  const score = confidence;

  // Calibrated confidence tiers:
  // >= 85%: High confidence (eligible for bulk approve)
  // 70-84%: Medium confidence (manual inspection advised)
  // 50-69%: Low confidence (needs attention)
  // < 50%:  Very low (untranslated fallback / blocked)
  const isHigh = score >= 85;
  const isMed = score >= 70 && score < 85;
  const isLow = score >= 50 && score < 70;

  const colorClasses = isHigh
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : isMed
    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : isLow
    ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
    : "text-rose-400 bg-rose-500/10 border-rose-500/20";

  const tierLabel = isHigh
    ? "High Confidence — Eligible for bulk approve"
    : isMed
    ? "Medium — Manual review advised"
    : isLow
    ? "Low — Needs attention before approval"
    : "Very Low — Translation may be untranslated or incorrect";

  return (
    <div
      className={`inline-flex items-center gap-1 font-mono font-medium rounded-md border select-none transition-colors whitespace-nowrap shrink-0 ${colorClasses} ${
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
      } ${className}`}
      title={`Confidence Score: ${score}% — ${tierLabel}`}
    >
      <Sparkles className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} shrink-0 opacity-80`} weight="fill" />
      <span className="tabular-nums font-semibold">{score}%</span>
      {showLabel && <span className="text-[10px] font-normal opacity-80">Confidence</span>}
    </div>
  );
}

