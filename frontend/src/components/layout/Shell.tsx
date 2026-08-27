// @ts-nocheck
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { 
  Search, 
  Bell, 
  ChevronDown, 
  Sun, 
  Moon, 
  CheckCircle2,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../ThemeProvider";

const navTabs = [
  { name: "Content", path: "/pages" },
  { name: "My Work", path: "/work" },
  { name: "Coverage", path: "/coverage" },
  { name: "Deployments", path: "/deployments" },
  { name: "Settings", path: "/settings" },
  { name: "Guide", path: "/guide" },
];

export function Shell() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [activeRole, setActiveRole] = useState<"PM" | "LR" | "SR" | "FN" | "DEV">("PM");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isCurrentTab = (path: string) => {
    if (path === "/pages") {
      return location.pathname.startsWith("/pages");
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-app text-text-main flex flex-col font-sans selection:bg-primary-light selection:text-primary">
      {/* Top Header Bar */}
      <header className="bg-surface border-b border-border-main sticky top-0 z-30 shadow-2xs">
        {/* Upper Row: Brand, Global Search, User & Role Controls */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/pages" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-primary text-white rounded flex items-center justify-center font-bold text-sm tracking-tight shadow-xs group-hover:bg-primary-hover transition-colors">
                <Globe className="w-4 h-4" />
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle pointer-events-none" />
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
              {theme === "dark" ? <Sun className="w-4 h-4 text-[#FFAB00]" /> : <Moon className="w-4 h-4 text-text-muted" />}
            </button>

            {/* Notification Bell */}
            <button 
              className="relative w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover rounded transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-text-muted" />
            </button>

            <div className="h-4 w-px bg-border-main mx-1" />

            {/* Role & User Selector Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 hover:bg-surface-hover px-2.5 py-1.5 rounded border border-border-main text-xs transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 bg-[#DEEBFF] text-primary font-bold rounded flex items-center justify-center text-[11px]">
                  {activeRole}
                </div>
                <span className="font-semibold text-text-main hidden md:inline">Sravan</span>
                <span className="text-[10px] text-text-subtle font-medium">({activeRole})</span>
                <ChevronDown className="w-3.5 h-3.5 text-text-subtle" />
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-0 top-full mt-1.5 w-56 bg-surface border border-border-main rounded shadow-modal p-2 z-50 text-xs"
                  >
                    <div className="px-2 py-1.5 border-b border-border-main mb-1.5 text-text-subtle font-bold">
                      Simulate Persona Role
                    </div>
                    {(["PM", "LR", "SR", "FN", "DEV"] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          setActiveRole(role);
                          setIsUserMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer ${
                          activeRole === role
                            ? "bg-primary-light text-primary font-bold"
                            : "text-text-main hover:bg-surface-hover font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-surface-active flex items-center justify-center text-[10px] font-mono">
                            {role}
                          </span>
                          <span>
                            {role === "PM" && "Product Manager"}
                            {role === "LR" && "Language Reviewer"}
                            {role === "SR" && "Support Reviewer"}
                            {role === "FN" && "Founder"}
                            {role === "DEV" && "Developer"}
                          </span>
                        </div>
                        {activeRole === role && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    ))}
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
