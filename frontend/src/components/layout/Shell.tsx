import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  MagnifyingGlass as Search, 
  CaretDown as ChevronDown, 
  Sun, 
  Moon, 
  SignOut as LogOut,
  ShieldCheck,
  Key as KeyRound,
  Sparkle,
  Question as HelpCircle,
  FileText,
  SquaresFour,
  Gear,
  ClockCounterClockwise,
  List as MenuIcon,
  X as CloseIcon,
  WarningCircle as AlertCircle
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "../../contexts/AuthContext";
import { RoleAccessModal } from "../auth/RoleAccessModal";
import { StoreService, type LengthConflictConfig } from "../../store/StoreService";
import { LengthConflictsModal } from "../translation/LengthConflictsModal";
import { Breadcrumbs } from "./Breadcrumbs";
import { GlobalSearch } from "./GlobalSearch";
import { MioSalonLogo } from "../ui/MioSalonLogo";

const mainNav = [
  { name: "Pages", path: "/pages", icon: FileText, permission: "CONTENT_VIEW" },
  { name: "Overview", path: "/overview", icon: SquaresFour, permission: "CONTENT_VIEW" },
];

const bottomNav = [
  { name: "History", path: "/history", icon: ClockCounterClockwise, permission: "AUDIT_VIEW" },
  { name: "Settings", path: "/settings", icon: Gear, permission: "ADMIN_USERS" },
  { name: "Guide", path: "/guide", icon: HelpCircle, permission: "CONTENT_VIEW" },
];

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, logout, can } = useAuth();
  const activeRole = user?.roles?.[0] || "USER";

  const isPageDetail = Boolean(location.pathname.match(/^\/pages\/[^\/]+$/));
  const isPageConflictsActive = isPageDetail && new URLSearchParams(location.search).get("conflicts") === "true";

  const handleConflictsClick = () => {
    if (isPageDetail) {
      const searchParams = new URLSearchParams(location.search);
      if (searchParams.get("conflicts") === "true") {
        searchParams.delete("conflicts");
      } else {
        searchParams.set("conflicts", "true");
      }
      const query = searchParams.toString();
      navigate(`${location.pathname}${query ? `?${query}` : ""}`, { replace: true });
    } else {
      setIsLengthConflictsModalOpen(true);
    }
  };

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isLengthConflictsModalOpen, setIsLengthConflictsModalOpen] = useState(false);
  const [lengthConflictConfig, setLengthConflictConfig] = useState<LengthConflictConfig>(() => StoreService.getLengthConflictConfig());
  const [conflictsCount, setConflictsCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const updateConflicts = () => {
      const cfg = StoreService.getLengthConflictConfig();
      setLengthConflictConfig(cfg);
      setConflictsCount(cfg.enabled ? StoreService.getLengthConflicts().length : 0);
    };
    updateConflicts();
    return StoreService.subscribe(updateConflicts);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

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

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    if (!document.startViewTransition) {
      setTheme(nextTheme);
      return;
    }
    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(nextTheme);
      });
    });
  };

  const isActive = (path: string) => {
    if (path === "/pages") return location.pathname === "/pages" || location.pathname.startsWith("/pages/");
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

  const NavContent = () => (
    <div className="flex flex-col h-full bg-bg-sidebar">
      {/* Brand Header */}
      <div className="h-12 flex items-center px-3.5 justify-between border-b border-border-subtle shrink-0">
        <Link to="/pages" className="flex items-center gap-2 group outline-none">
          <div className="w-6 h-6 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shrink-0">
            <MioSalonLogo size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[13px] text-text-primary tracking-tight leading-tight">
              MioSalon
            </span>
            <span className="text-[9.5px] text-text-tertiary font-mono uppercase tracking-wider leading-none">
              Translate
            </span>
          </div>
        </Link>
        
        {/* Mobile close button */}
        <button 
          onClick={() => setIsMobileNavOpen(false)}
          className="lg:hidden w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer outline-none"
        >
          <CloseIcon className="w-3.5 h-3.5" weight="bold" />
        </button>
      </div>

      {/* Navigation Area */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3 scrollbar-none">
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold text-text-tertiary px-2 pb-1 uppercase tracking-wider">
            Workspace
          </div>
          {mainNav.filter(nav => !nav.permission || can(nav.permission) || user?.roles?.includes('FN')).map((nav) => {
            const Icon = nav.icon;
            const active = isActive(nav.path);
            return (
              <Link
                key={nav.path}
                to={nav.path}
                className={`flex items-center gap-2 px-2 h-7.5 rounded-md text-[12.5px] font-medium transition-colors outline-none cursor-pointer ${
                  active ? "bg-bg-active text-text-primary font-semibold " : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-accent-blue" : "text-text-tertiary"}`} weight={active ? "fill" : "regular"} />
                <span className="truncate">{nav.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col gap-0.5 mt-auto">
          {bottomNav.filter(nav => {
            if (user?.roles?.includes('FN')) return true;
            if (nav.path === "/settings") {
              return can("ADMIN_USERS") || can("ADMIN_LANGUAGES") || can("ADMIN_CONFIG") || can("ADMIN_MIGRATION");
            }
            return !nav.permission || can(nav.permission);
          }).map((nav) => {
            const Icon = nav.icon;
            const active = isActive(nav.path);
            return (
              <Link
                key={nav.path}
                to={nav.path}
                className={`flex items-center gap-2 px-2 h-7.5 rounded-md text-[12.5px] font-medium transition-colors outline-none cursor-pointer ${
                  active ? "bg-bg-active text-text-primary font-semibold " : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-accent-blue" : "text-text-tertiary"}`} weight={active ? "fill" : "regular"} />
                <span className="truncate">{nav.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom User Area */}
      <div className="p-2 border-t border-border-subtle relative shrink-0" ref={menuRef}>
        <button 
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="w-full flex items-center justify-between hover:bg-bg-hover p-1.5 rounded-md transition-colors outline-none cursor-pointer group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-accent-blue/10 text-accent-blue flex items-center justify-center text-[10px] font-bold shrink-0">
              {getInitials(user?.displayName || activeRole)}
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="text-[12px] font-medium text-text-primary leading-tight truncate">{user?.displayName || "User"}</span>
              <span className="text-[10px] text-text-tertiary leading-tight mt-0.5 truncate">{activeRole}</span>
            </div>
          </div>
          <ChevronDown className="w-3 h-3 text-text-tertiary group-hover:text-text-primary transition-colors shrink-0 ml-1" weight="bold" />
        </button>

        {/* User Dropdown Menu */}
        <AnimatePresence>
          {isUserMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute left-2 right-2 bottom-full mb-1.5 bg-bg-card border border-border-subtle rounded-xl p-1 z-50 text-[12px] "
            >
              <div className="px-2 py-1.5 border-b border-border-subtle mb-1">
                <div className="font-medium text-text-primary truncate">{user?.displayName || "Logged In User"}</div>
                <div className="text-[11px] text-text-tertiary truncate">{user?.email || "user@miosalon.com"}</div>
              </div>

              <button
                onClick={() => { setIsUserMenuOpen(false); toggleTheme(); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors text-left outline-none cursor-pointer text-[12px]"
              >
                {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-text-tertiary" /> : <Moon className="w-3.5 h-3.5 text-text-tertiary" />}
                <span>Switch Theme</span>
              </button>

              <button
                onClick={() => { setIsUserMenuOpen(false); setIsRoleModalOpen(true); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors text-left outline-none cursor-pointer text-[12px]"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-text-tertiary" />
                <span>Role Access</span>
              </button>

              <button
                onClick={() => { setIsUserMenuOpen(false); navigate("/change-password"); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors text-left outline-none cursor-pointer text-[12px]"
              >
                <KeyRound className="w-3.5 h-3.5 text-text-tertiary" />
                <span>Change Password</span>
              </button>

              {user?.roles?.includes('FN') && lengthConflictConfig.enabled && (
                <button
                  onClick={() => { setIsUserMenuOpen(false); setIsLengthConflictsModalOpen(true); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors text-left outline-none cursor-pointer text-[12px]"
                >
                  <Sparkle className="w-3.5 h-3.5 text-accent-blue" />
                  <span>Length Conflicts</span>
                </button>
              )}

              <div className="border-t border-border-subtle my-1" />

              <button
                onClick={() => { setIsUserMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-danger hover:bg-danger/10 transition-colors text-left outline-none cursor-pointer text-[12px]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg-main overflow-hidden select-none font-sans text-text-primary">
      {/* Search Modal */}
      <GlobalSearch 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />

      {/* Role Access Matrix Modal & Length Conflicts Modal */}
      <RoleAccessModal 
        isOpen={isRoleModalOpen} 
        onClose={() => setIsRoleModalOpen(false)} 
      />
      <LengthConflictsModal
        isOpen={isLengthConflictsModalOpen}
        onClose={() => setIsLengthConflictsModalOpen(false)}
      />

      {/* Desktop Left Sidebar (Visible on lg: screens and wider) */}
      <aside className="hidden lg:flex w-52 bg-bg-sidebar border-r border-border-subtle flex-col shrink-0">
        <NavContent />
      </aside>

      {/* Mobile / Tablet Drawer Sidebar */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileNavOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/60"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-bg-sidebar border-r border-border-subtle  flex flex-col"
            >
              <NavContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-main relative overflow-hidden">
        {/* Responsive Header Bar */}
        <header className="h-12 flex items-center justify-between px-3 sm:px-6 shrink-0 border-b border-border-subtle gap-2">
          <div className="flex items-center gap-2.5 text-[14px] min-w-0">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer outline-none shrink-0"
              aria-label="Open menu"
            >
              <MenuIcon className="w-5 h-5" weight="bold" />
            </button>

            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Global Search Trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 h-8 px-3 bg-bg-card hover:bg-bg-hover border border-border-subtle hover:border-border-strong rounded-lg text-text-tertiary hover:text-text-primary transition-all cursor-pointer outline-none text-[12px] group  active:scale-[0.98]"
            >
              <Search className="w-3.5 h-3.5" weight="bold" />
              <span>Search everything...</span>
              <kbd className="ml-1.5 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-bg-main border border-border-subtle rounded group-hover:border-border-strong text-text-tertiary">
                ⌘K
              </kbd>
            </button>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer outline-none"
              title="Search (⌘K)"
            >
              <Search className="w-4 h-4" weight="bold" />
            </button>

            {lengthConflictConfig.enabled && conflictsCount > 0 && (
              <button 
                onClick={handleConflictsClick}
                className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer outline-none group active:scale-[0.98] ${
                  isPageConflictsActive
                    ? "border-amber-500/50 bg-amber-500/25 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/30 shadow-xs font-semibold"
                    : "border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}
                title={
                  isPageDetail
                    ? isPageConflictsActive
                      ? "Click to clear length conflicts filter on this page"
                      : `${conflictsCount} UI length conflicts. Click to filter table.`
                    : `${conflictsCount} UI length conflicts across active translations`
                }
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" weight="bold" />
                <span className="font-mono text-[11px] font-semibold tabular-nums">{conflictsCount}</span>
                <span className="text-[11px] font-medium text-amber-600/80 dark:text-amber-400/80 hidden sm:inline">conflicts</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Search Palette */}
        <GlobalSearch
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />

        {/* Page Content Viewport */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
          <div className="flex flex-col flex-1 p-3 sm:p-5 md:p-6 mx-auto w-full max-w-7xl min-h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
