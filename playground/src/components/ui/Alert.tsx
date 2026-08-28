import React from 'react';
import { Info, CheckCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';

export type AlertVariant = 'primary' | 'success' | 'warning' | 'danger' | 'default';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  description?: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'default',
  title,
  description,
  onClose,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          container: 'bg-[#EBF2FF] border-transparent text-[#0052CC]',
          icon: <Info className="h-[18px] w-[18px] text-[#0052CC] mt-0.5" />,
          title: 'text-[#172B4D]',
          desc: 'text-[#42526E]',
        };
      case 'success':
        return {
          container: 'bg-[#E3FCEF] border-transparent text-[#006644]',
          icon: <CheckCircle className="h-[18px] w-[18px] text-[#006644] mt-0.5" />,
          title: 'text-[#172B4D]',
          desc: 'text-[#42526E]',
        };
      case 'warning':
        return {
          container: 'bg-[#FFF0B3] border-transparent text-[#FFAB00]',
          icon: <AlertTriangle className="h-[18px] w-[18px] text-[#FF8B00] mt-0.5" />,
          title: 'text-[#172B4D]',
          desc: 'text-[#42526E]',
        };
      case 'danger':
        return {
          container: 'bg-[#FFEBE6] border-transparent text-[#BF2600]',
          icon: <AlertCircle className="h-[18px] w-[18px] text-[#BF2600] mt-0.5" />,
          title: 'text-[#172B4D]',
          desc: 'text-[#42526E]',
        };
      case 'default':
      default:
        return {
          container: 'bg-[#F4F5F7] border-transparent text-[#42526E]',
          icon: <Info className="h-[18px] w-[18px] text-[#42526E] mt-0.5" />,
          title: 'text-[#172B4D]',
          desc: 'text-[#42526E]',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className={`flex items-start p-4 rounded-[4px] relative ${styles.container}`} role="alert">
      <div className="flex-shrink-0 mr-3">
        {styles.icon}
      </div>
      <div className="flex-1 pr-8">
        {title && <h4 className={`text-[14px] font-semibold ${styles.title}`}>{title}</h4>}
        {description && <p className={`text-[14px] mt-1 ${styles.desc}`}>{description}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          className="absolute top-4 right-4 text-[#42526E] hover:text-[#172B4D] focus:outline-none"
          onClick={onClose}
        >
          <span className="sr-only">Close</span>
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
