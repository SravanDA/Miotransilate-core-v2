import { cn } from "../../lib/utils";
import type { TranslationStatus } from "../../types";

interface Props {
  status: TranslationStatus;
  className?: string;
}

export function TranslationStatusBadge({ status, className }: Props) {
  const getStatusStyle = (s: TranslationStatus) => {
    switch (s) {
      case 'Approved':
        return 'bg-[#E3FCEF] text-[#006644] border border-[#ABF5D1]'; // Miosalon Success
      case 'Stale':
        return 'bg-[#FFFAE6] text-[#FF8B00] border border-[#FFE380]'; // Miosalon Warning
      case 'No Trans':
      case 'No Eng':
        return 'bg-surface-active text-text-subtle border border-border-main'; // Miosalon Neutral
      case 'Draft':
        return 'bg-[#E6FCFF] text-[#0065FF] border border-[#B3D4FF]'; // Miosalon Info
      case 'Pending Review':
        return 'bg-[#EAE6FF] text-[#403294] border border-[#403294]/20'; // Miosalon Discovery
      case 'Deprecated':
        return 'bg-[#F4F5F7] text-[#5E6C84] border border-[#DFE1E6] line-through opacity-70';
      default:
        return 'bg-surface-active text-text-muted';
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold shadow-sm",
        getStatusStyle(status),
        className
      )}
    >
      {status === 'Stale' ? '⚠ ' : ''}
      {status}
    </span>
  );
}
