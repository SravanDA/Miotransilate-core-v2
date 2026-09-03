import { WarningCircle as AlertCircle } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

interface TranslationLengthGaugeProps {
  sourceText: string;
  translatedText: string;
}

export function TranslationLengthGauge({ sourceText, translatedText }: TranslationLengthGaugeProps) {
  const sourceLen = sourceText.length;
  const transLen = translatedText.length;

  if (sourceLen === 0) return null;

  const ratio = transLen / sourceLen;
  const percentage = Math.round(ratio * 100);

  // Determine severity and colors
  let severity: "normal" | "warning" | "danger" = "normal";
  let barColor = "bg-[#5e6ad2]";
  let textColor = "text-text-secondary";

  if (ratio > 1.5) {
    severity = "danger";
    barColor = "bg-rose-500";
    textColor = "text-rose-500";
  } else if (ratio > 1.25) {
    severity = "warning";
    barColor = "bg-amber-500";
    textColor = "text-amber-500";
  }

  // Cap the progress bar width at 200% so it doesn't break layout
  const barWidth = Math.min(percentage, 200);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="text-text-tertiary">Length vs English Source</span>
        <span className={cn("font-mono font-medium", textColor)}>{percentage}%</span>
      </div>
      
      {/* Progress Bar Track */}
      <div className="h-1.5 w-full bg-border-subtle rounded-full overflow-hidden">
        {/* Progress Bar Fill */}
        <div 
          className={cn("h-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rounded-full", barColor, severity === "danger" ? "-[0_0_8px_rgba(244,63,94,0.6)]" : "")}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {severity === "danger" && (
        <div className="flex items-center gap-1.5 text-rose-500 text-[11px] font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" weight="bold" />
          <span>Exceeds target UI width budget (&gt;150%). Consider tighter wording.</span>
        </div>
      )}
    </div>
  );
}
