import React from "react";

export default function BarChart({ queryResult, resolveColumnName }) {
  if (!queryResult) return null;

  const columns = queryResult.columns || [];
  const rows = queryResult.rows || [];
  if (columns.length !== 2 || rows.length === 0) return null;

  // Identify which column is numeric (Y) and which is label (X)
  const firstRow = rows[0];
  const val0 = Array.isArray(firstRow) ? firstRow[0] : firstRow[columns[0]];
  const isNum0 = !isNaN(parseFloat(val0)) && isFinite(val0);
  const numIdx = isNum0 ? 0 : 1;
  const labelIdx = isNum0 ? 1 : 0;

  const xLabel = resolveColumnName(columns[labelIdx]);
  const yLabel = resolveColumnName(columns[numIdx]);

  const data = rows.map((row) => {
    const rawLabel = Array.isArray(row) ? row[labelIdx] : row[columns[labelIdx]];
    const rawNum = Array.isArray(row) ? row[numIdx] : row[columns[numIdx]];
    return { label: String(rawLabel ?? ""), value: parseFloat(rawNum) || 0 };
  });

  // Chart dimensions
  const svgWidth = Math.max(600, data.length * 60 + 120);
  const svgHeight = 320;
  const marginLeft = 70, marginRight = 20, marginTop = 20, marginBottom = 80;
  const chartW = svgWidth - marginLeft - marginRight;
  const chartH = svgHeight - marginTop - marginBottom;

  const maxVal = Math.max(...data.map((d) => d.value), 0);
  const yMax = maxVal === 0 ? 1 : maxVal * 1.1;
  const barW = Math.max(8, Math.min(48, (chartW / data.length) * 0.6));
  const barGap = chartW / data.length;

  // Y-axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    parseFloat(((yMax / tickCount) * i).toFixed(2))
  );

  const BAR_COLOR = "#4a90d9";
  const AXIS_COLOR = "#555";
  const GRID_COLOR = "#e8e8e8";

  return (
    <div className="bar-chart-wrapper">
      <div className="bar-chart-title">{yLabel} by {xLabel}</div>
      <div style={{ overflowX: "auto" }}>
        <svg width={svgWidth} height={svgHeight} style={{ display: "block", fontFamily: "Arial, sans-serif" }}>
          {/* Grid lines + Y ticks */}
          {yTicks.map((tick) => {
            const y = marginTop + chartH - (tick / yMax) * chartH;
            return (
              <g key={tick}>
                <line x1={marginLeft} y1={y} x2={marginLeft + chartW} y2={y} stroke={GRID_COLOR} strokeWidth={1} />
                <text x={marginLeft - 6} y={y + 4} textAnchor="end" fontSize={10} fill={AXIS_COLOR}>
                  {tick.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Y-axis label */}
          <text
            transform={`translate(14, ${marginTop + chartH / 2}) rotate(-90)`}
            textAnchor="middle" fontSize={11} fill={AXIS_COLOR} fontWeight="bold"
          >
            {yLabel}
          </text>

          {/* X-axis label */}
          <text x={marginLeft + chartW / 2} y={svgHeight - 4} textAnchor="middle" fontSize={11} fill={AXIS_COLOR} fontWeight="bold">
            {xLabel}
          </text>

          {/* Axes */}
          <line x1={marginLeft} y1={marginTop} x2={marginLeft} y2={marginTop + chartH} stroke={AXIS_COLOR} strokeWidth={1.5} />
          <line x1={marginLeft} y1={marginTop + chartH} x2={marginLeft + chartW} y2={marginTop + chartH} stroke={AXIS_COLOR} strokeWidth={1.5} />

          {/* Bars */}
          {data.map((d, i) => {
            const barH = (d.value / yMax) * chartH;
            const x = marginLeft + i * barGap + (barGap - barW) / 2;
            const y = marginTop + chartH - barH;
            const labelX = x + barW / 2;
            const labelY = marginTop + chartH + 14;
            const displayLabel = d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label;
            return (
              <g key={i}>
                <rect x={x} y={y} width={barW} height={Math.max(0, barH)} fill={BAR_COLOR} rx={2}>
                  <title>{d.label}: {d.value.toLocaleString()}</title>
                </rect>
                {barH > 14 && (
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill={AXIS_COLOR}>
                    {d.value.toLocaleString()}
                  </text>
                )}
                <text
                  x={labelX} y={labelY}
                  textAnchor="end" fontSize={10} fill={AXIS_COLOR}
                  transform={`rotate(-35, ${labelX}, ${labelY})`}
                >
                  {displayLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Utility: checks whether the current result is eligible for bar-chart display.
 * Exactly 2 columns, at least 1 row, exactly one numeric column.
 */
export function canShowBarChart(queryResult) {
  if (!queryResult) return false;
  const columns = queryResult.columns || [];
  const rows = queryResult.rows || [];
  if (columns.length !== 2 || rows.length === 0) return false;
  const firstRow = rows[0];
  const val0 = Array.isArray(firstRow) ? firstRow[0] : firstRow[columns[0]];
  const val1 = Array.isArray(firstRow) ? firstRow[1] : firstRow[columns[1]];
  const isNum0 = !isNaN(parseFloat(val0)) && isFinite(val0);
  const isNum1 = !isNaN(parseFloat(val1)) && isFinite(val1);
  return isNum0 !== isNum1;
}
