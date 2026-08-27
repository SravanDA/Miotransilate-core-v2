import React, { useState } from 'react';
import { api } from '../api';

export const DataImportSettings: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importEvent, setImportEvent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/v1/migrations', {
        method: 'POST',
        body: formData,
        headers: {
          // Add auth headers if required, e.g. 'Authorization': 'Bearer ...'
        }
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setImportEvent(data);
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!importEvent) return;
    setLoading(true);
    try {
      const res = await fetch(`/v1/migrations/${importEvent.id}/execute`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Execute failed');
      
      // Fetch report
      const reportRes = await fetch(`/v1/migrations/${importEvent.id}/report`);
      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport(reportData);
      }
      
      alert('Migration executed successfully!');
    } catch (err) {
      console.error(err);
      alert('Execute failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Data Import (Migration)</h1>
        <p className="text-gray-500 mb-8">
          Upload a translations CSV file to bulk import legacy pages and tags into MioTranslate.
          This will bypass the draft state and mark all imported strings as Approved.
        </p>

        <div className="space-y-6">
          {/* Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange}
              className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button 
              className="btn btn-primary w-full"
              disabled={!file || loading}
              onClick={handleUpload}
            >
              {loading ? 'Uploading...' : '1. Upload File'}
            </button>
          </div>

          {/* Execute Section */}
          {importEvent && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">File Uploaded Successfully</h3>
              <p className="text-sm text-blue-700 mb-4">
                Migration ID: {importEvent.id}<br/>
                Filename: {importEvent.filename}
              </p>
              
              <button 
                className="btn btn-primary w-full"
                onClick={handleExecute}
                disabled={loading}
              >
                {loading ? 'Executing...' : '2. Execute Migration Import'}
              </button>
            </div>
          )}
          
          {/* Report Section */}
          {report.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Validation Report</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.slice(0, 100).map((r, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.sourceRowNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.eventType === 'ERROR' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {r.eventType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.length > 100 && (
                  <div className="px-6 py-4 text-center text-sm text-gray-500 border-t border-gray-200">
                    Showing first 100 rows...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
