// src/App.jsx
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import PredictionStudio from './components/PredictionStudio';
import BatteryAnalytics from './components/BatteryAnalytics';
import ModelInsights from './components/ModelInsights';
import DataExplorer from './components/DataExplorer';
import { fetchStatus, fetchPresets, runPrediction } from './services/api';

const DEFAULT_INPUTS = {
  motor_peak: 230.0,
  motor_cont: 120.0,
  motor_max_rpm: 6000.0,
  gear_ratio: 4.5,
  tire_r_in: 9.5,
  vehicle_mass: 240.0,
  Cd: 0.85,
  A: 1.15,
  Cr: 0.015,
  V_cell: 3.6,
  Ah_cell: 3.0,
  m_cell: 0.048,
  R_cell: 0.020,
  I_cell_max: 25.0,
  V_pack_target: 400.0,
  P_peak_required: 75000.0,
  model_choice: 'primary'
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState(null);
  const [selectedModel, setSelectedModel] = useState('primary');
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [prediction, setPrediction] = useState(null);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1. Fetch system & model status
    fetchStatus()
      .then(res => setStatus(res))
      .catch(err => console.error("Could not fetch API status", err));

    // 2. Fetch presets
    fetchPresets()
      .then(res => setPresets(res))
      .catch(err => console.error("Could not fetch presets", err));

    // 3. Run default baseline prediction
    executePrediction(DEFAULT_INPUTS);
  }, []);

  const executePrediction = async (customInputs) => {
    setLoading(true);
    setError(null);
    try {
      const numericKeys = [
        'motor_peak', 'motor_cont', 'motor_max_rpm', 'gear_ratio',
        'tire_r_in', 'vehicle_mass', 'Cd', 'A', 'Cr',
        'V_cell', 'Ah_cell', 'm_cell', 'R_cell', 'I_cell_max',
        'V_pack_target', 'P_peak_required'
      ];
      const sanitized = { ...customInputs };
      for (const k of numericKeys) {
        const val = parseFloat(sanitized[k]);
        if (isNaN(val) || val <= 0) {
          throw new Error(`Parameter '${k}' must be a valid positive number.`);
        }
        sanitized[k] = val;
      }
      if (sanitized.motor_cont > sanitized.motor_peak) {
        throw new Error(
          `Motor continuous torque (${sanitized.motor_cont} Nm) cannot exceed peak torque (${sanitized.motor_peak} Nm).`
        );
      }
      const payload = { ...sanitized, model_choice: selectedModel };
      const res = await runPrediction(payload);
      if (res.feasible) {
        setPrediction(res);
        setError(null);
      } else {
        setError(res.error || "No feasible battery configuration found within constraints.");
      }
      setLoading(false);
    } catch (err) {
      setError(err.message || "Failed to communicate with prediction backend.");
      setLoading(false);
    }
  };

  const applyPreset = (presetData) => {
    const newInputs = { ...inputs, ...presetData };
    setInputs(newInputs);
    executePrediction(newInputs);
  };

  return (
    <div className="min-h-screen bg-charcoal-950 text-slate-100 flex flex-col font-sans bg-racing-grid">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        selectedModel={selectedModel}
        setSelectedModel={(m) => {
          setSelectedModel(m);
          executePrediction({ ...inputs, model_choice: m });
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            prediction={prediction}
            status={status}
            setActiveTab={setActiveTab}
            applyPreset={applyPreset}
            presets={presets}
          />
        )}

        {activeTab === 'studio' && (
          <PredictionStudio
            inputs={inputs}
            setInputs={setInputs}
            onPredict={executePrediction}
            prediction={prediction}
            loading={loading}
            error={error}
            presets={presets}
            applyPreset={applyPreset}
            selectedModel={selectedModel}
          />
        )}

        {activeTab === 'analytics' && (
          <BatteryAnalytics />
        )}

        {activeTab === 'insights' && (
          <ModelInsights />
        )}

        {activeTab === 'explorer' && (
          <DataExplorer />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-charcoal-800 bg-charcoal-950/90 py-6 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-neon-400">⚡</span>
            <span className="text-slate-300 font-semibold">Battery Intelligence &bull; Motorsport Edition</span>
            <span>&mdash; FSAE & Formula E XGBoost Telemetry</span>
          </div>

          <div className="flex items-center space-x-4">
            <span>Powered by XGBoost & Scikit-Learn</span>
            <a
              href="https://github.com/VaradAAthalye/XG_BoostPrediction"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-400 hover:underline"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
