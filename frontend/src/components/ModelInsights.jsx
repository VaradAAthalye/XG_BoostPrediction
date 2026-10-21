// src/components/ModelInsights.jsx
import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  BarChart, 
  GitBranch, 
  Layers, 
  HelpCircle, 
  Info, 
  Award,
  CheckCircle2,
  Terminal
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart as RBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Cell 
} from 'recharts';
import { fetchModelInsights } from '../services/api';

export default function ModelInsights() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubmodel, setSelectedSubmodel] = useState('powertrain');

  useEffect(() => {
    fetchModelInsights()
      .then(res => {
        setInsights(res);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load model insights", err);
        setLoading(false);
      });
  }, []);

  if (loading || !insights) {
    return (
      <div className="racing-card p-8 text-center text-slate-400 font-mono text-sm">
        <div className="inline-block h-6 w-6 border-2 border-neon-400 border-t-transparent rounded-full animate-spin mb-2"></div>
        <p>Extracting trained XGBoost booster tree split metrics and feature gains...</p>
      </div>
    );
  }

  const pFeatures = insights.feature_importances || [];
  const top10Features = pFeatures.slice(0, 10);
  const batterySubmodels = insights.battery_pack_submodels || {};

  return (
    <div className="space-y-6">
      {/* Top Architecture Banner */}
      <div className="racing-card p-6 relative overflow-hidden bg-racing-gradient">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-neon-400" />
              <h2 className="text-xl font-display font-bold text-white">
                XGBoost Model Architecture & Interpretability
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Booster tree statistics, gain rankings, and physical feature engineering rationales
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-md bg-neon-500/10 border border-neon-500/30 text-neon-400 font-semibold">
              XGBRegressor &bull; 300 Trees
            </span>
            <span className="px-2.5 py-1 rounded-md bg-charcoal-800 border border-charcoal-700 text-slate-300">
              Max Depth: {insights.max_depth}
            </span>
          </div>
        </div>

        {/* Hyperparameters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-charcoal-700/60 text-xs font-mono">
          <div className="bg-charcoal-900/80 p-3 rounded-lg border border-charcoal-700/60">
            <span className="text-slate-400 text-[10px]">Objective Loss</span>
            <p className="text-white font-bold mt-0.5">{insights.objective}</p>
          </div>
          <div className="bg-charcoal-900/80 p-3 rounded-lg border border-charcoal-700/60">
            <span className="text-slate-400 text-[10px]">Number of Estimators</span>
            <p className="text-neon-400 font-bold mt-0.5">{insights.n_estimators} Trees</p>
          </div>
          <div className="bg-charcoal-900/80 p-3 rounded-lg border border-charcoal-700/60">
            <span className="text-slate-400 text-[10px]">Column Sample Ratio</span>
            <p className="text-white font-bold mt-0.5">{insights.colsample_bytree} (80% / tree)</p>
          </div>
          <div className="bg-charcoal-900/80 p-3 rounded-lg border border-charcoal-700/60">
            <span className="text-slate-400 text-[10px]">Learning Rate (&eta;)</span>
            <p className="text-racing-cyan font-bold mt-0.5">{insights.learning_rate}</p>
          </div>
        </div>
      </div>

      {/* Feature Importance Chart */}
      <div className="racing-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal-700/80 pb-3">
          <div>
            <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
              <Award className="w-4 h-4 text-neon-400" />
              <span>Top 10 Feature Importances (Powertrain Model)</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Normalized Gain contributions across all decision trees in the ensemble
            </p>
          </div>
          <span className="text-xs font-mono text-neon-400">
            battery_multiplier dominates at 57.1%
          </span>
        </div>

        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RBarChart
              data={top10Features}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 70, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
              <XAxis 
                type="number" 
                stroke="#64748B" 
                fontSize={11} 
                unit="%" 
                domain={[0, 65]} 
              />
              <YAxis 
                dataKey="feature" 
                type="category" 
                stroke="#64748B" 
                fontSize={11} 
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0B0F17', 
                  borderColor: '#334155', 
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }} 
              />
              <Bar dataKey="importance_percent" fill="#00FF66" radius={[0, 4, 4, 0]}>
                {top10Features.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? '#00FF66' : index === 1 ? '#00F0FF' : '#38BDF8'} 
                  />
                ))}
              </Bar>
            </RBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Breakdown & Physical Interpretability Table */}
      <div className="racing-card p-5 space-y-4">
        <div className="border-b border-charcoal-700/80 pb-3">
          <h3 className="font-display font-bold text-base text-white">
            Comprehensive 24-Feature Interpretability Guide
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            How each physical and engineered input drives the XGBoost powertrain efficiency prediction
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-charcoal-700 text-slate-400 text-[11px]">
                <th className="py-2 px-3">Rank</th>
                <th className="py-2 px-3">Feature Name</th>
                <th className="py-2 px-3">Importance</th>
                <th className="py-2 px-3">Physical Meaning & Engineering Influence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800 text-slate-200">
              {pFeatures.map((f, i) => (
                <tr key={f.feature} className="hover:bg-charcoal-850/50 transition-colors">
                  <td className="py-2 px-3 text-slate-500">#{i + 1}</td>
                  <td className="py-2 px-3 font-bold text-white">
                    <span className="text-neon-400 font-semibold">{f.feature}</span>
                  </td>
                  <td className="py-2 px-3 text-racing-cyan font-bold">
                    {f.importance_percent}%
                  </td>
                  <td className="py-2 px-3 text-slate-300">
                    {f.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Battery Pack Submodels Feature Importance */}
      {Object.keys(batterySubmodels).length > 0 && (
        <div className="racing-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal-700/80 pb-3">
            <div>
              <h3 className="font-display font-bold text-base text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-racing-cyan" />
                <span>Battery Pack Multi-Target Regressors</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Explore feature importance for each of the 7 battery pack sizing models
              </p>
            </div>

            <div className="flex flex-wrap gap-1">
              {Object.keys(batterySubmodels).map(target => (
                <button
                  key={target}
                  onClick={() => setSelectedSubmodel(target)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${
                    selectedSubmodel === target
                      ? 'bg-racing-cyan/20 border border-racing-cyan text-racing-cyan font-bold'
                      : 'bg-charcoal-850 text-slate-400 hover:text-white'
                  }`}
                >
                  {target}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
            {(batterySubmodels[selectedSubmodel] || []).map((bf, i) => (
              <div key={bf.feature} className="p-3 bg-charcoal-900 border border-charcoal-800 rounded-lg flex items-center justify-between">
                <span className="text-slate-300">{bf.feature}</span>
                <span className="text-neon-400 font-bold">{bf.importance_percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scientific Interpretability Notice */}
      <div className="p-4 rounded-xl bg-charcoal-900 border border-charcoal-700/80 text-xs font-mono text-slate-400 space-y-1.5">
        <div className="flex items-center space-x-2 text-slate-300 font-bold">
          <Info className="w-4 h-4 text-neon-400" />
          <span>Scientific Disclaimer: Correlation vs. Causality</span>
        </div>
        <p>
          Tree-based feature importance reflects how frequently and effectively an input was chosen by XGBoost to split nodes across the training dataset. While high importance indicates a strong predictive signal (e.g. <code>battery_multiplier</code>), it does not imply sole direct causation in complex physical non-linear powertrains where aerodynamics, motor torque saturation, and cell thermal limits interact.
        </p>
      </div>
    </div>
  );
}
