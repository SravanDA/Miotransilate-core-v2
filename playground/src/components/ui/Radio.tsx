import React from 'react';

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Radio: React.FC<RadioProps> = ({ 
  label, 
  disabled = false, 
  className = '',
  ...props 
}) => {
  return (
    <label 
      className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <input
          type="radio"
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        {/* Outer Ring */}
        <div className={`w-5 h-5 rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2 ${
          disabled 
            ? 'border-border-main' 
            : 'border-border-main peer-checked:border-primary peer-hover:border-primary'
        }`} />
        
        {/* Inner Dot */}
        <div className={`absolute w-2.5 h-2.5 rounded-full transition-transform scale-0 peer-checked:scale-100 ${
          disabled ? 'bg-border-main' : 'bg-primary'
        }`} />
      </div>
      
      <span className={`text-[16px] ${disabled ? 'text-help' : 'text-heading'}`}>
        {label}
      </span>
    </label>
  );
};
