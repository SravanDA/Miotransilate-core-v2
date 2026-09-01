import React from "react";
import { cn } from "../../lib/utils";

interface MioSalonLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  variant?: "accent" | "monochrome";
}

export function MioSalonLogo({
  size = 24,
  className,
  variant = "accent",
  ...props
}: MioSalonLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none overflow-visible transform-gpu", className)}
      {...props}
    >
      <defs>
        {/* Accent linear gradients for the top isometric slab */}
        <linearGradient id="mioAccentSlab" x1="30" y1="28" x2="70" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7582eb" />
          <stop offset="50%" stopColor="#5e6ad2" />
          <stop offset="100%" stopColor="#4b55be" />
        </linearGradient>
        
        <linearGradient id="mioSpecularStroke" x1="30" y1="28" x2="70" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#818cf8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
        </linearGradient>

        <linearGradient id="mioInnerBevel" x1="32" y1="30" x2="68" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Bottom stacked wireframe layer 3 */}
      <path
        d="M28 66 L50 78 L72 66 L50 54 Z"
        stroke={variant === "accent" ? "#5e6ad2" : "currentColor"}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.28"
        className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-[1px]"
      />

      {/* Middle stacked wireframe layer 2 */}
      <path
        d="M28 54 L50 66 L72 54 L50 42 Z"
        stroke={variant === "accent" ? "#818cf8" : "currentColor"}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.55"
        className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-[-1px]"
      />

      {/* Floating Top Accent Solid Slab */}
      <g 
        className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-[-3px]"
      >
        {/* Main top rhombus surface */}
        <path
          d="M28 38 L50 50 L72 38 L50 26 Z"
          fill={variant === "accent" ? "url(#mioAccentSlab)" : "currentColor"}
          stroke={variant === "accent" ? "url(#mioSpecularStroke)" : "currentColor"}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Inner specular ring / bevel */}
        <path
          d="M32 38 L50 48 L68 38 L50 28 Z"
          stroke="url(#mioInnerBevel)"
          strokeWidth="1.2"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
