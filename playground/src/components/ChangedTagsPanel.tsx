import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { ChangeResult } from "../api";

export function ChangedTagsPanel({ changeData, showChanges }: { changeData: ChangeResult | null, showChanges: boolean }) {
  const [expanded, setExpanded] = useState(true);

  if (!showChanges || !changeData) return null;

  return (
    <div className={`border-t border-gray-200 bg-white transition-all duration-300 flex flex-col ${expanded ? 'h-64' : 'h-12'}`}>
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer bg-gray-50 border-b border-gray-200 hover:bg-gray-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <span className="font-semibold text-sm text-gray-900">Changed Tags</span>
          <span className="text-xs text-gray-500">
            {changeData.changes.length} changed · {changeData.unchanged} unchanged
          </span>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
      </div>
      
      {expanded && (
        <div className="flex-1 overflow-auto p-4">
          {changeData.changes.length === 0 ? (
            <div className="text-sm text-gray-500 italic">No tags changed from baseline in this environment.</div>
          ) : (
            <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
              {changeData.changes.map(c => (
                <div key={c.tagName} className="flex flex-col px-4 py-2 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-xs font-mono font-medium text-gray-800">{c.tagName}</code>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.type === 'ADDED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {c.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 line-through truncate max-w-[200px]">{c.before || "(empty)"}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-900 font-medium">{c.after}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
