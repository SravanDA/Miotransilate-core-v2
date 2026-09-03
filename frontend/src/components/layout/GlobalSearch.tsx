import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { 
  MagnifyingGlass as Search, 
  FileText, 
  Tag as TagIcon, 
  Tray, 
  ArrowElbowDownLeft,
  X
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { StoreService } from "../../store/StoreService";

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  type: "page" | "tag" | "nav";
  title: string;
  subtitle: string;
  path: string;
  badge?: string;
}

const STATIC_NAV: SearchResult[] = [
  { id: "nav-pages", type: "nav", title: "Pages List", subtitle: "Browse all pages and modules", path: "/pages" },
  { id: "nav-overview", type: "nav", title: "Overview & Deployment Center", subtitle: "Unified governance queue: review translations, English copy, release readiness, and publish history", path: "/overview" },
  { id: "nav-history", type: "nav", title: "Audit Trail / History", subtitle: "Detailed audit history across all changes", path: "/history" },
  { id: "nav-settings", type: "nav", title: "System Settings", subtitle: "Manage users, roles, languages, and configs", path: "/settings" },
];

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return STATIC_NAV;
    }

    const pages = StoreService.getPages();
    const matchedPages: SearchResult[] = [];
    const matchedTags: SearchResult[] = [];

    // Search Pages
    pages.forEach((p) => {
      if (p.pageId.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.module.toLowerCase().includes(q)) {
        matchedPages.push({
          id: `page-${p.pageId}`,
          type: "page",
          title: p.name,
          subtitle: `${p.module} · ${p.pageId}`,
          path: `/pages/${p.pageId}`,
          badge: p.status
        });
      }

      // Search Tags within page
      const tags = StoreService.getTags(p.pageId);
      tags.forEach((t) => {
        const matchId = t.id.toLowerCase().includes(q);
        const matchEng = t.english?.toLowerCase().includes(q);
        let matchTrans = false;
        let transSnippet = "";
        
        if (t.values) {
          Object.entries(t.values).forEach(([lang, val]) => {
            if (val.text && val.text.toLowerCase().includes(q)) {
              matchTrans = true;
              transSnippet = `(${lang.toUpperCase()}) ${val.text}`;
            }
          });
        }

        if (matchId || matchEng || matchTrans) {
          matchedTags.push({
            id: `tag-${p.pageId}-${t.id}`,
            type: "tag",
            title: t.id,
            subtitle: `${p.name} · ${transSnippet || t.english || "No copy"}`,
            path: `/pages/${p.pageId}/tags/${t.id}`,
            badge: t.englishStatus || "Tag"
          });
        }
      });
    });

    // Search static nav
    const matchedNav = STATIC_NAV.filter(
      n => n.title.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q)
    );

    return [...matchedNav, ...matchedPages.slice(0, 5), ...matchedTags.slice(0, 15)];
  }, [query]);

  // Reset selectedIndex if out of bounds
  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(0);
    }
  }, [results.length, selectedIndex]);

  const handleSelect = (item: SearchResult) => {
    onClose();
    navigate(item.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (results.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (results.length || 1)) % (results.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <div 
        onClick={onClose}
        className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs overflow-hidden"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="bg-bg-card border border-border-subtle rounded-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[75vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Header Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle bg-bg-card">
            <Search className="w-5 h-5 text-text-tertiary shrink-0" weight="bold" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages, tags, English copy, translations, actions..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-[14px] text-text-primary placeholder:text-text-tertiary outline-none font-medium"
            />
            {query ? (
              <button 
                onClick={() => setQuery("")}
                className="p-1 text-text-tertiary hover:text-text-primary rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold text-text-tertiary bg-bg-main border border-border-strong rounded ">
                ESC
              </kbd>
            )}
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-2 space-y-1 divide-y divide-transparent">
            {results.length > 0 ? (
              results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const Icon = item.type === "page" ? FileText : item.type === "tag" ? TagIcon : Tray;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected ? "bg-accent-blue/10 text-accent-blue" : "text-text-primary hover:bg-bg-hover"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-accent-blue text-white" : "bg-bg-main text-text-secondary border border-border-subtle"
                      }`}>
                        <Icon className="w-3.5 h-3.5" weight={isSelected ? "bold" : "regular"} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[13px] font-semibold truncate ${isSelected ? "text-accent-blue" : "text-text-primary"}`}>
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-bg-main border border-border-subtle text-text-secondary">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-text-tertiary truncate max-w-md">
                          {item.subtitle}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <ArrowElbowDownLeft className="w-3.5 h-3.5 text-accent-blue shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-text-tertiary">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-[13px] font-medium text-text-primary">No results found for "{query}"</p>
                <p className="text-[11px] text-text-secondary mt-0.5">Try searching for a tag key, page name, or module</p>
              </div>
            )}
          </div>

          {/* Footer Shortcuts */}
          <div className="px-4 py-2 border-t border-border-subtle bg-bg-main text-[11px] text-text-tertiary flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span><kbd className="font-mono font-bold">↑↓</kbd> Navigate</span>
              <span><kbd className="font-mono font-bold">↵</kbd> Select</span>
              <span><kbd className="font-mono font-bold">ESC</kbd> Close</span>
            </div>
            <span>{results.length} item{results.length === 1 ? '' : 's'}</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
