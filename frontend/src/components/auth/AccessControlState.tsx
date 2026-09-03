import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "@phosphor-icons/react";
import { RoleAccessModal } from "./RoleAccessModal";
import { useTheme } from "../ThemeProvider";

interface AccessControlStateProps {
  title?: string;
  description?: string;
  requiredPermission?: string;
  fullScreen?: boolean;
}

const PERMISSION_NAMES: Record<string, string> = {
  ADMIN_USERS: "User & Role Administration",
  ADMIN_LANGUAGES: "Language Management",
  ADMIN_CONFIG: "System Configuration",
  ADMIN_MIGRATION: "Data Migration Authority",
  AUDIT_VIEW: "Audit Trail Access",
  CONTENT_VIEW: "View Content & Pages",
  CONTENT_EDIT: "Edit Master English & Translations",
  CONTENT_APPROVE: "Approve Translations",
  PUBLISH_PROD: "Production Publishing",
  PUBLISH_QA: "QA Publishing",
  PUBLISH_DEV: "Development Publishing",
  IMPORT_PAGES: "Import Pages & Tags",
  EXPORT: "Export Translation Bundles",
  ESCALATE: "Escalate to Leadership",
};

export function getPermissionDisplayName(code?: string): string {
  if (!code) return "";
  if (PERMISSION_NAMES[code]) return PERMISSION_NAMES[code];
  return code
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function useIsDark() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return true;
  });

  useEffect(() => {
    const updateTheme = () => {
      const hasDarkClass = document.documentElement.classList.contains("dark");
      if (theme === "dark") {
        setIsDark(true);
      } else if (theme === "light") {
        setIsDark(false);
      } else {
        setIsDark(hasDarkClass);
      }
    };

    updateTheme();

    const observer = new MutationObserver(() => {
      updateTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });

    return () => observer.disconnect();
  }, [theme]);

  return isDark;
}

export function AccessControlGraphic({ className = "w-28 h-28 sm:w-32 sm:h-32" }: { className?: string }) {
  const isDark = useIsDark();

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Subtle ambient radial glow */}
      <div className="absolute inset-0 bg-[#5e6ad2]/15 dark:bg-[#5e6ad2]/20 blur-xl rounded-full -z-10" />

      {isDark ? (
        /* DARK MODE MINIMAL LINEAR SECURITY ORBIT */
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop--[0_8px_20px_rgba(0,0,0,0.5)]"
        >
          {/* Outer Dashed Orbit */}
          <circle cx="50" cy="50" r="44" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 3" />
          
          {/* Inner Solid Orbit */}
          <circle cx="50" cy="50" r="36" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" />

          {/* Precision Crosshair Ticks */}
          <path d="M50 3 V8 M50 92 V97 M3 50 H8 M92 50 H97" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1" strokeLinecap="round" />

          {/* Central Floating Badge */}
          <rect 
            x="28" 
            y="28" 
            width="44" 
            height="44" 
            rx="12" 
            fill="#18191d" 
            stroke="#2e3038" 
            strokeWidth="1.25" 
          />
          <rect 
            x="30" 
            y="30" 
            width="40" 
            height="40" 
            rx="10" 
            stroke="#ffffff" 
            strokeOpacity="0.08" 
            strokeWidth="1" 
          />

          {/* Minimal Padlock Shackle */}
          <path 
            d="M44 44 V40.5 C44 37.2 46.7 34.5 50 34.5 C53.3 34.5 56 37.2 56 40.5 V44" 
            stroke="#5e6ad2" 
            strokeWidth="2" 
            strokeLinecap="round" 
          />

          {/* Minimal Padlock Body */}
          <rect 
            x="40" 
            y="44" 
            width="20" 
            height="15" 
            rx="3" 
            fill="#22242c" 
            stroke="#5e6ad2" 
            strokeWidth="1.5" 
          />

          {/* Keyhole */}
          <circle cx="50" cy="50" r="1.5" fill="#5e6ad2" />
          <path d="M49.2 51 L50.8 51 L51.2 54.5 L48.8 54.5 Z" fill="#5e6ad2" />
        </svg>
      ) : (
        /* LIGHT MODE MINIMAL LINEAR SECURITY ORBIT */
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop--[0_6px_16px_rgba(0,0,0,0.06)]"
        >
          {/* Outer Dashed Orbit */}
          <circle cx="50" cy="50" r="44" stroke="#64748b" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3 3" />
          
          {/* Inner Solid Orbit */}
          <circle cx="50" cy="50" r="36" stroke="#64748b" strokeOpacity="0.25" strokeWidth="1" />

          {/* Precision Crosshair Ticks */}
          <path d="M50 3 V8 M50 92 V97 M3 50 H8 M92 50 H97" stroke="#64748b" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />

          {/* Central Floating Badge */}
          <rect 
            x="28" 
            y="28" 
            width="44" 
            height="44" 
            rx="12" 
            fill="#ffffff" 
            stroke="#cbd5e1" 
            strokeWidth="1.25" 
          />
          <rect 
            x="30" 
            y="30" 
            width="40" 
            height="40" 
            rx="10" 
            stroke="#f1f5f9" 
            strokeWidth="1" 
          />

          {/* Minimal Padlock Shackle */}
          <path 
            d="M44 44 V40.5 C44 37.2 46.7 34.5 50 34.5 C53.3 34.5 56 37.2 56 40.5 V44" 
            stroke="#5e6ad2" 
            strokeWidth="2" 
            strokeLinecap="round" 
          />

          {/* Minimal Padlock Body */}
          <rect 
            x="40" 
            y="44" 
            width="20" 
            height="15" 
            rx="3" 
            fill="#f8fafc" 
            stroke="#5e6ad2" 
            strokeWidth="1.5" 
          />

          {/* Keyhole */}
          <circle cx="50" cy="50" r="1.5" fill="#5e6ad2" />
          <path d="M49.2 51 L50.8 51 L51.2 54.5 L48.8 54.5 Z" fill="#5e6ad2" />
        </svg>
      )}
    </div>
  );
}

export function AccessControlState({
  title = "Access control",
  description = "You don't have permission to view this page. Contact your workspace administrator to request access.",
  requiredPermission,
  fullScreen = false
}: AccessControlStateProps) {
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  return (
    <>
      <RoleAccessModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
      />

      <div className={`flex flex-col items-center justify-center text-center px-4 ${fullScreen ? "min-h-screen bg-bg-main" : "py-16 sm:py-24 flex-1 w-full"}`}>
        {/* Minimal Linear Orbit Graphic */}
        <AccessControlGraphic className="w-28 h-28 sm:w-32 sm:h-32 mb-6" />

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary mb-2">
          {title}
        </h1>

        {/* Description */}
        <p className="text-[13px] sm:text-[14px] text-text-secondary max-w-md leading-relaxed mb-6">
          {description}
        </p>

        {requiredPermission && (
          <div className="mb-6 inline-flex items-center gap-1.5 px-3 py-1 bg-bg-card border border-border-subtle rounded-md text-[12px] text-text-secondary ">
            <span>Required permission:</span>
            <strong className="text-text-primary font-medium">{getPermissionDisplayName(requiredPermission)}</strong>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link
            to="/pages"
            className="h-8 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#5e6ad2] hover:bg-[#525ec2] text-white text-[12px] font-medium transition-all  cursor-pointer active:scale-[0.98] outline-none"
          >
            <ArrowLeft className="w-3.5 h-3.5" weight="bold" />
            <span>Back to Pages</span>
          </Link>

          <button
            onClick={() => setIsRoleModalOpen(true)}
            className="h-8 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-bg-card hover:bg-bg-hover hover:border-border-strong text-text-primary text-[12px] font-medium transition-all  cursor-pointer active:scale-[0.98] outline-none"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-text-secondary" weight="bold" />
            <span>View Role Permissions</span>
          </button>
        </div>
      </div>
    </>
  );
}
