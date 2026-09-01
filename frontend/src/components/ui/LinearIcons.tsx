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

