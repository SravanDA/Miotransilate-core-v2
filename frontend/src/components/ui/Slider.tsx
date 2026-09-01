import { cn } from "../../lib/utils";

export interface SliderPreset {
  value: number;
  label: string;
}

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
  helperText?: string;
  presets?: SliderPreset[];
  className?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit = "%",
  helperText,
  presets,
  className,
  disabled = false
}: SliderProps) {
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);

  return (
    <div className={cn("flex flex-col gap-2.5 w-full select-none", className)}>
      {/* Top Header Row with Label and Value Pill */}
      {(label || value !== undefined) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-[13px] font-medium text-text-primary tracking-tight">
              {label}
            </label>
          )}
          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-main border border-border-subtle rounded-md shadow-2xs">
            <span className="font-mono text-[12px] font-semibold text-text-primary">
              {value}
            </span>
            <span className="text-[11px] font-medium text-text-tertiary">
              {unit}
            </span>
          </div>
        </div>
      )}

      {/* Interactive Slider Track */}
      <div className="relative flex items-center h-5 w-full">
        {/* Background Track */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-border-strong/40 dark:bg-[#252830] pointer-events-none" />

        {/* Filled Gradient Active Track */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-[#5e6ad2] to-[#7c87f2] transition-all pointer-events-none"
          style={{ width: `${percentage}%` }}
        />

        {/* Real Input Element with Custom Styling */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="linear-slider absolute inset-0 w-full h-full opacity-100 z-10"
        />
      </div>

      {/* Preset Markers / Quick Click Anchors */}
      {presets && presets.length > 0 && (
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          {presets.map((preset) => {
            const isCurrent = value === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(preset.value)}
                className={cn(
                  "px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer outline-none",
                  isCurrent
                    ? "bg-[#5e6ad2]/12 text-[#5e6ad2] dark:text-[#8b95ff] font-semibold border border-[#5e6ad2]/30"
                    : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Helper text */}
      {helperText && (
        <p className="text-[12px] text-text-secondary leading-relaxed">
          {helperText}
        </p>
      )}
    </div>
  );
}
