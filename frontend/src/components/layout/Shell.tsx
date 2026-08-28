// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  MagnifyingGlass as Search, 
  Bell, 
  CaretDown as ChevronDown, 
  Sun, 
  Moon, 
  Globe,
  SignOut as LogOut,
  ShieldCheck,
  Key as KeyRound,
  Question as HelpCircle
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "../../contexts/AuthContext";
import { RoleAccessModal } from "../auth/RoleAccessModal";

const navTabs = [
  { name: "Content", path: "/pages" },
  { name: "My Work", path: "/work" },
  { name: "Coverage", path: "/coverage" },
  { name: "Deployments", path: "/deployments" },
  { name: "Settings", path: "/settings" }
];

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const activeRole = user?.roles?.[0] || "USER";
  const isDevUser = user?.roles?.includes("DEV") || user?.roles?.includes("FN");

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isCurrentTab = (path: string) => {
    if (path === "/pages") {
      return location.pathname.startsWith("/pages");
    }
    return location.pathname.startsWith(path);
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-app text-text-main flex flex-col font-sans selection:bg-primary-light selection:text-primary">
      {/* Role Access Information Modal */}
      <RoleAccessModal 
        isOpen={isRoleModalOpen} 
        onClose={() => setIsRoleModalOpen(false)} 
      />

      {/* Top Header Bar */}
      <header className="bg-surface border-b border-border-main sticky top-0 z-30 shadow-2xs">
        {/* Upper Row: Brand, Global Search, User & Role Controls */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/pages" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-primary text-white rounded flex items-center justify-center font-bold text-sm tracking-tight shadow-xs group-hover:bg-primary-hover transition-colors">
                <Globe className="w-4 h-4" weight="fill" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-text-main tracking-tight leading-none group-hover:text-primary transition-colors">
                  MioTranslate
                </span>
                <span className="text-[10px] text-text-subtle font-medium leading-tight">
                  MioSalon Localization
                </span>
              </div>
            </Link>
          </div>

          {/* Global Search Input */}
          <div className="flex-1 max-w-md mx-4 relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle pointer-events-none" weight="bold" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags, pages, strings..."
              className="w-full h-8.5 pl-9 pr-3 bg-surface-hover hover:bg-surface border border-border-main focus:border-primary focus:bg-surface focus:ring-1 focus:ring-primary rounded text-xs text-text-main placeholder:text-text-subtle transition-all outline-none"
            />
          </div>

          {/* Right Action Tools: Role Switcher, Theme Toggle, Notification Bell, User */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors cursor-pointer"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-[#FFAB00]" weight="bold" /> : <Moon className="w-4 h-4 text-text-muted" weight="bold" />}
            </button>

            {/* Guide Button */}
            <Link 
              to="/guide"
              className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors cursor-pointer"
              title="Help & Guide"
            >
              <HelpCircle className="w-4 h-4" weight="bold" />
            </Link>

            {/* Notification Bell */}
            <button 
              className="relative w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-text-muted" weight="bold" />
            </button>

            <div className="h-4 w-px bg-border-main mx-1" />

            {/* User Profile & Account Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 hover:bg-surface-hover px-2.5 py-1.5 rounded-lg border border-border-main text-xs transition-all cursor-pointer shadow-2xs hover:border-primary/40"
              >
                {/* Avatar Badge */}
                <div className="w-6 h-6 bg-primary text-white font-bold rounded-md flex items-center justify-center text-[10px] tracking-tight shrink-0">
                  {getInitials(user?.displayName || activeRole)}
                </div>

                <div className="flex flex-col text-left leading-tight hidden md:flex">
                  <span className="font-semibold text-text-main truncate max-w-[110px]">
                    {user?.displayName || "User"}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-primary font-bold">
                      {activeRole}
                    </span>
                  </div>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-text-subtle transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`} weight="bold" />
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border-main rounded-xl shadow-modal p-2 z-50 text-xs"
                  >
                    {/* User Identity Card */}
                    <div className="px-3 py-2.5 border-b border-border-main mb-1.5 bg-surface-hover/50 rounded-lg">
                      <div className="font-bold text-text-main text-xs truncate">
                        {user?.displayName || "Logged In User"}
                      </div>
                      <div className="text-[11px] text-text-subtle truncate mt-0.5">
                        {user?.email || "user@miosalonsoftware.com"}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                          Role: {activeRole}
                        </span>
                      </div>
                    </div>

                    {/* Action: Role Access & Permissions (Can Do / Can't Do Info) */}
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsRoleModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-text-main hover:bg-primary-light hover:text-primary transition-colors cursor-pointer text-left font-medium group"
                    >
                      <ShieldCheck className="w-4 h-4 text-primary shrink-0" weight="fill" />
                      <div className="flex-1">
                        <div className="font-semibold leading-tight">Role Access & Capabilities</div>
                        <div className="text-[10px] text-text-subtle group-hover:text-primary/80">View what your role can & cannot do</div>
                      </div>
                    </button>

                    {/* Change Password Link */}
                    <div className="mt-1 pt-1.5 border-t border-border-main">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate("/change-password");
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer text-left font-medium"
                      >
                        <KeyRound className="w-4 h-4 text-text-subtle shrink-0" weight="fill" />
                        <span>Change Password</span>
                      </button>

                      {/* Log Out Button */}
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-left font-medium"
                      >
                        <LogOut className="w-4 h-4 shrink-0" weight="bold" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Lower Row: Primary Horizontal Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-border-main/60 flex items-center justify-between overflow-x-auto scrollbar-none">
          <nav className="flex space-x-1 sm:space-x-2">
            {navTabs.map((tab) => {
              const active = isCurrentTab(tab.path);
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`relative py-3 px-3 sm:px-4 text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    active
                      ? "text-primary"
                      : "text-text-muted hover:text-text-main hover:bg-surface-hover/60"
                  }`}
                >
                  <span>{tab.name}</span>
                  {/* Active Indicator Underline */}
                  {active && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="text-[11px] text-text-subtle hidden md:flex items-center gap-2 pr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
            <span>MioSalon v4.12 Live</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="flex-1 flex flex-col w-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
