// src/components/Dashboard.jsx
import React from 'react';
import { 
  Zap, 
  Activity, 
  Gauge, 
  ShieldCheck, 
  TrendingUp, 
  BatteryCharging, 
  Flame, 
  ArrowRight,
  Compass,
  Layers
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import EfficiencyGauge from './EfficiencyGauge';

export default function Dashboard({ 
  prediction, 
  status, 
  setActiveTab, 
  applyPreset, 
  presets = [] 
}) {
  const isOnline = status?.status === 'ONLINE';
  const pack = prediction?.pack;
  const exp = prediction?.explanation;
  const diag = prediction?.diagnostics;
  const velocityCurve = prediction?.velocity_curve || [];

  return (
    <div className="space-y-6">
      {/* Hero Telemetry Card */}
      <div className="racing-card p-6 sm:p-8 relative overflow-hidden bg-racing-gradient">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-neon-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 rounded-full bg-racing-cyan/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-neon-500/15 border border-neon-500/30 text-neon-400 text-xs font-mono font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-400 animate-ping"></span>
              <span>RACE TELEMETRY &bull; FORMULA STUDENT / FORMULA E</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white tracking-tight leading-tight">
              Battery Intelligence <span className="text-neon-400">&mdash; Motorsport Edition</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed">
              Physics-constrained battery pack architecting coupled with trained <span className="text-neon-400 font-mono font-semibold">XGBoost</span> gradient-boosted regression. Predicts peak vehicle efficiency, modular cell groupings, and dynamic torque telemetry across racing launch, cornering, and top-speed velocity profiles.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActiveTab('studio')}
                className="px-5 py-2.5 rounded-xl bg-neon-500 hover:bg-neon-400 text-charcoal-950 font-bold text-sm tracking-wide transition-all shadow-neon hover:shadow-neon-lg flex items-center space-x-2"
              >
                <span>Launch Prediction Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className="px-4 py-2.5 rounded-xl bg-charcoal-800/80 hover:bg-charcoal-700/80 text-white font-medium text-sm transition-all border border-charcoal-700"
              >
                View Benchmark Analytics
              </button>
            </div>
          </div>

          {/* Efficiency Gauge Card */}
          <div className="racing-card bg-charcoal-900/90 border border-charcoal-700/80 p-4 rounded-2xl flex flex-col items-center justify-center self-center lg:self-auto min-w-[280px]">
            <EfficiencyGauge
              value={prediction?.predicted_efficiency_percent || 55.34}
              label="Powertrain Max Efficiency"
              subtitle="XGBoost Regressor Inference"
              size={210}
            />
          </div>
        </div>
      </div>

      {/* Primary Telemetry Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="racing-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>BATTERY EFFICIENCY</span>
            <BatteryCharging className="w-4 h-4 text-neon-400" />
          </div>
          <div className="text-2xl font-display font-extrabold text-white telemetry-num">
            {pack ? (pack.Battery_eff * 100).toFixed(2) : '90.73'}
            <span className="text-xs text-neon-400 ml-1">%</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            V_load / V_pack: {pack ? pack.V_load : 339.68}V / {pack ? pack.V_pack : 374.4}V
          </p>
        </div>

        <div className="racing-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>PACK VOLTAGE SAG</span>
            <TrendingUp className="w-4 h-4 text-racing-cyan" />
          </div>
          <div className="text-2xl font-display font-extrabold text-racing-cyan telemetry-num">
            {exp ? exp.voltage_drop_V : '34.72'}
            <span className="text-xs text-slate-400 ml-1">V Drop</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {diag ? `${diag.voltage_sag_percent}% sag under peak` : '9.27% sag at 75 kW peak'}
          </p>
        </div>

        <div className="racing-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>PACK MASS / WEIGHT</span>
            <Layers className="w-4 h-4 text-racing-amber" />
          </div>
          <div className="text-2xl font-display font-extrabold text-white telemetry-num">
            {pack ? pack.Mass_pack : '59.90'}
            <span className="text-xs text-slate-400 ml-1">kg</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {pack ? `${pack.Cells_total} cells &bull; ${(pack.Energy_Wh / 1000).toFixed(1)} kWh` : '1248 cells &bull; 13.5 kWh'}
          </p>
        </div>

        <div className="racing-card p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>PEAK POWER / CURRENT</span>
            <Flame className="w-4 h-4 text-racing-red" />
          </div>
          <div className="text-2xl font-display font-extrabold text-white telemetry-num">
            {diag ? diag.i_pack_peak_A : '200.3'}
            <span className="text-xs text-slate-400 ml-1">A Peak</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {diag ? `${diag.i_cell_peak_A}A/cell (${diag.i_cell_utilization_percent}% limit)` : '16.69A/cell (66.8% limit)'}
          </p>
        </div>
      </div>

      {/* Dynamic Telemetry Charts & Velocity Envelope */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Torque & Power Velocity Curve Chart */}
        <div className="racing-card p-5 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal-700/80 pb-3">
            <div>
              <h3 className="font-display font-bold text-lg text-white flex items-center space-x-2">
                <Compass className="w-4 h-4 text-neon-400" />
                <span>Dynamic Powertrain Envelope (0 &ndash; 160 km/h)</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Physical torque demand and shaft power across racing vehicle velocities
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs font-mono">
              <span className="flex items-center space-x-1 text-neon-400">
                <span className="w-2.5 h-0.5 bg-neon-400 inline-block"></span>
                <span>Power (kW)</span>
              </span>
              <span className="flex items-center space-x-1 text-racing-cyan">
                <span className="w-2.5 h-0.5 bg-racing-cyan inline-block"></span>
                <span>Wheel Torque (Nm)</span>
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityCurve}>
                <defs>
                  <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF66" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#00FF66" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="torqueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00F0FF" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis 
                  dataKey="speed_kmh" 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  unit=" km/h"
                />
                <YAxis 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0B0F17', 
                    borderColor: '#334155', 
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="power_kW" 
                  stroke="#00FF66" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#powerGrad)" 
                  name="Required Power (kW)"
                />
                <Area 
                  type="monotone" 
                  dataKey="wheel_torque_Nm" 
                  stroke="#00F0FF" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#torqueGrad)" 
                  name="Wheel Torque (Nm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Speed Point Telemetry (0, 5, 20 m/s) */}
        <div className="racing-card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="border-b border-charcoal-700/80 pb-3 mb-3">
              <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-racing-cyan" />
                <span>Benchmark Speed Points</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Key conditions fed to XGBoost model
              </p>
            </div>

            <div className="space-y-3">
              {(prediction?.speed_telemetry || [
                { speed_ms: 0, speed_kmh: 0, condition: "Launch / Standstill", wheel_torque_Nm: 236.4, motor_torque_Nm: 52.5, motor_rpm: 0, power_req_kW: 0 },
                { speed_ms: 5, speed_kmh: 18, condition: "Corner Exit (5 m/s)", wheel_torque_Nm: 238.1, motor_torque_Nm: 52.9, motor_rpm: 889, power_req_kW: 4.9 },
                { speed_ms: 20, speed_kmh: 72, condition: "High Speed Straight (20 m/s)", wheel_torque_Nm: 86.4, motor_torque_Nm: 19.2, motor_rpm: 3557, power_req_kW: 7.2 }
              ]).map((st, i) => (
                <div key={i} className="bg-charcoal-900/90 border border-charcoal-700/60 p-3 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{st.condition}</span>
                    <span className="font-mono text-neon-400 font-semibold">{st.speed_kmh} km/h ({st.speed_ms} m/s)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[11px] font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500">T_motor:</span> {st.motor_torque_Nm} Nm
                    </div>
                    <div>
                      <span className="text-slate-500">RPM:</span> {st.motor_rpm}
                    </div>
                    <div>
                      <span className="text-slate-500">Power:</span> {st.power_req_kW} kW
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Status Card */}
          <div className="bg-charcoal-900 border border-charcoal-700/80 p-3.5 rounded-xl space-y-1.5 mt-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Model Engine:</span>
              <span className="text-neon-400 font-semibold">XGBRegressor</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Tree Depth / Rounds:</span>
              <span className="text-white">Max Depth 6 &bull; 300 Trees</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Trained Features:</span>
              <span className="text-white">24 Engineered Inputs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Presets Quick Selector */}
      <div className="racing-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-neon-400" />
            <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider">
              Motorsport Benchmark Configurations
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            Load verified vehicle architectures into prediction pipeline
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {presets.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                applyPreset(p.data);
                setActiveTab('studio');
              }}
              className="p-3.5 rounded-xl bg-charcoal-900/80 hover:bg-charcoal-800 border border-charcoal-700/70 hover:border-neon-500/50 cursor-pointer transition-all group space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white group-hover:text-neon-400 transition-colors">
                  {p.name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-neon-400 transform group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
