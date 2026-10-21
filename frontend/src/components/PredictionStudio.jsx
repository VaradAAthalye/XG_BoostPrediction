// src/components/PredictionStudio.jsx
import React, { useState } from 'react';
import { 
  Zap, 
  Play, 
  RotateCcw, 
  HelpCircle, 
  AlertCircle, 
  Cpu, 
  Check, 
  Layers, 
  Sliders, 
  Info,
  TrendingDown,
  Scale,
  Gauge
} from 'lucide-react';
import EfficiencyGauge from './EfficiencyGauge';
import PackVisualizer from './PackVisualizer';

export default function PredictionStudio({
  inputs,
  setInputs,
  onPredict,
  prediction,
  loading,
  error,
  presets = [],
  applyPreset,
  selectedModel
}) {
  const [activeTooltip, setActiveTooltip] = useState(null);

  const handleChange = (key, value) => {
    setInputs(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const tooltips = {
    motor_peak: "Peak mechanical torque deliverable by the electric motor (Nm). Impacts launch force and peak acceleration.",
    motor_cont: "Continuous thermally-rated motor torque (Nm). Determines sustainable high-speed cruising and thermal headroom.",
    motor_max_rpm: "Maximum rotational limit of the motor shaft. Limits top vehicle speed under the chosen gear ratio.",
    gear_ratio: "Transmission gear reduction between motor and wheel. Higher ratio multiplies torque but limits top speed.",
    tire_r_in: "Tire outer radius in inches. Automatically converted to meters (r * 0.0254) in the physics pipeline.",
    vehicle_mass: "Total racecar mass including driver, battery pack, chassis, and aero wings (kg).",
    Cd: "Aerodynamic drag coefficient. Lower values reduce air resistance drag at high speeds.",
    A: "Frontal cross-sectional area (m²). Multiplied with Cd to determine aerodynamic resistance force.",
    Cr: "Tire rolling resistance coefficient on track tarmac (typically 0.012 to 0.020).",
    V_cell: "Nominal cell voltage (e.g. 3.6V for standard Li-ion NCA/NMC cells).",
    Ah_cell: "Individual cell capacity in Ampere-hours (Ah).",
    m_cell: "Single cell mass in kilograms (e.g. 0.048 kg for 18650, 0.068 kg for 21700).",
    R_cell: "Internal DC resistance of cell in Ohms. Primary cause of voltage sag and thermal dissipation (I²R).",
    I_cell_max: "Continuous/peak discharge rating per cell (A). Limits the maximum current drawable per parallel string.",
    V_pack_target: "Target total battery pack voltage (V). Sizing algorithm searches configurations within ±10% window.",
    P_peak_required: "Peak electrical power demanded by powertrain in Watts. Formula Student Electric limits to 80,000 W (80 kW)."
  };

  const pack = prediction?.pack;
  const exp = prediction?.explanation;
  const diag = prediction?.diagnostics;
  const mlPack = prediction?.ml_surrogate_pack;

  return (
    <div className="space-y-6">
      {/* Top Bar with Presets & Action */}
      <div className="racing-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-neon-400" />
            <h2 className="text-xl font-display font-bold text-white">
              Prediction Studio & Sizing Workbench
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Parametric inputs fed directly to the trained XGBoost model and modular physics engine
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">Presets:</span>
          {presets.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.data)}
              className="px-2.5 py-1.5 rounded-lg bg-charcoal-850 hover:bg-charcoal-800 border border-charcoal-700 hover:border-neon-500/40 text-xs font-mono text-slate-300 hover:text-white transition-all"
            >
              {p.name.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Form & Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Parameters Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Section 1: Powertrain & Chassis Inputs */}
          <div className="racing-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-charcoal-700/80 pb-2.5">
              <h3 className="text-sm font-display font-bold text-white flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-neon-400"></span>
                <span>1. Powertrain & Chassis Parameters</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">9 Actual Model Features</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Motor Peak Torque</span>
                  <span className="text-neon-400 font-semibold">Nm</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="5"
                    value={inputs.motor_peak}
                    onChange={(e) => handleChange('motor_peak', e.target.value)}
                    className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                  />
                  <button 
                    onClick={() => setActiveTooltip(activeTooltip === 'motor_peak' ? null : 'motor_peak')}
                    className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-300"
                    title={tooltips.motor_peak}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                {activeTooltip === 'motor_peak' && (
                  <p className="text-[10px] text-neon-400 mt-1 font-mono">{tooltips.motor_peak}</p>
                )}
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Motor Cont. Torque</span>
                  <span className="text-neon-400 font-semibold">Nm</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="5"
                    value={inputs.motor_cont}
                    onChange={(e) => handleChange('motor_cont', e.target.value)}
                    className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Motor Max RPM</span>
                  <span className="text-neon-400 font-semibold">RPM</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="200"
                    value={inputs.motor_max_rpm}
                    onChange={(e) => handleChange('motor_max_rpm', e.target.value)}
                    className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Gear Ratio</span>
                  <span className="text-slate-500">ratio</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={inputs.gear_ratio}
                  onChange={(e) => handleChange('gear_ratio', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Tire Radius</span>
                  <span className="text-neon-400 font-semibold">inches</span>
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={inputs.tire_r_in}
                  onChange={(e) => handleChange('tire_r_in', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono">
                  = {(inputs.tire_r_in * 0.0254).toFixed(3)} m
                </span>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Vehicle Mass</span>
                  <span className="text-neon-400 font-semibold">kg</span>
                </label>
                <input
                  type="number"
                  step="5"
                  value={inputs.vehicle_mass}
                  onChange={(e) => handleChange('vehicle_mass', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Drag Coeff. (Cd)</span>
                  <span className="text-slate-500">Cd</span>
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={inputs.Cd}
                  onChange={(e) => handleChange('Cd', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Frontal Area (A)</span>
                  <span className="text-neon-400 font-semibold">m²</span>
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={inputs.A}
                  onChange={(e) => handleChange('A', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Rolling Resist. (Cr)</span>
                  <span className="text-slate-500">Cr</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={inputs.Cr}
                  onChange={(e) => handleChange('Cr', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Battery Cell Specification */}
          <div className="racing-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-charcoal-700/80 pb-2.5">
              <h3 className="text-sm font-display font-bold text-white flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-racing-cyan"></span>
                <span>2. Battery Cell Chemistry Specifications</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">5 Cell Features</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Cell Voltage (V_cell)</span>
                  <span className="text-racing-cyan font-semibold">V</span>
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={inputs.V_cell}
                  onChange={(e) => handleChange('V_cell', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-racing-cyan rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Cell Capacity (Ah)</span>
                  <span className="text-racing-cyan font-semibold">Ah</span>
                </label>
                <input
                  type="number"
                  step="0.2"
                  value={inputs.Ah_cell}
                  onChange={(e) => handleChange('Ah_cell', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-racing-cyan rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Cell Mass (m_cell)</span>
                  <span className="text-racing-cyan font-semibold">kg</span>
                </label>
                <input
                  type="number"
                  step="0.002"
                  value={inputs.m_cell}
                  onChange={(e) => handleChange('m_cell', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-racing-cyan rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Cell Resistance (R_cell)</span>
                  <span className="text-racing-amber font-semibold">&Omega;</span>
                </label>
                <input
                  type="number"
                  step="0.002"
                  value={inputs.R_cell}
                  onChange={(e) => handleChange('R_cell', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-racing-amber rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono">
                  = {(inputs.R_cell * 1000).toFixed(1)} m&Omega;
                </span>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Max Discharge (I_cell_max)</span>
                  <span className="text-racing-red font-semibold">A</span>
                </label>
                <input
                  type="number"
                  step="2"
                  value={inputs.I_cell_max}
                  onChange={(e) => handleChange('I_cell_max', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-racing-red rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Pack Targets & Peak Power */}
          <div className="racing-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-charcoal-700/80 pb-2.5">
              <h3 className="text-sm font-display font-bold text-white flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-racing-amber"></span>
                <span>3. Pack Architecture Target & Peak Power Demand</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500">2 Optimization Targets</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Target Pack Voltage (V_pack_target)</span>
                  <span className="text-neon-400 font-semibold">V</span>
                </label>
                <input
                  type="number"
                  step="10"
                  value={inputs.V_pack_target}
                  onChange={(e) => handleChange('V_pack_target', e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-700 focus:border-neon-500 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono">
                  Search window: {(inputs.V_pack_target * 0.9).toFixed(0)}V &ndash; {(inputs.V_pack_target * 1.1).toFixed(0)}V
                </span>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Peak Power Demand (P_peak_required)</span>
                  <span className="text-racing-red font-semibold">W</span>
                </label>
                <input
                  type="number"
                  step="2500"
                  value={inputs.P_peak_required}
                  onChange={(e) => handleChange('P_peak_required', e.target.value)}
                  className={`w-full bg-charcoal-900 border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none transition-colors ${
                    inputs.P_peak_required > 80000 
                      ? 'border-racing-amber focus:border-racing-red text-racing-amber' 
                      : 'border-charcoal-700 focus:border-neon-500'
                  }`}
                />
                <div className="flex items-center justify-between text-[10px] font-mono mt-1">
                  <span className="text-slate-400">{(inputs.P_peak_required / 1000).toFixed(1)} kW</span>
                  {inputs.P_peak_required > 80000 && (
                    <span className="text-racing-amber flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Exceeds standard 80kW FSAE limit</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => onPredict(inputs)}
              disabled={loading}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-display font-bold text-sm tracking-wide transition-all shadow-neon flex items-center justify-center space-x-2 ${
                loading
                  ? 'bg-charcoal-800 text-slate-400 border border-charcoal-700 cursor-not-allowed'
                  : 'bg-neon-500 hover:bg-neon-400 text-charcoal-950 hover:shadow-neon-lg'
              }`}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-slate-400 border-t-neon-400 rounded-full animate-spin"></div>
                  <span>Running XGBoost Telemetry Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Execute Physics Sizing & XGBoost Prediction</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-racing-red/10 border border-racing-red/40 text-racing-red text-xs font-mono space-y-1">
              <div className="flex items-center space-x-2 font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Simulation Constraint Violation</span>
              </div>
              <p>{typeof error === 'object' ? JSON.stringify(error) : String(error)}</p>
            </div>
          )}
        </div>

        {/* Prediction Results Column (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Main Prediction Score Card */}
          <div className="racing-card p-6 flex flex-col items-center justify-center relative overflow-hidden bg-racing-gradient">
            <div className="absolute top-2 right-3 text-[10px] font-mono text-slate-500">
              Model: {prediction?.model_used || 'primary (300 trees)'}
            </div>

            <EfficiencyGauge
              value={prediction?.predicted_efficiency_percent || 0}
              label="Predicted Max Powertrain Efficiency"
              subtitle="End-to-End Vehicle Energy Conversion"
              size={230}
            />

            {/* Quick Diagnostic Pills */}
            {pack && (
              <div className="grid grid-cols-2 gap-2 w-full mt-4 pt-4 border-t border-charcoal-700/60 text-xs font-mono">
                <div className="bg-charcoal-900/80 p-2.5 rounded-lg border border-charcoal-700/60">
                  <span className="text-slate-400 text-[10px]">Battery Efficiency (η)</span>
                  <div className="text-neon-400 font-bold text-base mt-0.5">
                    {(pack.Battery_eff * 100).toFixed(2)}%
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Degradation: {((1 - pack.Battery_eff) * 100).toFixed(2)}%
                  </span>
                </div>

                <div className="bg-charcoal-900/80 p-2.5 rounded-lg border border-charcoal-700/60">
                  <span className="text-slate-400 text-[10px]">Thermal Heat Loss</span>
                  <div className="text-racing-amber font-bold text-base mt-0.5">
                    {diag?.thermal_loss_at_peak_kW || 0} kW
                  </div>
                  <span className="text-[10px] text-slate-500">
                    I²R pack internal dissipation
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Surrogate ML Model vs Physics Model Comparison */}
          {mlPack && (
            <div className="racing-card p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-charcoal-700/60 pb-2">
                <h4 className="text-xs font-display font-bold text-white flex items-center space-x-1.5">
                  <Cpu className="w-4 h-4 text-racing-cyan" />
                  <span>XGBoost Multi-Model Battery Surrogate vs Physics Sizing</span>
                </h4>
                <span className="text-[10px] font-mono text-slate-400">7 Submodels</span>
              </div>

              <div className="text-xs font-mono overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-charcoal-800 text-[11px]">
                      <th className="py-1">Metric</th>
                      <th className="py-1 text-neon-400">Physics Sized</th>
                      <th className="py-1 text-racing-cyan">ML Surrogate</th>
                      <th className="py-1 text-slate-400">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal-800 text-slate-200">
                    <tr>
                      <td className="py-1 text-slate-400">Series Cells / Mod (S)</td>
                      <td className="py-1 font-bold text-white">{pack?.S_mod}</td>
                      <td className="py-1 text-racing-cyan">{mlPack.S_mod_pred}</td>
                      <td className="py-1 text-[11px] text-slate-400">{Math.abs((pack?.S_mod || 0) - mlPack.S_mod_pred).toFixed(1)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-400">Parallel Cells / Mod (P)</td>
                      <td className="py-1 font-bold text-white">{pack?.P_mod}</td>
                      <td className="py-1 text-racing-cyan">{mlPack.P_mod_pred}</td>
                      <td className="py-1 text-[11px] text-slate-400">{Math.abs((pack?.P_mod || 0) - mlPack.P_mod_pred).toFixed(1)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-400">Pack Voltage (V)</td>
                      <td className="py-1 font-bold text-white">{pack?.V_pack} V</td>
                      <td className="py-1 text-racing-cyan">{mlPack.V_pack_pred} V</td>
                      <td className="py-1 text-[11px] text-slate-400">{Math.abs((pack?.V_pack || 0) - mlPack.V_pack_pred).toFixed(1)} V</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-400">Pack Mass (kg)</td>
                      <td className="py-1 font-bold text-white">{pack?.Mass_pack} kg</td>
                      <td className="py-1 text-racing-cyan">{mlPack.mass_pack_pred} kg</td>
                      <td className="py-1 text-[11px] text-slate-400">{Math.abs((pack?.Mass_pack || 0) - mlPack.mass_pack_pred).toFixed(1)} kg</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-400">Battery Efficiency</td>
                      <td className="py-1 font-bold text-neon-400">{((pack?.Battery_eff || 0) * 100).toFixed(2)}%</td>
                      <td className="py-1 text-racing-cyan">{(mlPack.battery_eff_pred * 100).toFixed(2)}%</td>
                      <td className="py-1 text-[11px] text-slate-400">{Math.abs(((pack?.Battery_eff || 0) - mlPack.battery_eff_pred) * 100).toFixed(2)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Derived Speed Points */}
          <div className="racing-card p-5 space-y-3">
            <h4 className="text-xs font-display font-bold text-white flex items-center space-x-1.5 border-b border-charcoal-700/60 pb-2">
              <Gauge className="w-4 h-4 text-neon-400" />
              <span>Speed-Dependent Telemetry Features</span>
            </h4>

            <div className="space-y-2 text-xs font-mono">
              {(prediction?.speed_telemetry || []).map((st, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-charcoal-900 border border-charcoal-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white">{st.condition}</span>
                    <div className="text-[10px] text-slate-500">
                      T_wheel: {st.wheel_torque_Nm} Nm &bull; T_motor: {st.motor_torque_Nm} Nm
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-neon-400 font-bold">{st.power_req_kW} kW</span>
                    <div className="text-[10px] text-slate-400">{st.motor_rpm} RPM</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modular Battery Architecture Visualizer Full Width */}
      {pack && exp && (
        <PackVisualizer
          pack={pack}
          explanation={exp}
          diagnostics={diag}
        />
      )}
    </div>
  );
}
