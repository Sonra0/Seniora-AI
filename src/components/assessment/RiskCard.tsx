"use client";

import { motion } from "framer-motion";

interface RiskCardProps {
  title: string;
  riskPercent: number;
  trend?: "up" | "down" | "stable";
  note?: string;
}

export function RiskCard({ title, riskPercent, trend, note }: RiskCardProps) {
  const isHighRisk = riskPercent >= 70;
  const color = isHighRisk ? "#ef4444" : riskPercent >= 40 ? "#f59e0b" : "#10b981";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (riskPercent / 100) * circumference;

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6">
      <h4 className="text-sm font-medium text-gray-400 mb-4">{title}</h4>
      <div className="flex items-center gap-6">
        {/* Circular progress */}
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="8"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold" style={{ color }}>
              {Math.round(riskPercent)}%
            </span>
          </div>
          {/* Pulse on high risk */}
          {isHighRisk && (
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ border: `2px solid ${color}` }}
            />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold text-white">
              {Math.round(riskPercent)}%
            </span>
            {trend && (
              <span
                className={`text-sm ${
                  trend === "up"
                    ? "text-red-400"
                    : trend === "down"
                    ? "text-emerald-400"
                    : "text-gray-500"
                }`}
              >
                {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
              </span>
            )}
          </div>
          {note && <p className="text-xs text-gray-500">{note}</p>}
        </div>
      </div>
    </div>
  );
}
