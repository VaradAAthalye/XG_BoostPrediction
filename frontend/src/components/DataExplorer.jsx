// src/components/DataExplorer.jsx
import React, { useState } from 'react';
import { 
  Database, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Download, 
  Play, 
  Search,
  CheckCircle2
} from 'lucide-react';
import { uploadCsvFile } from '../services/api';

export default function DataExplorer() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError("Please select a valid CSV (.csv) file.");
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const executeUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadCsvFile(file);
      setUploadResult(res);
      setLoading(false);
    } catch (err) {
      setError(err.message || "Failed to process CSV file.");
      setLoading(false);
    }
  };

  const downloadSampleTemplate = () => {
    const sampleHeaders = [
      "motor_peak", "motor_cont", "motor_max_rpm", "gear_ratio", "tire_r_in", "vehicle_mass",
      "Cd", "A", "Cr", "V_cell", "Ah_cell", "m_cell", "R_cell", "I_cell_max", "V_pack_target", "P_peak_required"
    ];
    const sampleRows = [
      [230, 120, 6000, 4.5, 9.5, 240, 0.85, 1.15, 0.015, 3.6, 3.0, 0.048, 0.020, 25.0, 400.0, 75000],
      [210, 110, 5800, 4.2, 9.0, 225, 0.82, 1.10, 0.014, 3.6, 3.2, 0.046, 0.018, 30.0, 380.0, 70000],
      [250, 130, 6500, 4.8, 10.0, 255, 0.88, 1.20, 0.016, 3.65, 3.5, 0.050, 0.016, 35.0, 420.0, 80000],
      [190, 95, 5200, 4.0, 9.2, 215, 0.79, 1.05, 0.013, 3.6, 2.8, 0.045, 0.022, 22.0, 360.0, 60000]
    ];

    const csvContent = [
      sampleHeaders.join(','),
      ...sampleRows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "motorsport_telemetry_sample_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadResultsCSV = () => {
    if (!uploadResult || !uploadResult.results) return;
    const items = uploadResult.results;
    if (items.length === 0) return;

    const headers = Object.keys(items[0]);
    const csvContent = [
      headers.join(','),
      ...items.map(row => headers.map(h => row[h] !== undefined ? `"${row[h]}"` : '""').join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xgboost_batch_predictions_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedRows = (uploadResult?.results || []).filter(r => {
    if (!searchTerm) return true;
    return JSON.stringify(r).toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="racing-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-neon-400" />
            <h2 className="text-xl font-display font-bold text-white">
              Data Explorer & Batch Inference Engine
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Validate external dataset schemas and execute batch predictions using the active XGBoost model
          </p>
        </div>

        <button
          onClick={downloadSampleTemplate}
          className="px-3.5 py-2 rounded-lg bg-charcoal-850 hover:bg-charcoal-800 border border-charcoal-700 text-xs font-mono text-neon-400 hover:text-neon-300 flex items-center space-x-2 transition-colors self-start md:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`racing-card p-8 border-2 border-dashed text-center transition-all ${
          dragOver 
            ? 'border-neon-500 bg-neon-500/5' 
            : file 
              ? 'border-neon-500/60 bg-charcoal-900/90' 
              : 'border-charcoal-700/80 hover:border-slate-500'
        }`}
      >
        <div className="max-w-md mx-auto space-y-3">
          <div className="h-12 w-12 rounded-full bg-charcoal-800 border border-charcoal-700 mx-auto flex items-center justify-center text-neon-400">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <h3 className="font-display font-bold text-base text-white">
              {file ? file.name : "Drag & Drop Telemetry CSV Here"}
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Supports raw vehicle parameters or direct 24 MODEL_COLUMNS format
            </p>
          </div>

          <div className="flex items-center justify-center space-x-3 pt-2">
            <label className="cursor-pointer px-4 py-2 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-xs font-mono text-white transition-colors border border-charcoal-700">
              <span>Browse Files</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
            </label>

            {file && (
              <button
                onClick={executeUpload}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-neon-500 hover:bg-neon-400 text-charcoal-950 font-bold text-xs font-mono tracking-wide transition-all shadow-neon flex items-center space-x-1.5"
              >
                {loading ? (
                  <span>Processing Batch...</span>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Batch Prediction</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-racing-red/10 border border-racing-red/40 text-racing-red text-xs font-mono space-y-1">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>CSV Processing Error</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      {/* Batch Results View */}
      {uploadResult && (
        <div className="racing-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal-700/80 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-neon-400" />
                <h3 className="font-display font-bold text-base text-white">
                  Batch Inference Results ({uploadResult.valid_rows} / {uploadResult.total_rows} Valid)
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Mode: <span className="text-neon-400">{uploadResult.mode}</span> &bull; File: {uploadResult.filename}
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter results..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-charcoal-900 border border-charcoal-700 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-neon-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>

              <button
                onClick={downloadResultsCSV}
                className="px-3.5 py-1.5 rounded-lg bg-neon-500 hover:bg-neon-400 text-charcoal-950 font-bold text-xs font-mono tracking-wide transition-all shadow-neon flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Results</span>
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-charcoal-700 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3">Row</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-neon-400">Predicted Efficiency</th>
                  <th className="py-2.5 px-3">Pack Voltage</th>
                  <th className="py-2.5 px-3">Battery Eff.</th>
                  <th className="py-2.5 px-3">Pack Mass</th>
                  <th className="py-2.5 px-3">Total Cells</th>
                  <th className="py-2.5 px-3">Notes / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-800 text-slate-200">
                {displayedRows.map((r, i) => (
                  <tr key={i} className="hover:bg-charcoal-850/50 transition-colors">
                    <td className="py-2 px-3 text-slate-500">#{r.row_number || i + 1}</td>
                    <td className="py-2 px-3">
                      {r.feasible ? (
                        <span className="px-2 py-0.5 rounded bg-neon-500/10 border border-neon-500/30 text-neon-400 font-bold text-[10px]">
                          FEASIBLE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-racing-red/10 border border-racing-red/30 text-racing-red font-bold text-[10px]">
                          UNFEASIBLE
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-neon-400 font-bold text-sm">
                      {r.predicted_efficiency_percent !== null && r.predicted_efficiency_percent !== undefined
                        ? `${r.predicted_efficiency_percent}%` 
                        : '&mdash;'}
                    </td>
                    <td className="py-2 px-3">{r.pack_V ? `${r.pack_V} V` : '&mdash;'}</td>
                    <td className="py-2 px-3 text-racing-cyan">
                      {r.battery_eff ? `${(r.battery_eff * 100).toFixed(2)}%` : '&mdash;'}
                    </td>
                    <td className="py-2 px-3">{r.pack_mass_kg ? `${r.pack_mass_kg} kg` : '&mdash;'}</td>
                    <td className="py-2 px-3">{r.cells_total || '&mdash;'}</td>
                    <td className="py-2 px-3 text-slate-400 max-w-xs truncate">
                      {r.error || (r.feasible ? 'Passes all constraints' : 'Rejected')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
