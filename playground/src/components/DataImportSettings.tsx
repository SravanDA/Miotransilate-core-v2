import React, { useState, useRef } from 'react';
import { Button } from './ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table';

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
      <div className="bg-white rounded-[4px] shadow-sm border border-border-main p-6 text-left">
        <h2 className="text-[16px] font-semibold text-heading mb-2">Import Translation CSV</h2>
        <p className="text-[14px] text-help mb-5">
          Upload offline agency translations to batch-update target locale tags.
        </p>

        <input 
          ref={fileInputRef}
          type="file" 
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        
        <Button 
          variant="primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          {loading ? 'Uploading...' : 'Upload CSV File'}
        </Button>
        
        {loading && <p className="text-primary mt-4 text-sm">Processing...</p>}

        {/* Execute Section */}
        {importEvent && !loading && (
          <div className="mt-6 bg-table-row-even border border-border-main rounded-[4px] p-6">
            <h3 className="text-[14px] font-semibold text-heading mb-2">File Uploaded Successfully</h3>
            <p className="text-[14px] text-heading mb-4">
              Migration ID: <span className="font-semibold">{importEvent.importEventId || importEvent.id}</span><br/>
              Filename: <span className="font-semibold">{importEvent.originalFilename || importEvent.filename}</span>
            </p>
            
            <Button 
              variant="default"
              onClick={handleExecute}
              disabled={loading}
            >
              Execute Migration Import
            </Button>
          </div>
        )}
        
        {/* Report Section */}
        {report.length > 0 && !loading && (
          <div className="mt-8">
            <h3 className="text-[16px] font-semibold text-heading mb-4">Validation Report</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.slice(0, 100).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.sourceRowNumber}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-[4px] text-[12px] font-bold ${r.eventType === 'ERROR' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
                        {r.eventType}
                      </span>
                    </TableCell>
                    <TableCell>{r.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {report.length > 100 && (
              <div className="px-6 py-4 text-center text-[14px] text-help border-t border-border-main">
                Showing first 100 rows...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
