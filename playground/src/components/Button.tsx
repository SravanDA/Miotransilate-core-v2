import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
};

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  ...props 
}) => {
  const baseStyle = "px-4 py-2 rounded font-medium text-sm transition-all active:scale-[0.98] active:brightness-95";
  
  let variantStyle = "";
  switch (variant) {
    case 'primary':
      variantStyle = "bg-[#0052CC] text-white hover:bg-[#0747A6] shadow-sm";
      break;
    case 'secondary':
      variantStyle = "bg-[#F5F6F7] text-[#172B4D] hover:bg-[#DFE1E6]";
      break;
    case 'outline':
      variantStyle = "border border-[#DFE1E6] bg-white text-[#172B4D] hover:bg-[#F5F6F7] shadow-sm";
      break;
    case 'danger':
      variantStyle = "bg-[#DE350B] text-white hover:bg-[#BF2600] shadow-sm";
      break;
  }

  return (
    <button 
      className={`${baseStyle} ${variantStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
