// src/components/BatteryAnalytics.jsx
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  ScatterChart, 
  TrendingUp, 
  Layers, 
  Filter, 
  Info, 
  Search, 
  ArrowUpDown,
  Download
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ScatterChart as RScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { fetchBenchmarkDataset } from '../services/api';

export default function BatteryAnalytics() {
  const [data, setData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('predicted_powertrain_eff_percent');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetchBenchmarkDataset()
      .then(res => {
        setData(res.dataset || []);
        setMetadata(res.metadata || null);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load benchmark dataset", err);
        setLoading(false);
      });
  }, []);

  const cellTypes = ['ALL', ...Array.from(new Set(data.map(d => d.cell_type)))];

  const filteredData = data.filter(d => {
    const matchesCell = selectedCell === 'ALL' || d.cell_type === selectedCell;
    const matchesSearch = d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.config.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.cell_type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCell && matchesSearch;
  }).sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const exportCSV = () => {
    if (!filteredData.length) return;
    const headers = Object.keys(filteredData[0]);
    const csvRows = [headers.join(',')];
    filteredData.forEach(row => {
      csvRows.push(headers.map(h => row[h]).join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `motorsport_battery_analytics_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Disclaimer */}
      <div className="racing-card p-6 space-y-3 border-l-4 border-l-neon-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-neon-400" />
              <h2 className="text-xl font-display font-bold text-white">
                Battery Analytics & Parameter Sweeps
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Multi-dimensional analysis of physical battery pack parameters, voltage sag, and predicted powertrain efficiency
            </p>
          </div>

          <button
            onClick={exportCSV}
            className="px-3.5 py-2 rounded-lg bg-charcoal-850 hover:bg-charcoal-800 border border-charcoal-700 text-xs font-mono text-slate-200 hover:text-white flex items-center space-x-2 transition-colors self-start sm:self-auto"
          >
            <Download className="w-4 h-4 text-neon-400" />
            <span>Export Analytics CSV</span>
          </button>
        </div>

        {/* Explicit Physics Provenance Notice */}
        <div className="p-3 rounded-lg bg-charcoal-900/90 border border-charcoal-800 flex items-start space-x-2.5 text-xs text-slate-300 font-mono">
          <Info className="w-4 h-4 text-racing-cyan flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-racing-cyan">Data Provenance & Engineering Authenticity:</span>
            <p className="text-slate-400">
              {metadata?.disclaimer || "All values represent systematically verified physics parameter sweeps across Formula Student architectures and the trained XGBoost model. Not fabricated sensor measurements."}
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Predicted Efficiency vs Voltage Target */}
        <div className="racing-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-charcoal-700/80 pb-2">
            <div>
              <h3 className="font-display font-bold text-sm text-white">
                Powertrain Efficiency (%) vs Pack Target Voltage (V)
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Observe the efficiency gain achieved by higher system voltage architecture
              </p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis 
                  type="number" 
                  dataKey="V_pack_target_V" 
                  name="Target Voltage" 
                  unit="V" 
                  stroke="#64748B" 
                  fontSize={11} 
                  domain={['dataMin - 20', 'dataMax + 20']} 
                />
                <YAxis 
                  type="number" 
                  dataKey="predicted_powertrain_eff_percent" 
                  name="Efficiency" 
                  unit="%" 
                  stroke="#64748B" 
                  fontSize={11} 
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  contentStyle={{ 
                    backgroundColor: '#0B0F17', 
                    borderColor: '#334155', 
                    borderRadius: '8px', 
                    fontSize: '11px', 
                    fontFamily: 'monospace' 
                  }} 
                />
                <Scatter name="Simulation Runs" data={filteredData} fill="#00FF66" />
              </RScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Pack Mass vs Pack Energy */}
        <div className="racing-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-charcoal-700/80 pb-2">
            <div>
              <h3 className="font-display font-bold text-sm text-white">
                Pack Mass (kg) vs Pack Energy Storage (kWh)
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Gravimetric energy density frontier across 18650 and 21700 cell formats
              </p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis 
                  type="number" 
                  dataKey="energy_kWh" 
                  name="Energy" 
                  unit=" kWh" 
                  stroke="#64748B" 
                  fontSize={11} 
                />
                <YAxis 
                  type="number" 
                  dataKey="pack_mass_kg" 
                  name="Pack Mass" 
                  unit=" kg" 
                  stroke="#64748B" 
                  fontSize={11} 
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  contentStyle={{ 
                    backgroundColor: '#0B0F17', 
                    borderColor: '#334155', 
                    borderRadius: '8px', 
                    fontSize: '11px', 
                    fontFamily: 'monospace' 
                  }} 
                />
                <Scatter name="Configurations" data={filteredData} fill="#00F0FF" />
              </RScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filter & Benchmark Runs Table */}
      <div className="racing-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal-700/80 pb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-neon-400" />
            <h3 className="font-display font-bold text-base text-white">
              Benchmark Dataset Explorer ({filteredData.length} Runs)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Cell Type Filter */}
            <div className="flex items-center space-x-1.5 text-xs font-mono bg-charcoal-900 border border-charcoal-700 px-2 py-1.5 rounded-lg">
              <span className="text-slate-400">Cell:</span>
              <select
                value={selectedCell}
                onChange={(e) => setSelectedCell(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer"
              >
                {cellTypes.map(c => (
                  <option key={c} value={c} className="bg-charcoal-900 text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search run ID, cell..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-charcoal-900 border border-charcoal-700 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-neon-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-charcoal-700/80 text-slate-400 text-[11px]">
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('id')}>
                  <span className="flex items-center space-x-1">
                    <span>Run ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3">Cell Spec</th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('V_pack_target_V')}>
                  <span className="flex items-center space-x-1">
                    <span>Target V</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('P_peak_req_kW')}>
                  <span className="flex items-center space-x-1">
                    <span>Peak kW</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3">Config</th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('battery_eff_percent')}>
                  <span className="flex items-center space-x-1">
                    <span>Battery Eff.</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('pack_mass_kg')}>
                  <span className="flex items-center space-x-1">
                    <span>Mass (kg)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('predicted_powertrain_eff_percent')}>
                  <span className="flex items-center space-x-1 text-neon-400">
                    <span>Powertrain Eff.</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800 text-slate-200">
              {filteredData.slice(0, 15).map((row, i) => (
                <tr key={i} className="hover:bg-charcoal-850/60 transition-colors">
                  <td className="py-2 px-3 font-bold text-white">{row.id}</td>
                  <td className="py-2 px-3 text-slate-300">{row.cell_type}</td>
                  <td className="py-2 px-3">{row.V_pack_target_V}V &rarr; {row.achieved_V_pack}V</td>
                  <td className="py-2 px-3">{row.P_peak_req_kW} kW</td>
                  <td className="py-2 px-3 text-slate-400">{row.config}</td>
                  <td className="py-2 px-3 text-racing-cyan font-semibold">{row.battery_eff_percent}%</td>
                  <td className="py-2 px-3">{row.pack_mass_kg} kg</td>
                  <td className="py-2 px-3 text-neon-400 font-bold">{row.predicted_powertrain_eff_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData.length > 15 && (
            <p className="text-xs text-slate-500 font-mono text-center pt-3">
              Showing top 15 of {filteredData.length} records. Use search or export to CSV for complete data.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
