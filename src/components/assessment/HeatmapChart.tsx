"use client";

import { ResponsiveHeatMap } from "@nivo/heatmap";

interface HeatmapChartProps {
  data: { day: string; week: number; value: number }[];
}

export function HeatmapChart({ data }: HeatmapChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No mood pattern data available
      </div>
    );
  }

  // Transform into nivo heatmap format: rows = days, columns = weeks
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxWeek = Math.max(...data.map((d) => d.week), 3);

  const heatmapData = days.map((day) => ({
    id: day,
    data: Array.from({ length: maxWeek + 1 }, (_, week) => {
      const match = data.find((d) => d.day === day && d.week === week);
      return { x: `W${week + 1}`, y: match ? match.value : null };
    }),
  }));

  return (
    <div style={{ height: 220 }}>
      <ResponsiveHeatMap
        data={heatmapData}
        margin={{ top: 20, right: 20, bottom: 20, left: 50 }}
        forceSquare={false}
        colors={{
          type: "sequential",
          scheme: "greens",
          minValue: 0,
          maxValue: 100,
        }}
        emptyColor="rgba(255,255,255,0.04)"
        borderRadius={4}
        borderWidth={2}
        borderColor="rgba(0,0,0,0.3)"
        enableLabels={false}
        animate
        motionConfig="gentle"
        theme={{
          background: "transparent",
          text: { fill: "#9ca3af", fontSize: 11 },
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
