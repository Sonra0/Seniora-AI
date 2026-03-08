"use client";

import { ResponsiveLine } from "@nivo/line";

interface TrendChartProps {
  dates: string[];
  scores: (number | null)[];
  wellnessScores: (number | null)[];
  depressionIndices: (number | null)[];
}

export function TrendChart({
  dates,
  scores,
  wellnessScores,
  depressionIndices,
}: TrendChartProps) {
  const buildSeries = (
    id: string,
    values: (number | null)[]
  ) => ({
    id,
    data: dates
      .map((d, i) => ({
        x: d,
        y: values[i],
      }))
      .filter((p) => p.y !== null),
  });

  const data = [
    buildSeries("Cognitive Score", scores),
    buildSeries("Wellness", wellnessScores),
    buildSeries("Depression Index", depressionIndices),
  ].filter((s) => s.data.length > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        No trend data available yet
      </div>
    );
  }

  return (
    <div style={{ height: 300 }}>
      <ResponsiveLine
        data={data}
        margin={{ top: 20, right: 20, bottom: 50, left: 50 }}
        xScale={{ type: "point" }}
        yScale={{ type: "linear", min: 0, max: 100, stacked: false }}
        curve="monotoneX"
        colors={["#6366f1", "#10b981", "#f59e0b"]}
        lineWidth={2}
        pointSize={6}
        pointColor={{ theme: "background" }}
        pointBorderWidth={2}
        pointBorderColor={{ from: "serieColor" }}
        enableArea
        areaOpacity={0.1}
        enableGridX={false}
        gridYValues={[0, 25, 50, 75, 100]}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          tickRotation: -45,
          format: (v: string) => {
            const d = new Date(v);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          },
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          tickValues: [0, 25, 50, 75, 100],
        }}
        theme={{
          background: "transparent",
          text: { fill: "#9ca3af" },
          grid: { line: { stroke: "rgba(255,255,255,0.06)" } },
          axis: {
            ticks: { text: { fill: "#6b7280", fontSize: 11 } },
          },
          crosshair: { line: { stroke: "#6366f1", strokeWidth: 1 } },
          tooltip: {
            container: {
              background: "#1f2937",
              color: "#f3f4f6",
              borderRadius: "8px",
              fontSize: 12,
            },
          },
        }}
        useMesh
        animate
        motionConfig="gentle"
        legends={[
          {
            anchor: "top",
            direction: "row",
            translateY: -16,
            itemWidth: 120,
            itemHeight: 16,
            itemTextColor: "#9ca3af",
            symbolSize: 8,
            symbolShape: "circle",
          },
        ]}
      />
    </div>
  );
}
