import type { ResolvedTag } from "../api";

export function GenericTagList({ tags }: { tags: ResolvedTag[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-text-subtle mb-2">
        This page does not have a custom UI fixture yet. Tags are rendered as a generic list.
      </div>
      <div className="bg-surface border border-border-main rounded-xl divide-y divide-border-main">
        {tags.map(tag => (
          <div key={tag.tagName} className="flex items-center justify-between px-4 py-2.5">
            <code className="text-xs text-text-subtle font-mono truncate w-1/3" title={tag.tagName}>{tag.tagName}</code>
            <span className="text-sm text-text-main w-2/3 break-words">
              {tag.fallbackUsed ? (
                <span className="bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[10px] mr-2">
                  {tag.fallbackLang.toUpperCase()}
                </span>
              ) : null}
              {tag.value || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
