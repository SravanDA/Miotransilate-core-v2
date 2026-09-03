import { cn } from "../../lib/utils";

interface Props extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export function EmptyStateGraphic({ className, ...props }: Props) {
  return (
    <div className={cn("relative flex items-center justify-center w-32 h-32", className)}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        {...props}
      >
        {/* Shadow / Reflection layers */}
        <g opacity="0.4">
          <path
            d="M30 65 L50 75 L70 65 L50 55 Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className="text-border-strong"
          />
          <path
            d="M30 60 L50 70 L70 60 L50 50 Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className="text-border-strong"
          />
          <path
            d="M30 55 L50 65 L70 55 L50 45 Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className="text-text-tertiary"
          />
        </g>
        
        {/* Top layer (Floating card) */}
        <path
          d="M30 40 L50 50 L70 40 L50 30 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="text-border-strong"
          fill="var(--bg-card)"
        />
        {/* Inner edge detail on the top layer */}
        <path
          d="M32 40 L50 49 L68 40 L50 31 Z"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
          className="text-text-tertiary opacity-50"
        />
      </svg>
    </div>
  );
}
