import { cn } from "../../lib/utils";
import type { TranslationStatus } from "../../types";
import { 
  StatusCompleted, 
  StatusBacklog, 
  StatusInProgress, 
  StatusCanceled, 
  StatusPlanned 
} from "../ui/LinearIcons";

interface Props {
  status: TranslationStatus;
  className?: string;
  showIconOnly?: boolean;
}

export function TranslationStatusBadge({ status, className, showIconOnly }: Props) {
  const getBadgeConfig = (s: TranslationStatus) => {
    switch (s) {
      case 'Approved':
        return { icon: StatusCompleted, label: 'Approved', iconClass: '' };
      case 'Pending Review':
        return { icon: StatusInProgress, label: 'Pending Review', iconClass: '' };
      case 'Stale':
        return { icon: StatusInProgress, label: 'Stale', iconClass: 'text-amber-500' };
      case 'Draft':
        return { icon: StatusPlanned, label: 'Draft', iconClass: '' };
      case 'No Trans':
        return { icon: StatusBacklog, label: 'No Trans', iconClass: '' };
      case 'No Eng':
        return { icon: StatusBacklog, label: 'No Eng', iconClass: '' };
      case 'Needs Attention':
        return { icon: StatusInProgress, label: 'Needs Attention', iconClass: 'text-[#EB5757]' };
      case 'Blocked':
        return { icon: StatusCanceled, label: 'Blocked', iconClass: '' };
      case 'Deprecated':
        return { icon: StatusCanceled, label: 'Deprecated', iconClass: '' };
      default:
        return { icon: StatusPlanned, label: status || 'Unknown', iconClass: '' };
    }
  };

  const config = getBadgeConfig(status);
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-normal text-text-primary shrink-0 select-none",
        className
      )}
      title={config.label}
    >
      <Icon className={cn("w-3.5 h-3.5 shrink-0", config.iconClass)} />
      {!showIconOnly && <span className="truncate">{config.label}</span>}
    </div>
  );
}

