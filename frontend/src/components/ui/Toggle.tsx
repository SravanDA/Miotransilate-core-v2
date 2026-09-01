interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function Toggle({ checked, onChange, className = "" }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 ${
        checked ? "bg-accent-blue" : "bg-border-strong"
      } ${className}`}
      type="button"
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}
