import React, { useState, useRef } from 'react';

export const DataImportSettings: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importEvent, setImportEvent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Auto-upload
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const res = await fetch('/v1/migrations', {
          method: 'POST',
          body: formData,
        });
        
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        setImportEvent(data);
      } catch (err) {
        console.error(err);
        alert('Upload failed. Please make sure the backend is running and try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExecute = async () => {
    if (!importEvent) return;
    const eventId = importEvent.importEventId || importEvent.id;
    setLoading(true);
    try {
      const res = await fetch(`/v1/migrations/${eventId}/execute`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Execute failed');
      
      // Fetch report
      const reportRes = await fetch(`/v1/migrations/${eventId}/report`);
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
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="bg-white rounded-lg shadow-sm border border-[#DFE1E6] p-6 text-left">
        <h2 className="text-[16px] font-semibold text-[#172B4D] mb-2">Import Translation CSV</h2>
        <p className="text-[14px] text-[#6B778C] mb-5">
          Upload offline agency translations to batch-update target locale tags.
        </p>

        <input 
          ref={fileInputRef}
          type="file" 
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-white transition-colors cursor-pointer ${loading ? 'bg-[#0052CC]/70' : 'bg-[#0052CC] hover:bg-[#0065FF]'}`}
          disabled={loading}
        >
          {loading ? 'Uploading...' : 'Upload CSV File'}
        </button>
        
        {loading && <p className="text-[#0052CC] mt-4 text-sm">Processing...</p>}

        {/* Execute Section */}
        {importEvent && !loading && (
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">File Uploaded Successfully</h3>
            <p className="text-sm text-blue-700 mb-4">
              Migration ID: {importEvent.importEventId || importEvent.id}<br/>
              Filename: {importEvent.originalFilename || importEvent.filename}
            </p>
            
            <button 
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
              onClick={handleExecute}
              disabled={loading}
            >
              Execute Migration Import
            </button>
          </div>
        )}
        
        {/* Report Section */}
        {report.length > 0 && !loading && (
          <div className="mt-8">
            <h3 className="text-[16px] font-semibold text-[#172B4D] mb-4">Validation Report</h3>
            <div className="border border-[#DFE1E6] rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-[#DFE1E6]">
                <thead className="bg-[#F4F5F7]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B778C] uppercase tracking-wider">Row</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B778C] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[#6B778C] uppercase tracking-wider">Message</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#DFE1E6]">
                  {report.slice(0, 100).map((r, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#172B4D]">{r.sourceRowNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-sm text-xs font-bold ${r.eventType === 'ERROR' ? 'bg-[#FFEBE6] text-[#BF2600]' : 'bg-[#E3FCEF] text-[#006644]'}`}>
                          {r.eventType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#172B4D]">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.length > 100 && (
                <div className="px-6 py-4 text-center text-sm text-[#6B778C] border-t border-[#DFE1E6]">
                  Showing first 100 rows...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
