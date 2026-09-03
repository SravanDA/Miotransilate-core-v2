/// <reference lib="webworker" />
import { parseFilesPayload, type InputFile } from '../utils/fileParser';

self.onmessage = (event: MessageEvent) => {
  try {
    const data = event.data;
    const files: InputFile[] = data.files 
      ? data.files 
      : (data.fileContent ? [{ fileName: data.fileName, fileContent: data.fileContent }] : []);

    if (files.length === 0) {
      throw new Error("No files provided for processing.");
    }

    const result = parseFilesPayload(files);

    self.postMessage({ 
      success: true, 
      pagesToUpload: result.pagesToUpload,
      summary: result.summary
    });
  } catch (error: any) {
    self.postMessage({ success: false, error: error.message || "Failed to parse files." });
  }
};
