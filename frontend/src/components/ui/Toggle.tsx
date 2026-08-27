interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function Toggle({ checked, onChange, className = "" }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-[#0052CC]" : "bg-[#A1BDDF]"
      } ${className}`}
      type="button"
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute text-[10px] font-bold text-white transition-opacity ${
          checked ? "left-2 opacity-100" : "left-2 opacity-0"
        }`}
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        ON
      </span>
      <span
        className={`absolute text-[10px] font-bold text-white transition-opacity ${
          !checked ? "right-2 opacity-100" : "right-2 opacity-0"
        }`}
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        OFF
      </span>
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[26px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
