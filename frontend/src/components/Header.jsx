// src/components/Header.jsx
import React from 'react';
import { Activity, Cpu, Gauge, BarChart3, Database, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, status, selectedModel, setSelectedModel }) {
  const isOnline = status && status.status === 'ONLINE';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Gauge },
    { id: 'studio', label: 'Prediction Studio', icon: Activity },
    { id: 'analytics', label: 'Battery Analytics', icon: BarChart3 },
    { id: 'insights', label: 'Model Insights', icon: Cpu },
    { id: 'explorer', label: 'Data Explorer', icon: Database },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-charcoal-700/60 bg-charcoal-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="h-10 w-10 rounded-xl bg-charcoal-850 border border-neon-500/40 flex items-center justify-center shadow-neon">
              <span className="text-xl">⚡</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-display font-bold text-lg tracking-wider text-white">
                  BATTERY INTELLIGENCE
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold bg-neon-500/15 text-neon-400 border border-neon-500/30">
                  MOTORSPORT
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">
                Formula E & FSAE Powertrain XGBoost Studio
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-charcoal-800 text-neon-400 border border-neon-500/40 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-charcoal-850/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-neon-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Model Status & Selector */}
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center space-x-2 text-xs font-mono bg-charcoal-900 border border-charcoal-700/80 px-2.5 py-1.5 rounded-lg">
              <span className="text-slate-400">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
              >
                <option value="primary" className="bg-charcoal-900 text-white">Primary (300 Trees)</option>
                <option value="deep" className="bg-charcoal-900 text-white">Deep (600 Trees)</option>
              </select>
            </div>

            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono ${
              isOnline
                ? 'bg-charcoal-900/90 border-neon-500/40 text-neon-400'
                : 'bg-charcoal-900/90 border-racing-red/40 text-racing-red'
            }`}>
              <span className="relative flex h-2 w-2">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-neon-500' : 'bg-racing-red'}`}></span>
              </span>
              <span className="hidden sm:inline font-semibold">
                {isOnline ? 'XGBOOST TELEMETRY ONLINE' : 'DISCONNECTED'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Nav Tabs */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-charcoal-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-charcoal-800 text-neon-400 border border-neon-500/40'
                    : 'text-slate-300 hover:bg-charcoal-850'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
