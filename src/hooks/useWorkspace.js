import { useState, useEffect } from "react";
import {
  saveWorkspace as apiSave,
  loadWorkspace as apiLoad,
  listWorkspaces as apiList,
  deleteWorkspace as apiDelete,
} from "../api";

/**
 * Sanitise a cards array loaded from the server so every field
 * the rest of the app depends on is guaranteed to exist.
 */
export const sanitizeCards = (loadedCards) =>
  loadedCards.map((c) => ({
    ...c,
    isCollapsed: c.isCollapsed !== undefined ? c.isCollapsed : false,
    columns: Array.isArray(c.columns) ? c.columns : [],
    selectedColumns: Array.isArray(c.selectedColumns) ? c.selectedColumns : [],
    searchTerm: "",
    columnSelectOrder: c.columnSelectOrder || {},
    whereConditions: Array.isArray(c.whereConditions)
      ? c.whereConditions.map((w) => ({
          ...w,
          openBracket: w.openBracket || "",
          closeBracket: w.closeBracket || "",
          cardId: w.cardId || c.id,
        }))
      : [],
    havingConditions: Array.isArray(c.havingConditions)
      ? c.havingConditions.map((h) => ({
          ...h,
          func: h.func ? h.func.toUpperCase() : h.func,
        }))
      : [],
    groupBy: Array.isArray(c.groupBy) ? c.groupBy : [],
    orderBy: Array.isArray(c.orderBy) ? c.orderBy : [],
    aggregates: Array.isArray(c.aggregates)
      ? c.aggregates.map((a) => ({
          ...a,
          func: a.func ? a.func.toUpperCase() : a.func,
        }))
      : [],
  }));

export function useWorkspace({
  cards,
  setCards,
  joins,
  setJoins,
  setActiveCardId,
  setQueryResult,
  setQueryError,
  setIsResultsCleared,
  setCustomQuery,
  setDisplayQuery,
  setIsEditingQuery,
  createQuery,
}) {
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaces, setWorkspaces] = useState([]);

  /* Load workspace list on mount */
  useEffect(() => {
    (async () => {
      try {
        const res = await apiList();
        setWorkspaces(res.workspaces || []);
      } catch (err) {
        console.error("Failed to load workspaces", err);
        setWorkspaces([]);
      }
    })();
  }, []);

  /* ── Save ── */
  const handleSaveWorkspace = async () => {
    if (!workspaceName) { alert("Enter workspace name"); return; }
    try {
      await apiSave(workspaceName, cards, joins);
      const res = await apiList();
      setWorkspaces(res.workspaces || []);
      alert("Workspace saved successfully!");
    } catch (error) {
      console.error("Failed to save workspace", error);
      alert("Failed to save workspace.");
    }
  };

  /* ── Load ── */
  const handleLoadWorkspace = async (name) => {
    try {
      const res = await apiLoad(name);
      setActiveCardId(null);
      let loadedCards = [];
      let loadedJoins = [];
      if (Array.isArray(res)) { loadedCards = res; } else { loadedCards = res.cards || []; loadedJoins = res.joins || []; }
      if (!Array.isArray(loadedCards)) loadedCards = [];

      setCards(sanitizeCards(loadedCards));
      setJoins(loadedJoins);
      setWorkspaceName(name);
      setQueryResult(null);
      setQueryError(null);
      setIsResultsCleared(false);
      setCustomQuery("");
      setIsEditingQuery(false);
      setDisplayQuery("");
    } catch (error) {
      console.error("Error loading workspace:", error);
      alert("Failed to load workspace. Check console for details.");
    }
  };

  /* ── Delete ── */
  const handleDeleteWorkspace = async () => {
    if (!workspaceName) return;
    if (!window.confirm(`Delete "${workspaceName}"?`)) return;
    await apiDelete(workspaceName);
    setWorkspaceName("");
    setCards([]);
    setJoins([]);
    const res = await apiList();
    setWorkspaces(res.workspaces || []);
  };

  /* ── New ── */
  const handleNewWorkspace = () => {
    if (cards.length > 0 || joins.length > 0) {
      if (!window.confirm("Clear current workspace and start new?")) return;
    }
    setWorkspaceName("");
    setCards([]);
    setJoins([]);
    setActiveCardId(null);
    setQueryResult(null);
    setQueryError(null);
    setIsResultsCleared(false);
    setCustomQuery("");
    setDisplayQuery("");
    setIsEditingQuery(false);
  };

  /* ── Load workspace query for Scheduler (read-only, no canvas mutation) ── */
  const handleLoadWorkspaceQuery = async (wsName) => {
    try {
      const res = await apiLoad(wsName);
      let loadedCards = [];
      let loadedJoins = [];
      if (Array.isArray(res)) { loadedCards = res; } else { loadedCards = res.cards || []; loadedJoins = res.joins || []; }
      const sanitizedCards = sanitizeCards(loadedCards);
      if (sanitizedCards.length === 0) return "";
      const sql = createQuery(sanitizedCards, null, loadedJoins);
      return sql || "";
    } catch (e) {
      console.error("handleLoadWorkspaceQuery error:", e);
      throw e;
    }
  };

  return {
    workspaceName,
    setWorkspaceName,
    workspaces,
    handleSaveWorkspace,
    handleLoadWorkspace,
    handleDeleteWorkspace,
    handleNewWorkspace,
    handleLoadWorkspaceQuery,
  };
}
