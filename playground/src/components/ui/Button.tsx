import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'default' | 'delete' | 'warning' | 'link';
type ButtonSize = 'xl' | 'lg' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'default', 
  size = 'md', 
  className = '', 
  disabled,
  ...props 
}) => {
  let sizeClasses = '';
  switch (size) {
    case 'xl':
      sizeClasses = 'h-[48px] text-[18px] leading-[24px] px-[24px] py-[12px]';
      break;
    case 'lg':
      sizeClasses = 'h-[44px] text-[17px] leading-[23px] px-[20px] py-[10px]';
      break;
    case 'md':
    default:
      sizeClasses = 'h-[40px] text-[16px] leading-[21px] px-[16px] py-[8px] font-semibold';
      break;
  }

  let variantClasses = '';
  switch (variant) {
    case 'primary':
      variantClasses = 'bg-primary text-white border border-transparent hover:bg-primary-hover active:bg-primary-active';
      break;
    case 'secondary':
      variantClasses = 'bg-transparent text-primary border border-primary hover:bg-secondary-hover active:bg-secondary-active';
      break;
    case 'default':
      variantClasses = 'bg-secondary text-heading border border-transparent hover:bg-secondary-hover active:bg-secondary-active';
      break;
    case 'delete':
      variantClasses = 'bg-danger text-white border border-transparent hover:bg-danger-hover active:bg-danger-active';
      break;
    case 'warning':
      variantClasses = 'bg-warning text-heading border border-transparent hover:bg-warning-hover active:bg-warning-active';
      break;
    case 'link':
      variantClasses = 'bg-transparent text-link border border-transparent hover:text-link-hover p-0 h-auto font-normal';
      // Reset padding/height for link
      if (size === 'md' || size === 'lg' || size === 'xl') {
         sizeClasses = sizeClasses.replace(/h-\[[^\]]+\]/, 'h-auto').replace(/px-\[[^\]]+\]/, 'px-0').replace(/py-\[[^\]]+\]/, 'py-0');
      }
      break;
  }

  if (disabled) {
    variantClasses = 'bg-disable text-disable border border-transparent cursor-not-allowed';
    if (variant === 'secondary' || variant === 'link') {
      variantClasses = 'bg-transparent text-disable border-disable border cursor-not-allowed';
    }
  }

  return (
    <button 
      className={`inline-flex items-center justify-center rounded-[4px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
