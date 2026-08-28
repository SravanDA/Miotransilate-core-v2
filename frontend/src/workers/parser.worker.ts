/// <reference lib="webworker" />

self.onmessage = (event: MessageEvent) => {
  const { fileContent, fileName } = event.data;

  try {
    let pagesToUpload: any[] = [];

    if (fileName.endsWith('.json')) {
      const parsed = JSON.parse(fileContent);
      pagesToUpload = Array.isArray(parsed) ? parsed : [parsed];
    } else if (fileName.endsWith('.csv')) {
      const lines = fileContent.split(/\r?\n/).filter((line: string) => line.trim() !== '');
      if (lines.length < 2) throw new Error("CSV file is empty or missing headers.");
      
      const pageMap = new Map<string, any>();

      for (let i = 1; i < lines.length; i++) {
        // Basic CSV parsing handling quotes
        const cols = lines[i].split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''));
        const pageId = cols[0];
        if (!pageId) continue;
        
        if (!pageMap.has(pageId)) {
          pageMap.set(pageId, {
            pageId,
            name: cols[1] || pageId,
            module: cols[2] || "POS",
            tags: []
          });
        }
        
        if (cols[3]) {
          pageMap.get(pageId).tags.push({
            id: cols[3],
            type: cols[4] || "Label",
            english: cols[5] || ""
          });
        }
      }
      pagesToUpload = Array.from(pageMap.values());
    } else {
      throw new Error("Unsupported file format. Please upload a .json or .csv file.");
    }

    for (const p of pagesToUpload) {
      if (!p.pageId || !p.name || !p.module) {
        throw new Error(`Invalid format. Missing required fields in page: ${p.pageId}`);
      }
    }

    self.postMessage({ success: true, pagesToUpload });
  } catch (error: any) {
    self.postMessage({ success: false, error: error.message });
  }
};
