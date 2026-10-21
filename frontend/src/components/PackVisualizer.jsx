// src/components/PackVisualizer.jsx
import React, { useState } from 'react';
import { BatteryCharging, ShieldAlert, CheckCircle, Zap, Scale, Layers } from 'lucide-react';

export default function PackVisualizer({ pack, explanation, diagnostics }) {
  const [selectedModule, setSelectedModule] = useState(0);

  if (!pack || !explanation) {
    return (
      <div className="racing-card p-6 text-center text-slate-400">
        <p className="font-mono text-sm">No battery pack configuration available. Run a prediction to size the pack.</p>
      </div>
    );
  }

  const { S, P, Ns, Np, cells_per_module, total_cells, module_voltage_V, module_capacity_Ah, module_energy_Wh, module_max_current_A, target_voltage_V, achieved_voltage_V, voltage_drop_V } = explanation;

  // FSAE Regulatory Compliance Matrix
  const checks = [
    { label: "Max Module Voltage (≤ 120V)", value: `${module_voltage_V} V`, pass: module_voltage_V <= 120 },
    { label: "Max Pack Mass (≤ 60 kg)", value: `${pack.Mass_pack} kg`, pass: pack.Mass_pack <= 60 },
    { label: "Max Total Cells (≤ 2000)", value: `${total_cells} cells`, pass: total_cells <= 2000 },
    { label: "Module Energy (≤ 6.0 MJ)", value: `${explanation.module_energy_MJ} MJ`, pass: explanation.module_energy_MJ <= 6.0 },
    { label: "Voltage Window (±10% Target)", value: `${achieved_voltage_V} V`, pass: achieved_voltage_V >= 0.9 * target_voltage_V && achieved_voltage_V <= 1.1 * target_voltage_V },
  ];

  return (
    <div className="racing-card p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal-700/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <BatteryCharging className="w-5 h-5 text-neon-400" />
            <h3 className="font-display font-bold text-lg text-white">
              Modular Battery Architecture
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-charcoal-800 border border-charcoal-700 text-neon-400">
              {S}S{P}P Module &bull; {Ns}Ns &times; {Np}Np Pack
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Physics-optimized discrete cell clustering under Formula Student / Motorsport limits
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-slate-400">Efficiency:</span>
          <span className="text-neon-400 font-bold text-sm telemetry-num">
            {(pack.Battery_eff * 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Primary Pack Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-charcoal-900/90 border border-charcoal-700/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400">Pack Voltage (Nominal)</span>
          <div className="text-lg font-bold text-white font-mono mt-0.5 telemetry-num">
            {achieved_voltage_V} <span className="text-xs text-neon-400">V</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Target: {target_voltage_V} V</span>
        </div>

        <div className="bg-charcoal-900/90 border border-charcoal-700/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400">Loaded Voltage (Sag)</span>
          <div className="text-lg font-bold text-racing-cyan font-mono mt-0.5 telemetry-num">
            {pack.V_load} <span className="text-xs text-slate-400">V</span>
          </div>
          <span className="text-[10px] text-racing-amber font-mono">&minus;{voltage_drop_V} V drop ({diagnostics?.voltage_sag_percent || 0}%)</span>
        </div>

        <div className="bg-charcoal-900/90 border border-charcoal-700/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400">Pack Energy Storage</span>
          <div className="text-lg font-bold text-neon-400 font-mono mt-0.5 telemetry-num">
            {(pack.Energy_Wh / 1000).toFixed(2)} <span className="text-xs text-slate-400">kWh</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{pack.Energy_Wh} Wh</span>
        </div>

        <div className="bg-charcoal-900/90 border border-charcoal-700/80 p-3 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400">Total Pack Mass</span>
          <div className="text-lg font-bold text-white font-mono mt-0.5 telemetry-num">
            {pack.Mass_pack} <span className="text-xs text-slate-400">kg</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{total_cells} cells</span>
        </div>
      </div>

      {/* Visual Module Rack Schematics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>PACK ARRAY TOPOLOGY ({Ns} Modules in Series &times; {Np} Parallel String)</span>
          <span>Click any module to inspect internal cell layout</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-13 gap-2 p-3 bg-charcoal-950/70 border border-charcoal-800 rounded-xl overflow-x-auto">
          {Array.from({ length: Math.min(Ns, 26) }).map((_, i) => (
            <button
              key={i}
              onClick={() => setSelectedModule(i)}
              className={`p-2 rounded-lg text-center font-mono text-xs transition-all border ${
                selectedModule === i
                  ? 'bg-neon-500/20 border-neon-500 text-neon-400 shadow-neon'
                  : 'bg-charcoal-850 border-charcoal-700/60 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="text-[10px] text-slate-500">MOD</div>
              <div className="font-bold">{i + 1}</div>
              <div className="text-[9px] text-slate-400 mt-1">{module_voltage_V}V</div>
            </button>
          ))}
          {Ns > 26 && (
            <div className="p-2 rounded-lg text-center font-mono text-xs text-slate-500 flex items-center justify-center">
              +{Ns - 26} more
            </div>
          )}
        </div>
      </div>

      {/* Selected Module Detail */}
      <div className="bg-charcoal-850/60 border border-charcoal-700/60 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal-700/40 pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-neon-400" />
            <span className="text-sm font-display font-semibold text-white">
              Inspecting Module #{selectedModule + 1} Specifications
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {S} Cells in Series &times; {P} Cells in Parallel ({cells_per_module} total cells per module)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <span className="text-slate-400">Module Voltage:</span>
            <p className="text-white font-bold text-sm mt-0.5">{module_voltage_V} V</p>
          </div>
          <div>
            <span className="text-slate-400">Module Capacity:</span>
            <p className="text-white font-bold text-sm mt-0.5">{module_capacity_Ah} Ah</p>
          </div>
          <div>
            <span className="text-slate-400">Module Energy:</span>
            <p className="text-neon-400 font-bold text-sm mt-0.5">{module_energy_Wh} Wh ({explanation.module_energy_MJ} MJ)</p>
          </div>
          <div>
            <span className="text-slate-400">Max Peak Current:</span>
            <p className="text-racing-cyan font-bold text-sm mt-0.5">{module_max_current_A} A</p>
          </div>
        </div>
      </div>

      {/* Regulatory Matrix */}
      <div>
        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2.5">
          Motorsport & FSAE Technical Compliance Checks
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {checks.map((c, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono ${
                c.pass
                  ? 'bg-neon-500/5 border-neon-500/30 text-slate-200'
                  : 'bg-racing-red/10 border-racing-red/40 text-racing-red'
              }`}
            >
              <span className="text-slate-300">{c.label}</span>
              <div className="flex items-center space-x-1.5 font-bold">
                <span>{c.value}</span>
                {c.pass ? (
                  <CheckCircle className="w-3.5 h-3.5 text-neon-400" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-racing-red" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
