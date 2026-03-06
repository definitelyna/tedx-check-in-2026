import { useState, useRef } from "react";
import Papa from "papaparse";
import { db, type Attendee } from "../lib/firebase";
import { collection, writeBatch, doc } from "firebase/firestore";
import { Upload, FileText, CheckCircle, XCircle } from "lucide-react";

interface CSVRow {
  name: string;
  email: string;
  qr_code: string;
  ticket_number: string;
}

interface UploadResult {
  success: number;
  failed: number;
  errors: string[];
}

export function CSVUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResult(null);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const errors: string[] = [];
        let successCount = 0;
        let failedCount = 0;

        try {
          // Validate and prepare data
          const validRows: Array<Omit<Attendee, "id">> = [];

          results.data.forEach((row, index) => {
            const lineNumber = index + 2; // +2 because index is 0-based and CSV has header

            // Validate required fields
            if (!row.name || !row.email || !row.qr_code || !row.ticket_number) {
              errors.push(
                `Line ${lineNumber}: Missing required fields (name, email, qr_code, ticket_number)`,
              );
              failedCount++;
              return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(row.email)) {
              errors.push(`Line ${lineNumber}: Invalid email format`);
              failedCount++;
              return;
            }

            validRows.push({
              name: row.name.trim(),
              email: row.email.trim().toLowerCase(),
              qr_code: row.qr_code.trim(),
              ticket_number: row.ticket_number.trim(),
              checked_in: false,
              checked_in_at: null,
            });
          });

          // Use batch writes for better performance (max 500 per batch)
          const batchSize = 500;
          for (let i = 0; i < validRows.length; i += batchSize) {
            const batch = writeBatch(db);
            const batchRows = validRows.slice(i, i + batchSize);

            batchRows.forEach((attendee) => {
              const docRef = doc(collection(db, "attendees"));
              batch.set(docRef, attendee);
            });

            await batch.commit();
            successCount += batchRows.length;
          }

          setResult({
            success: successCount,
            failed: failedCount,
            errors: errors.slice(0, 10), // Show only first 10 errors
          });
        } catch (error) {
          console.error("Error uploading attendees:", error);
          setResult({
            success: successCount,
            failed: failedCount + (results.data.length - successCount),
            errors: [
              `Upload error: ${error instanceof Error ? error.message : "Unknown error"}`,
            ],
          });
        }

        setUploading(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        console.error("CSV parsing error:", error);
        setResult({
          success: 0,
          failed: 0,
          errors: [`CSV parsing error: ${error.message}`],
        });
        setUploading(false);
      },
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-red-600">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="w-5 h-5 text-red-500" />
        <h2 className="text-lg font-semibold text-white">
          Import Attendees from CSV
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="csv-upload"
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploading
                ? "border-gray-600 bg-gray-900 cursor-not-allowed"
                : "border-red-600 bg-gray-900 hover:bg-gray-800 hover:border-red-500"
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload
                className={`w-8 h-8 mb-2 ${uploading ? "text-gray-600" : "text-red-500"}`}
              />
              <p className="mb-2 text-sm text-gray-400">
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-gray-500">
                CSV file with columns: name, email, qr_code, ticket_number
              </p>
            </div>
            <input
              ref={fileInputRef}
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {uploading && (
          <div className="flex items-center justify-center gap-2 text-red-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-400 border-t-transparent"></div>
            <span>Uploading attendees...</span>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {result.success > 0 && (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {result.success} attendees added
                  </span>
                </div>
              )}
              {result.failed > 0 && (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">{result.failed} failed</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-950 border border-red-800 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-400 mb-2">
                  Errors:
                </p>
                <ul className="text-xs text-red-300 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                  {result.failed > result.errors.length && (
                    <li className="text-red-400">
                      ... and {result.failed - result.errors.length} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 mt-4">
          <p className="font-semibold mb-1">CSV Format Example:</p>
          <pre className="bg-gray-900 p-2 rounded border border-gray-700 overflow-x-auto">
            {`name,email,qr_code,ticket_number
John Doe,john@example.com,QR001,T001
Jane Smith,jane@example.com,QR002,T002`}
          </pre>
        </div>
      </div>
    </div>
  );
}
