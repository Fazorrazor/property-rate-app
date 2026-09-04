"use client";

import { useState, useRef } from "react";
import { X, UploadCloud, FileText, AlertTriangle, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { importCadastreCsvBatch } from "@/app/actions";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export function CsvImportModal({ isOpen, onClose, onSuccess }: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r\n|\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setErrorMsg("CSV file must contain at least a header row and one data row.");
      return;
    }

    // Split CSV line respecting quotes
    const splitLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ""));
          cur = "";
        } else {
          cur += char;
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, ""));
      return result;
    };

    const rawHeaders = splitLine(lines[0]);
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = splitLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;

      const rowObj: any = {};
      rawHeaders.forEach((h, idx) => {
        rowObj[h] = values[idx] || "";
      });
      rows.push(rowObj);
    }

    if (rows.length === 0) {
      setErrorMsg("No valid data rows found in CSV file.");
      return;
    }

    setParsedRows(rows);
    setPreviewRows(rows.slice(0, 5));
    setErrorMsg(null);
  };

  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      setErrorMsg("Please upload a valid .csv file.");
      return;
    }
    setFile(selectedFile);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) parseCsvText(text);
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read the selected file.");
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) {
      setErrorMsg("Please select and parse a CSV file first.");
      return;
    }
    if (!adminPassword.trim()) {
      setErrorMsg("Administrator security password is required to authorize bulk ingestion.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await importCadastreCsvBatch(parsedRows, adminPassword);
      if (res.success) {
        onSuccess(res.importedCount || 0);
        handleReset();
        onClose();
      } else {
        setErrorMsg(res.error || "Bulk cadastre import failed.");
      }
    } catch (err) {
      console.error("Import error:", err);
      setErrorMsg("A system error occurred during CSV batch ingestion.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setPreviewRows([]);
    setAdminPassword("");
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-2xl border border-[#DADCE0] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DADCE0] flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-sm font-bold text-[#2C2C2C] tracking-tight">
              Bulk Cadastre &amp; Valuation Roll Importer
            </h3>
            <p className="text-xs text-[#717171] mt-0.5">
              Ingest municipal cadastre valuation rolls into the KKMA assembly database.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#717171] hover:text-[#2C2C2C] hover:bg-[#F1F3F4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* File Dropzone */}
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? "border-[#612D53] bg-[#612D53]/5"
                  : "border-[#DADCE0] hover:border-[#612D53] hover:bg-[#F8F9FA]"
              }`}
            >
              <UploadCloud className="w-8 h-8 text-[#612D53]" />
              <div className="space-y-0.5">
                <span className="font-semibold text-[#2C2C2C] block">
                  Click to browse or drag &amp; drop your Cadastre CSV
                </span>
                <span className="text-[11px] text-[#717171] block">
                  Supports LVD exports with Account Number, Rateable Value, Owner, and GPS Digital Address
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
            </div>
          ) : (
            <div className="p-3 bg-[#F8F9FA] border border-[#DADCE0] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-5 h-5 text-[#612D53] shrink-0" />
                <div className="truncate">
                  <span className="font-medium text-[#2C2C2C] truncate block">{file.name}</span>
                  <span className="text-[11px] text-[#717171]">
                    {(file.size / 1024).toFixed(1)} KB &bull; {parsedRows.length} records parsed
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[#EA4335] hover:underline font-medium cursor-pointer shrink-0 ml-3"
              >
                Change File
              </button>
            </div>
          )}

          {/* Pre-Import Preview Table */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#2C2C2C]">
                  Parsed Preview (First 5 of {parsedRows.length} parcels)
                </span>
                <span className="text-[11px] text-[#188038] font-medium">
                  &bull; Schema Headers Matched
                </span>
              </div>

              <div className="border border-[#DADCE0] rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[#717171] text-[11px]">
                    <tr>
                      <th className="py-2 px-3 whitespace-nowrap">Account #</th>
                      <th className="py-2 px-3 whitespace-nowrap">Owner / Taxpayer</th>
                      <th className="py-2 px-3 whitespace-nowrap">Digital Address</th>
                      <th className="py-2 px-3 whitespace-nowrap">Classification</th>
                      <th className="py-2 px-3 text-right whitespace-nowrap">Rateable Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAED] bg-white">
                    {previewRows.map((r, idx) => {
                      const acc = r.accountNumber || r["Account Number"] || r["account_no"] || r["Account"] || "N/A";
                      const owner = r.ownerName || r["Owner Name"] || r["owner_name"] || r["Name"] || "Municipal Ratepayer";
                      const gps = r.ownerDigitalAddress || r["Digital Address"] || r["digital_address"] || r["GPS"] || "N/A";
                      const cls = r.propertyClassification || r["Classification"] || r["classification"] || "RESIDENTIAL";
                      const val = parseFloat(r.rateableValue || r["Rateable Value"] || r["rateable_value"] || r["Value"] || 0) || 0;

                      return (
                        <tr key={idx} className="hover:bg-[#F8F9FA]">
                          <td className="py-2 px-3 font-mono font-medium text-[#2C2C2C] whitespace-nowrap">{acc}</td>
                          <td className="py-2 px-3 text-[#2C2C2C] whitespace-nowrap">{owner}</td>
                          <td className="py-2 px-3 font-mono text-[#717171] whitespace-nowrap">{gps}</td>
                          <td className="py-2 px-3 text-[#717171] whitespace-nowrap">{cls}</td>
                          <td className="py-2 px-3 text-right font-medium text-[#2C2C2C] whitespace-nowrap tabular-nums">
                            GH₵ {val.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-[#EA4335]/10 border border-[#EA4335]/30 rounded-xl text-xs text-[#EA4335] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Administrator Password Challenge */}
          {parsedRows.length > 0 && (
            <div className="p-4 bg-[#F8F9FA] border border-[#DADCE0] rounded-xl space-y-2">
              <label className="text-xs font-semibold text-[#2C2C2C] block">
                Administrator Authorization Password
              </label>
              <p className="text-[11px] text-[#717171]">
                Enter your administrative security password to confirm ingestion into the official cadastre.
              </p>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter administrator password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full h-9 pl-3 pr-9 rounded-lg border border-[#DADCE0] bg-white text-xs text-[#2C2C2C] focus:outline-none focus:border-[#612D53]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-[#717171] hover:text-[#2C2C2C] p-0.5 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-3.5 border-t border-[#DADCE0] bg-white flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="btn-3d-secondary h-8 px-4 rounded-lg text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={isProcessing || parsedRows.length === 0 || !adminPassword.trim()}
            className="btn-3d-primary h-8 px-4 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Ingesting Parcels...</span>
              </>
            ) : (
              <span>Import {parsedRows.length > 0 ? `${parsedRows.length} Parcels` : "Cadastre Roll"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
