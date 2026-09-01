import type { Tag, LanguageConfig } from "../types";

export class ExportService {
  static exportToJson(pageName: string, tags: Tag[], activeLanguages: LanguageConfig[]) {
    const exportData = {
      page: pageName,
      exportedAt: new Date().toISOString(),
      tags: tags.map((t) => {
        const translations: Record<string, string> = {};
        activeLanguages.forEach((l) => {
          translations[l.code] = t.values?.[l.code]?.text || "";
        });
        return {
          id: t.id,
          english: t.english,
          type: t.type,
          englishVersion: t.englishVersion || 1,
          translations
        };
      })
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pageName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_translations.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static exportToCsv(pageName: string, tags: Tag[], activeLanguages: LanguageConfig[]) {
    const headers = ["Tag ID", "Type", "English Master", ...activeLanguages.map((l) => `${l.name} (${l.code})`)];
    
    const escapeCsv = (val: string | number | undefined) => {
      const s = String(val || "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = tags.map((t) => {
      const row = [
        escapeCsv(t.id),
        escapeCsv(t.type),
        escapeCsv(t.english)
      ];
      activeLanguages.forEach((l) => {
        row.push(escapeCsv(t.values?.[l.code]?.text || ""));
      });
      return row.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pageName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_translations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
