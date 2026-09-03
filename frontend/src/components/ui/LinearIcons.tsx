import { cn } from "../../lib/utils";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Linear Backlog: Orange/Amber dotted circle
 */
export function StatusBacklog({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-3.5 h-3.5 text-[#e58c3a] shrink-0", className)}
      {...props}
    >
      <circle
        cx="8"
        cy="8"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2.2 2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Linear Planned / Todo: Gray hollow hexagon outline
 */
export function StatusPlanned({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-3.5 h-3.5 text-[#8a8f98] shrink-0", className)}
      {...props}
    >
      <path
        d="M8 2L13.2 5V11L8 14L2.8 11V5L8 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const StatusTodo = StatusPlanned;

/**
 * Linear In Progress: Yellow hexagon outline with left half filled
 */
export function StatusInProgress({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-3.5 h-3.5 text-[#f2c94c] shrink-0", className)}
      {...props}
    >
      <path
        d="M8 2L13.2 5V11L8 14L2.8 11V5L8 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 2V14L2.8 11V5L8 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Linear Completed: Solid purple circle with white checkmark
 */
export function StatusCompleted({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-3.5 h-3.5 shrink-0", className)}
      {...props}
    >
      <circle cx="8" cy="8" r="7" fill="#5e6ad2" />
      <path
        d="M5.2 8.2L7.2 10.2L10.8 6"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const StatusDone = StatusCompleted;

/**
 * Linear AI Sparkle: Precision geometric astroid with satellite diamond
 */
export function LinearSparkle({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-3.5 h-3.5 shrink-0", className)}
      {...props}
    >
      <path
        d="M7 1.25C7 4.42564 4.42564 7 1.25 7C4.42564 7 7 9.57436 7 12.75C7 9.57436 9.57436 7 12.75 7C9.57436 7 7 4.42564 7 1.25Z"
        fill="currentColor"
      />
      <path
        d="M12.5 1.5C12.5 2.60457 11.6046 3.5 10.5 3.5C11.6046 3.5 12.5 4.39543 12.5 5.5C12.5 4.39543 13.3954 3.5 14.5 3.5C13.3954 3.5 12.5 2.60457 12.5 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Linear AI Prism: Precision interlocking diamond glyph
 */
export function LinearAiPrism({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-3.5 h-3.5 shrink-0", className)}
      {...props}
    >
      <path
        d="M8 1.5L14 8L8 14.5L2 8L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M8 4.5L11.5 8L8 11.5L4.5 8L8 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Linear Canceled: Solid gray circle with white cross
 */
export function StatusCanceled({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-3.5 h-3.5 shrink-0", className)}
      {...props}
    >
      <circle cx="8" cy="8" r="7" fill="#6e7681" />
      <path
        d="M5.8 5.8L10.2 10.2M10.2 5.8L5.8 10.2"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

