import React from "react";
import type { Mark } from "condition_oracle_contract";

/**
 * Value-mark history as a small line chart. Pure SVG, no library, so it
 * matches the hand-drawn look of the rest of the app.
 */
const MarkChart: React.FC<{
  history: Mark[];
  stroke?: string;
  fill?: string;
  height?: number;
}> = ({
  history,
  stroke = "#C8341E",
  fill = "rgba(200, 52, 30, 0.14)",
  height = 96,
}) => {
  const width = 342;
  const pad = 6;
  const points = history.map((m) => Number(m.value));
  if (points.length < 2) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "#3F2F4A",
        }}
      >
        The value chart starts after the first two marks are published.
      </div>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (v: number) =>
    height - pad - ((v - min) / span) * (height - pad * 2);
  const line = points
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${height - pad} L${x(0).toFixed(1)} ${height - pad} Z`;
  const last = points.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Value mark over time"
      style={{ display: "block", overflow: "visible" }}
    >
      <path d={area} fill={fill} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={x(last)}
        cy={y(points[last])}
        r="5"
        fill={stroke}
        stroke="#FFF4E2"
        strokeWidth="3"
      />
    </svg>
  );
};

export default MarkChart;
