import { useState } from "react";
import { executeQuery } from "../api";

export function useQueryExecution(resolveColumnName) {
  const [queryResult, setQueryResult] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [isResultsCleared, setIsResultsCleared] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  /* ── Run ── */
  const runQuery = async (sql) => {
    if (!sql) return;
    setIsResultsCleared(false);
    setQueryLoading(true);
    setQueryError(null);
    try {
      const data = await executeQuery(sql);
      setQueryResult(data);
    } catch (err) {
      setQueryError(err.response?.data?.detail || err.message);
      setQueryResult(null);
    } finally {
      setQueryLoading(false);
    }
  };

  /* ── Download CSV ── */
  const handleDownloadResults = async () => {
    if (!queryResult || (!queryResult.rows && !queryResult.length)) {
      alert("No results to download. Run the query first.");
      return;
    }
    try {
      const columns = queryResult.columns || [];
      const rows = queryResult.rows || [];

      const escapeCsv = (val) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes("\n") || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      let csvContent = "";
      if (columns.length > 0) {
        csvContent += columns.map((col) => escapeCsv(resolveColumnName(col))).join(",") + "\n";
      }
      rows.forEach((row) => {
        let rowStr;
        if (Array.isArray(row)) {
          rowStr = row.map(escapeCsv).join(",");
        } else if (columns.length > 0) {
          rowStr = columns.map((col) => escapeCsv(row[col])).join(",");
        } else {
          rowStr = Object.values(row).map(escapeCsv).join(",");
        }
        csvContent += rowStr + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `query_results_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to download results.");
    }
  };

  /* ── Clear ── */
  const handleClearResults = () => {
    setQueryResult(null);
    setQueryError(null);
    setIsResultsCleared(true);
    setShowGraph(false);
  };

  return {
    queryResult,
    setQueryResult,
    queryLoading,
    queryError,
    setQueryError,
    isResultsCleared,
    setIsResultsCleared,
    showGraph,
    setShowGraph,
    runQuery,
    handleDownloadResults,
    handleClearResults,
  };
}
