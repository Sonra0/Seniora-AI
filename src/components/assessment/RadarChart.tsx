"use client";

import { ResponsiveRadar } from "@nivo/radar";

interface RadarChartProps {
  data: Record<string, number> | null;
}

const metricLabels: Record<string, string> = {
  parkinsons: "Parkinson's Risk",
  depression: "Depression",
  wellness: "Wellness",
  mood: "Mood",
  speechFluency: "Speech Fluency",
};

export function VocalRadarChart({ data }: RadarChartProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <svg className="w-10 h-10 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
        </svg>
        <p className="text-sm font-medium text-gray-400">Coming Soon</p>
        <p className="text-xs text-gray-600 mt-1">Vocal biomarker analysis will appear here</p>
      </div>
    );
  }

  const chartData = Object.entries(data).map(([key, value]) => ({
    metric: metricLabels[key] || key,
    value: Math.min(100, Math.max(0, value)),
  }));

  return (
    <div style={{ height: 300 }}>
      <ResponsiveRadar
        data={chartData}
        keys={["value"]}
        indexBy="metric"
        maxValue={100}
        margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
        curve="linearClosed"
        borderWidth={2}
        borderColor="#6366f1"
        gridLevels={4}
        gridShape="circular"
        gridLabelOffset={16}
        dotSize={8}
        dotColor="#6366f1"
        dotBorderWidth={2}
        dotBorderColor="#1e1b4b"
        colors={["#6366f1"]}
        fillOpacity={0.2}
        blendMode="normal"
        animate
        motionConfig="gentle"
        theme={{
          background: "transparent",
          text: { fill: "#9ca3af", fontSize: 11 },
          grid: { line: { stroke: "rgba(255,255,255,0.08)" } },
          tooltip: {
            container: {
              background: "#1f2937",
              color: "#f3f4f6",
              borderRadius: "8px",
              fontSize: 12,
            },
          },
        }}
      />
    </div>
  );
}
