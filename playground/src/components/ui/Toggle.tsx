import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
  description?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  title,
  description,
  disabled = false,
}) => {
  return (
    <div className="flex items-start gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 ${
          checked ? 'bg-primary' : 'bg-[#A5ADBA]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="sr-only">Use setting</span>
        
        {/* OFF Text (when checked is false) */}
        {!checked && (
          <span className="absolute right-1 text-[10px] font-bold text-white uppercase pointer-events-none">
            OFF
          </span>
        )}

        {/* ON Text (when checked is true) */}
        {checked && (
          <span className="absolute left-1.5 text-[10px] font-bold text-white uppercase pointer-events-none">
            ON
          </span>
        )}

        {/* Knob */}
        <span
          className={`pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-[20px]' : 'translate-x-0'
          }`}
        />
      </button>
      
      {(title || description) && (
        <div className="flex flex-col">
          {title && (
            <span className="text-[16px] font-semibold text-heading">
              {title}
            </span>
          )}
          {description && (
            <span className="text-[14px] text-help mt-1">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
