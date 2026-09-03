import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CaretRight,
  Cube,
  SquaresFour,
  ChartBar,
  ClockCounterClockwise,
  GearSix,
  BookOpen,
  Copy,
  Check,
  CaretDown,
  MagnifyingGlass as Search
} from "@phosphor-icons/react";
import { StoreService } from "../../store/StoreService";

const PAGE_NAME_MAPPINGS: Record<string, string> = {
  SERSET: "Service Settings",
  CUSINS: "Customer Insights",
  CAMREW: "Campaign & Rewards",
  POTSALESET: "POS / Sale Settings",
  STAFFSET: "Staff Settings",
  CUSWISH: "Customer Wishlist"
};

// Exact Linear horizontal tag glyph matching the reference image 1:1
export const LinearTagIcon = ({ className = "w-4 h-4 text-[#6773e4] shrink-0" }: { className?: string }) => (
  <svg 
    viewBox="0 0 16 16" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 8L5.8 4.2C6.1 3.8 6.6 3.5 7.1 3.5H12.5C13.3 3.5 14 4.2 14 5V11C14 11.8 13.3 12.5 12.5 12.5H7.1C6.6 12.5 6.1 12.2 5.8 11.8L2.5 8Z" />
    <circle cx="6.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const pageDropdownRef = useRef<HTMLDivElement>(null);

  const pathname = location.pathname;
  const segments = pathname.split("/").filter(Boolean);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(event.target as Node)) {
        setIsPageDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsPageDropdownOpen(false);
  }, [pathname]);

  const allPages = StoreService.getPages();

  // Top-level workspace routes (Linear 1:1 typography with unified #6773e4 accent icon)
  if (segments[0] === "overview" || segments[0] === "work" || segments[0] === "my-work" || segments[0] === "deployments") {
    return (
      <div className="flex items-center gap-1.5 text-[14px] font-semibold text-text-primary min-w-0">
        <Link to="/pages" className="hover:text-text-secondary transition-colors shrink-0 outline-none">
          Pages
        </Link>
        <CaretRight className="w-3 h-3 text-text-tertiary/70 shrink-0 mx-0.5" weight="bold" />
        <div className="flex items-center gap-1.5 shrink-0">
          <SquaresFour className="w-4 h-4 text-[#6773e4] shrink-0" weight="bold" />
          <span>Overview</span>
        </div>
      </div>
    );
  }

  if (segments[0] === "coverage") {
    return (
      <div className="flex items-center gap-1.5 text-[14px] font-semibold text-text-primary min-w-0">
        <Link to="/pages" className="hover:text-text-secondary transition-colors shrink-0 outline-none">
          Pages
        </Link>
        <CaretRight className="w-3 h-3 text-text-tertiary/70 shrink-0 mx-0.5" weight="bold" />
        <div className="flex items-center gap-1.5 shrink-0">
          <ChartBar className="w-4 h-4 text-[#6773e4] shrink-0" weight="bold" />
          <span>Coverage</span>
        </div>
      </div>
    );
  }

  if (segments[0] === "history") {
    return (
      <div className="flex items-center gap-1.5 text-[14px] font-semibold text-text-primary min-w-0">
        <Link to="/pages" className="hover:text-text-secondary transition-colors shrink-0 outline-none">
          Pages
        </Link>
        <CaretRight className="w-3 h-3 text-text-tertiary/70 shrink-0 mx-0.5" weight="bold" />
        <div className="flex items-center gap-1.5 shrink-0">
          <ClockCounterClockwise className="w-4 h-4 text-[#6773e4] shrink-0" weight="bold" />
          <span>Audit History</span>
        </div>
      </div>
    );
  }

  if (segments[0] === "settings") {
    return (
      <div className="flex items-center gap-1.5 text-[14px] font-semibold text-text-primary min-w-0">
        <Link to="/pages" className="hover:text-text-secondary transition-colors shrink-0 outline-none">
          Pages
        </Link>
        <CaretRight className="w-3 h-3 text-text-tertiary/70 shrink-0 mx-0.5" weight="bold" />
        <div className="flex items-center gap-1.5 shrink-0">
          <GearSix className="w-4 h-4 text-[#6773e4] shrink-0" weight="bold" />
          <span>Settings</span>
        </div>
      </div>
    );
  }

  if (segments[0] === "guide") {
    return (
      <div className="flex items-center gap-1.5 text-[14px] font-semibold text-text-primary min-w-0">
        <Link to="/pages" className="hover:text-text-secondary transition-colors shrink-0 outline-none">
          Pages
        </Link>
        <CaretRight className="w-3 h-3 text-text-tertiary/70 shrink-0 mx-0.5" weight="bold" />
        <div className="flex items-center gap-1.5 shrink-0">
          <BookOpen className="w-4 h-4 text-[#6773e4] shrink-0" weight="bold" />
          <span>Team Guide</span>
        </div>
      </div>
    );
  }

  // --- /pages and sub-routes ---
  const isPageRoot = segments.length === 1 && segments[0] === "pages";
  const pageId = segments.length >= 2 && segments[0] === "pages" ? segments[1] : null;
  const isTagDetail = segments.length >= 4 && segments[2] === "tags";
  const tagId = isTagDetail ? segments[3] : null;

  // Resolve page info
  const cachedPage = pageId ? StoreService.getPage(pageId) : null;
  const pageName = cachedPage?.name || (pageId ? PAGE_NAME_MAPPINGS[pageId] || pageId : "MioTranslate");

  const tagIcon = <LinearTagIcon className="w-4 h-4 text-[#6773e4] shrink-0" />;

  const handleCopyTag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tagId) {
      navigator.clipboard.writeText(tagId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const filteredPages = allPages.filter(p => 
    p.name.toLowerCase().includes(pageSearch.toLowerCase()) || 
    p.pageId.toLowerCase().includes(pageSearch.toLowerCase())
  );

  return (
    <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-[14px] font-semibold text-text-primary min-w-0">
      {/* 1. Pages Root */}
      <Link
        to="/pages"
        className="hover:text-text-secondary transition-colors shrink-0 outline-none"
      >
        Pages
      </Link>

      <CaretRight className="w-3 h-3 text-text-tertiary/70 shrink-0 mx-0.5" weight="bold" />

      {/* 2. Workspace / Page Level (Cube in #6773e4 accent) */}
      {isPageRoot ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Cube className="w-4 h-4 text-[#6773e4] shrink-0" weight="bold" />
          <span>All Pages</span>
        </div>
      ) : (
        <div className="relative shrink-0 flex items-center" ref={pageDropdownRef}>
          {isTagDetail ? (
            <Link
              to={`/pages/${pageId}`}
              className="flex items-center gap-1.5 hover:text-text-secondary transition-colors outline-none"
            >
              <Cube className="w-4 h-4 text-[#6773e4] shrink-0" weight="bold" />
              <span>{pageName}</span>
            </Link>
          ) : (
            <button
              onClick={() => setIsPageDropdownOpen(!isPageDropdownOpen)}
              className="group flex items-center gap-1.5 hover:text-text-secondary transition-colors outline-none cursor-pointer"
            >
              <Cube className="w-4 h-4 text-[#6773e4] shrink-0" weight="bold" />
              <span>{pageName}</span>
              <CaretDown className="w-3 h-3 text-text-tertiary group-hover:text-text-primary transition-colors opacity-70 ml-0.5" weight="bold" />
            </button>
          )}

          {/* Quick Page Switcher Dropdown */}
          {isPageDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-bg-card border border-border-strong rounded-lg  py-1 z-50 overflow-hidden text-[13px] font-normal">
              <div className="px-2.5 py-1.5 border-b border-border-subtle">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pageSearch}
                    onChange={(e) => setPageSearch(e.target.value)}
                    placeholder="Switch page..."
                    autoFocus
                    className="w-full h-7 pl-7 pr-2 bg-bg-main border border-border-subtle rounded text-[12px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-blue"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto py-1 scrollbar-none">
                {filteredPages.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-text-tertiary text-center">No pages found</div>
                ) : (
                  filteredPages.map((p) => (
                    <button
                      key={p.pageId}
                      onClick={() => {
                        setIsPageDropdownOpen(false);
                        navigate(`/pages/${p.pageId}`);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between hover:bg-bg-hover transition-colors cursor-pointer ${
                        p.pageId === pageId ? "bg-accent-blue/10 text-accent-blue font-semibold" : "text-text-primary"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Cube className="w-3.5 h-3.5 text-[#6773e4] shrink-0" weight="bold" />
                        <span className="truncate">{p.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-text-tertiary uppercase ml-2">{p.pageId}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Tag Level (Linear Tag Icon in #6773e4 accent) */}
      {isTagDetail && tagId && (
        <>
          <CaretRight className="w-3 h-3 text-text-tertiary/70 shrink-0 mx-0.5" weight="bold" />

          <div className="flex items-center gap-1.5 shrink-0 group">
            {tagIcon}
            <span className="font-mono text-[13px] font-semibold text-text-primary">{tagId}</span>

            {/* Quick Copy Tag Key */}
            <button
              onClick={handleCopyTag}
              title="Copy tag key"
              className="p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors cursor-pointer outline-none ml-0.5"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-success" weight="bold" />
              ) : (
                <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" weight="bold" />
              )}
            </button>
          </div>
        </>
      )}
    </nav>
  );
};
