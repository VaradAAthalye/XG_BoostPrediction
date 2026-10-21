// src/components/EfficiencyGauge.jsx
import React from 'react';

export default function EfficiencyGauge({ value = 0, label = "Predicted Max Efficiency", subtitle = "XGBoost Powertrain Inference", size = 220 }) {
  // Value is between 0 and 100
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  // Arc covering 260 degrees
  const arcLength = circumference * (260 / 360);
  const strokeDashoffset = arcLength - (arcLength * (clamped / 100));

  let statusColor = "text-neon-400";
  let statusBadge = "OPTIMAL";
  let badgeBg = "bg-neon-500/15 border-neon-500/30 text-neon-400";

  if (clamped < 40) {
    statusColor = "text-racing-red";
    statusBadge = "CRITICAL SAG";
    badgeBg = "bg-racing-red/15 border-racing-red/30 text-racing-red";
  } else if (clamped < 50) {
    statusColor = "text-racing-amber";
    statusBadge = "SUB-OPTIMAL";
    badgeBg = "bg-racing-amber/15 border-racing-amber/30 text-racing-amber";
  } else if (clamped >= 75) {
    statusColor = "text-racing-cyan";
    statusBadge = "RACE-WINNING";
    badgeBg = "bg-racing-cyan/15 border-racing-cyan/30 text-racing-cyan";
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Glow backdrop */}
        <div className="absolute inset-0 rounded-full bg-neon-500/5 blur-2xl pointer-events-none"></div>

        <svg width={size} height={size} className="transform -rotate-[130deg]">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#161E2E"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#neonGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F0FF" />
              <stop offset="60%" stopColor="#00FF66" />
              <stop offset="100%" stopColor="#39FF14" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Display */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight telemetry-num drop-shadow-md">
            {clamped.toFixed(2)}%
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border mt-1 font-semibold ${badgeBg}`}>
            {statusBadge}
          </span>
        </div>
      </div>

      <div className="text-center mt-2">
        <h4 className="text-sm font-semibold text-slate-200 tracking-wide">{label}</h4>
        <p className="text-xs text-slate-400 font-mono mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
