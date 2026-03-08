"use client";

import { ResponsiveRadialBar } from "@nivo/radial-bar";

interface ScoreGaugeProps {
  score: number;
  label: string;
  severity?: "GREEN" | "YELLOW" | "RED" | null;
  color?: string;
  size?: "sm" | "lg";
}

const severityColors: Record<string, string> = {
  GREEN: "#10b981",
  YELLOW: "#f59e0b",
  RED: "#ef4444",
};

export function ScoreGauge({
  score,
  label,
  severity,
  color: colorProp,
  size = "lg",
}: ScoreGaugeProps) {
  const color = colorProp || (severity ? severityColors[severity] : "#6366f1");
  const height = size === "lg" ? 200 : 140;

  return (
    <div className="flex flex-col items-center">
      <div style={{ height, width: height }}>
        <ResponsiveRadialBar
          data={[
            {
              id: label,
              data: [{ x: label, y: score }],
            },
          ]}
          maxValue={100}
          startAngle={-135}
          endAngle={135}
          innerRadius={0.65}
          padding={0.3}
          cornerRadius={4}
          colors={[color]}
          enableTracks
          tracksColor="rgba(255,255,255,0.08)"
          enableRadialGrid={false}
          enableCircularGrid={false}
          radialAxisStart={null}
          circularAxisOuter={null}
          animate
          motionConfig="gentle"
        />
      </div>
      <div className="text-center -mt-4">
        <p className="text-3xl font-bold text-white" style={{ color }}>
          {Math.round(score)}%
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
