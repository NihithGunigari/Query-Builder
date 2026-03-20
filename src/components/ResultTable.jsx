import React from "react";

export default function ResultTable({ queryResult, resolveColumnName }) {
  if (!queryResult) return null;

  const columns = queryResult.columns || [];
  const rows = queryResult.rows || [];

  if (columns.length === 0 && rows.length === 0) {
    return <div style={{ padding: "10px", color: "#666" }}>No data returned.</div>;
  }

  return (
    <table className="result-table">
      {columns.length > 0 && (
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx}>{resolveColumnName(col)}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length || 1} style={{ padding: "10px", textAlign: "center", color: "#888" }}>
              No rows found.
            </td>
          </tr>
        ) : (
          rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {Array.isArray(row)
                ? row.map((cell, cIdx) => <td key={cIdx}>{String(cell)}</td>)
                : columns.length > 0
                ? columns.map((col, cIdx) => <td key={cIdx}>{String(row[col])}</td>)
                : Object.values(row).map((cell, cIdx) => <td key={cIdx}>{String(cell)}</td>)}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
