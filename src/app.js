import { useRef, useState, useEffect } from "react";
import "./app.css";

/* ── Hooks ── */
import { useSidebarData } from "./hooks/useSidebarData";
import { useCards } from "./hooks/useCards";
import { useQueryBuilder, parseQueryToState, normalizeQueryAliases } from "./hooks/useQueryBuilder";
import { useJoins } from "./hooks/useJoins";
import { useWorkspace } from "./hooks/useWorkspace";
import { useQueryExecution } from "./hooks/useQueryExecution";
import { useSelection } from "./hooks/useSelection";

/* ── Components ── */
import Sidebar from "./components/Sidebar";
import WorkspaceBar from "./components/WorkspaceBar";
import TableCard from "./components/TableCard";
import JoinsLayer, { JoinMarkerDefs } from "./components/JoinsLayer";
import ConditionPanel from "./components/ConditionPanel";
import QueryPanel from "./components/QueryPanel";
import SchedulerModal from "./components/SchedulerModal";

/* ── API ── */
import { getColumns } from "./api";

/* ── Constants ── */
import {
  CARD_WIDTH,
  EXPANDED_DEFAULT_HEIGHT,
  CARD_GAP,
  START_X,
  START_Y,
} from "./constants";

/* ===================================================================
   APP COMPONENT
   =================================================================== */
export default function App() {
  const canvasRef = useRef(null);

  /* ── Dynamic max height for result panel ── */
  const [maxResultHeight, setMaxResultHeight] = useState(600);
  useEffect(() => {
    const update = () => setMaxResultHeight(window.innerHeight - 100);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  /* ── Sidebar ── */
  const sidebar = useSidebarData();

  /* ── Cards ── */
  const { cards, setCards, startDrag, startResize, removeCard } = useCards(canvasRef);

  /* ── Query Builder ── */
  const { generatedQuery, createQuery } = useQueryBuilder();

  /* ── Joins ── */
  const joinsHook = useJoins(cards, setCards, canvasRef);

  /* ── Column name resolver ── */
  const resolveColumnName = (colName) => {
    if (!colName) return "";
    if (colName.includes(".")) {
      const parts = colName.split(".");
      if (parts[0].match(/^t\d+$/)) {
        const idx = parseInt(parts[0].substring(1)) - 1;
        if (cards[idx]) return `${cards[idx].table}.${parts[1]}`;
      }
    }
    return colName;
  };

  /* ── Query Execution ── */
  const qExec = useQueryExecution(resolveColumnName);

  /* ── Selection ── */
  const sel = useSelection(cards, setCards, canvasRef);

  /* ── UI layout state ── */
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [resultHeight, setResultHeight] = useState(180);
  const [addingCard, setAddingCard] = useState(false);
  const [activeCardId, setActiveCardId] = useState(null);
  const [conditionWidth, setConditionWidth] = useState(310);
  const [dbTerm, setDbTerm] = useState("");
  const [tableTerm, setTableTerm] = useState("");
  const [showScheduler, setShowScheduler] = useState(false);

  /* ── Edit query state ── */
  const [customQuery, setCustomQuery] = useState("");
  const [isEditingQuery, setIsEditingQuery] = useState(false);
  const [displayQuery, setDisplayQuery] = useState("");
  const isEditingQueryRef = useRef(false);
  useEffect(() => { isEditingQueryRef.current = isEditingQuery; }, [isEditingQuery]);
  const liveEditDebounceRef = useRef(null);

  // Sync generated query → display query
  useEffect(() => {
    if (generatedQuery) {
      setDisplayQuery(generatedQuery);
      if (!isEditingQueryRef.current) setCustomQuery(generatedQuery);
    }
  }, [generatedQuery]);

  /* ── Workspace ── */
  const ws = useWorkspace({
    cards, setCards,
    joins: joinsHook.joins, setJoins: joinsHook.setJoins,
    setActiveCardId,
    setQueryResult: qExec.setQueryResult,
    setQueryError: qExec.setQueryError,
    setIsResultsCleared: qExec.setIsResultsCleared,
    setCustomQuery, setDisplayQuery, setIsEditingQuery,
    createQuery,
  });

  /* ── Ordered select items for Group By panel ── */
  const getOrderedSelectItems = () => {
    const items = [];
    const MAX_IDX = 1000000;
    cards.forEach((card) => {
      (card.selectedColumns || []).forEach((col, colIdx) => {
        const selectIdx = card.columnSelectOrder?.[col] !== undefined ? card.columnSelectOrder[col] : MAX_IDX + colIdx;
        items.push({ label: `${card.table}.${col}`, column: col, cardId: card.id, type: "column", selectOrder: selectIdx });
      });
      (card.aggregates || []).forEach((agg, aggIdx) => {
        if (agg.func && agg.column) {
          const targetCard = cards.find((c) => c.id === agg.cardId) || card;
          const func = agg.func.toUpperCase();
          const alias = agg.alias ? ` AS ${agg.alias}` : "";
          const selectIdx = agg.selectIndex !== undefined ? agg.selectIndex : MAX_IDX + 500 + aggIdx;
          items.push({ label: `${func}(${targetCard.table}.${agg.column})${alias}`, column: agg.column, cardId: agg.cardId || card.id, type: "aggregate", func, selectOrder: selectIdx });
        }
      });
    });
    items.sort((a, b) => a.selectOrder - b.selectOrder);
    return items;
  };

  /* ── Add table card ── */
  const onTableClick = async (table) => {
    if (!sidebar.selectedDb || addingCard) return;
    setAddingCard(true);
    try {
      const cols = await getColumns(sidebar.selectedDb, table);
      setCards((prev) => {
        const existingInstances = prev.filter((c) => c.db === sidebar.selectedDb && c.table === table);
        const instanceNum = existingInstances.length;
        const cardId = instanceNum === 0 ? `${sidebar.selectedDb}.${table}` : `${sidebar.selectedDb}.${table}_${instanceNum + 1}`;
        if (prev.find((c) => c.id === cardId)) return prev;
        const maxZ = Math.max(...prev.map((c) => c.zIndex || 1), 0);
        const canvasWidth = canvasRef.current?.clientWidth || 800;
        const cardsPerRow = Math.max(1, Math.floor((canvasWidth - START_X) / (CARD_WIDTH + CARD_GAP)));
        const index = prev.length;
        return [...prev, {
          id: cardId, db: sidebar.selectedDb, table, isCollapsed: true,
          columns: cols || [], selectedColumns: [], searchTerm: "",
          whereConditions: [], havingConditions: [], groupBy: [], orderBy: [],
          aggregates: [], columnSelectOrder: {},
          x: START_X + (index % cardsPerRow) * (CARD_WIDTH + CARD_GAP),
          y: START_Y + Math.floor(index / cardsPerRow) * (EXPANDED_DEFAULT_HEIGHT + CARD_GAP),
          width: CARD_WIDTH, height: EXPANDED_DEFAULT_HEIGHT, zIndex: maxZ + 1,
        }];
      });
    } finally { setAddingCard(false); }
  };

  /* ── Card helpers ── */
  const bringToFront = (id) => {
    setActiveCardId(id);
    if (!sel.selectedCardIds.has(id)) sel.setSelectedCardIds(new Set());
    setCards((prev) => {
      const maxZ = Math.max(...prev.map((c) => c.zIndex || 1), 0);
      return prev.map((c) => (c.id === id ? { ...c, zIndex: maxZ + 1 } : c));
    });
  };

  const toggleCardCollapse = (id) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, isCollapsed: !c.isCollapsed } : c)));

  const handleRemoveCard = (id) => {
    removeCard(id);
    joinsHook.setJoins((prev) => prev.filter((j) => j.leftTableId !== id && j.rightTableId !== id));
    if (activeCardId === id) setActiveCardId(null);
    sel.setSelectedCardIds((prev) => { if (!prev.has(id)) return prev; const next = new Set(prev); next.delete(id); return next; });
  };

  const handleFitAll = () => {
    if (cards.length === 0 || !canvasRef.current) return;
    const GAP = 20, PADDING = 20;
    const canvasW = canvasRef.current.clientWidth;
    const cols = Math.max(1, Math.floor((canvasW - PADDING) / (CARD_WIDTH + GAP)));
    setCards((prev) => prev.map((card, i) => ({
      ...card,
      x: PADDING + (i % cols) * (CARD_WIDTH + GAP),
      y: PADDING + Math.floor(i / cols) * (EXPANDED_DEFAULT_HEIGHT + GAP),
    })));
    canvasRef.current.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  };

  /* ── Query edit / design sync ── */
  const applyQueryToDesign = async (querySql, exitEditMode = true) => {
    try {
      const normalizedSql = normalizeQueryAliases(querySql);
      const { parsedCards, parsedJoins } = parseQueryToState(normalizedSql);
      const hydratedCards = await Promise.all(parsedCards.map(async (card) => {
        try {
          const cols = await getColumns(card.db, card.table);
          const joinedCols = parsedJoins.reduce((acc, j) => {
            if (j.leftTableId === card.id && !acc.includes(j.leftCol)) acc.push(j.leftCol);
            if (j.rightTableId === card.id && !acc.includes(j.rightCol)) acc.push(j.rightCol);
            return acc;
          }, []);
          let finalCols = cols || [];
          if (joinedCols.length > 0) {
            const unjoinedCols = finalCols.filter((c) => !joinedCols.includes(c));
            finalCols = [...joinedCols.filter((c) => finalCols.includes(c)), ...unjoinedCols];
          }
          return { ...card, columns: finalCols, selectedColumns: card.selectAll ? finalCols : card.selectedColumns };
        } catch { return card; }
      }));
      if (hydratedCards.length > 0) {
        setCards(hydratedCards);
        joinsHook.setJoins(parsedJoins);
        if (exitEditMode) setActiveCardId(null);
      }
      if (exitEditMode) { setDisplayQuery(querySql); setIsEditingQuery(false); }
    } catch (e) {
      console.error("Error parsing query:", e);
      if (exitEditMode) { alert("Could not parse query structure perfectly. Query saved as text."); setDisplayQuery(querySql); setIsEditingQuery(false); }
    }
  };

  const handleEditSaveToggle = async () => {
    if (isEditingQuery) { await applyQueryToDesign(customQuery, true); }
    else { setCustomQuery(displayQuery); setIsEditingQuery(true); }
  };

  const handleCreateQuery = () => {
    const newSql = createQuery(cards, activeCardId, joinsHook.joins);
    setDisplayQuery(newSql);
    setCustomQuery(newSql);
    qExec.setQueryResult(null);
    qExec.setQueryError(null);
    qExec.setIsResultsCleared(false);
    setIsEditingQuery(false);
  };

  /* ── Global mouse / key handlers ── */
  const handleGlobalMouseMove = (e) => {
    joinsHook.updateDragPosition(e);
    sel.updateSelectionRect(e);
  };
  const handleGlobalMouseUp = () => {
    joinsHook.releaseDrag();
    sel.finalizeSelection();
  };
  const handleKeyDown = (e) => {
    if (e.key === "Escape") { joinsHook.cancelPending(); sel.clearSelection(); }
  };

  /* ── Cartesian product warnings ── */
  const cartesianWarnings = (() => {
    const warnings = [];
    joinsHook.joins.forEach((join) => {
      if (join.type === "CROSS JOIN") {
        const lName = cards.find((c) => c.id === join.leftTableId)?.table || "unknown";
        const rName = cards.find((c) => c.id === join.rightTableId)?.table || "unknown";
        warnings.push(`CROSS JOIN between "${lName}" and "${rName}" produces a full Cartesian product.`);
      }
      if (join.leftTableId === join.rightTableId && join.type !== "CROSS JOIN") {
        const sCard = cards.find((c) => c.id === join.leftTableId);
        const hasWhere = sCard?.whereConditions?.some((w) => w.column && (["IS NULL", "IS NOT NULL"].includes(w.operator) || w.value));
        if (!hasWhere) warnings.push(`Self Join on "${sCard?.table}" has no WHERE condition.`);
      }
    });
    return warnings;
  })();

  /* ===================================================================
     RENDER
     =================================================================== */
  return (
    <div className="app-root"
      style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}
      onMouseMove={handleGlobalMouseMove}
      onMouseUp={handleGlobalMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* ── Header ── */}
      <header className="app-header" style={{ flexShrink: 0 }}>
        <button className="collapse-btn" onClick={() => setLeftCollapsed(!leftCollapsed)}>
          {leftCollapsed ? ">" : "<"}
        </button>
        Visual Query Builder
      </header>

      <div className="app-main" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left Sidebar ── */}
        <Sidebar {...sidebar} collapsed={leftCollapsed}
          dbTerm={dbTerm} setDbTerm={setDbTerm}
          tableTerm={tableTerm} setTableTerm={setTableTerm}
          onTableClick={onTableClick}
        />

        {/* ── Center Panel ── */}
        <div className="center-panel" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>

          <WorkspaceBar
            workspaceName={ws.workspaceName} setWorkspaceName={ws.setWorkspaceName}
            workspaces={ws.workspaces}
            onSave={ws.handleSaveWorkspace} onNew={ws.handleNewWorkspace}
            onDelete={ws.handleDeleteWorkspace} onLoad={ws.handleLoadWorkspace}
            onFitAll={handleFitAll} cardsExist={cards.length > 0}
            onOpenScheduler={() => setShowScheduler(true)}
          />

          {/* ── Canvas ── */}
          <div className="canvas-container" style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div className="canvas-header">Query Canvas</div>
            <div className="canvas-body" ref={canvasRef}
              style={{ flex: 1, position: "relative", overflow: "auto" }}
              onMouseDown={sel.handleCanvasMouseDown}
              onWheel={sel.handleCanvasWheel}
            >
              {/* SVG join layer */}
              <svg className="joins-layer" width={2000} height={2000} style={{ position: "absolute", top: 0, left: 0 }} data-bg="true">
                <JoinMarkerDefs />
                <JoinsLayer
                  joins={joinsHook.joins} cards={cards}
                  dragConnection={joinsHook.dragConnection}
                  pendingConnection={joinsHook.pendingConnection}
                  cycleJoinType={joinsHook.cycleJoinType}
                  removeJoin={joinsHook.removeJoin}
                />
              </svg>

              {/* Cartesian warning */}
              {cartesianWarnings.length > 0 && (
                <div className="cartesian-warning-banner">
                  <span className="cartesian-warning-icon">⚠</span>
                  <div>{cartesianWarnings.map((w, i) => <div key={i}>{w}</div>)}</div>
                </div>
              )}

              {/* Selection rectangle */}
              {sel.selectionRect && sel.selectionRect.w > 2 && sel.selectionRect.h > 2 && (
                <div className="selection-rect"
                  style={{ left: sel.selectionRect.x, top: sel.selectionRect.y, width: sel.selectionRect.w, height: sel.selectionRect.h }}
                />
              )}

              {/* Table cards */}
              {cards.map((card) => (
                <TableCard key={card.id} card={card}
                  activeCardId={activeCardId} selectedCardIds={sel.selectedCardIds}
                  pendingConnection={joinsHook.pendingConnection} joins={joinsHook.joins}
                  bringToFront={bringToFront} startDrag={startDrag}
                  toggleCardCollapse={toggleCardCollapse} handleRemoveCard={handleRemoveCard}
                  setCards={setCards} startResize={startResize}
                  handleArrowClick={joinsHook.handleArrowClick}
                  handleDotMouseDown={joinsHook.handleDotMouseDown}
                  handleDotMouseUp={joinsHook.handleDotMouseUp}
                />
              ))}
            </div>
          </div>

          {/* ── Query / Results Panel ── */}
          <QueryPanel
            bottomCollapsed={bottomCollapsed} setBottomCollapsed={setBottomCollapsed}
            resultHeight={resultHeight} setResultHeight={setResultHeight}
            maxResultHeight={maxResultHeight}
            displayQuery={displayQuery} customQuery={customQuery} setCustomQuery={setCustomQuery}
            isEditingQuery={isEditingQuery}
            queryResult={qExec.queryResult} queryLoading={qExec.queryLoading}
            queryError={qExec.queryError} isResultsCleared={qExec.isResultsCleared}
            showGraph={qExec.showGraph} setShowGraph={qExec.setShowGraph}
            handleClearResults={qExec.handleClearResults}
            handleDownloadResults={qExec.handleDownloadResults}
            handleEditSaveToggle={handleEditSaveToggle}
            runQuery={() => qExec.runQuery(displayQuery)}
            handleCreateQuery={handleCreateQuery}
            resolveColumnName={resolveColumnName}
            applyQueryToDesign={applyQueryToDesign}
            liveEditDebounceRef={liveEditDebounceRef}
          />
        </div>

        {/* ── Right Condition Panel ── */}
        <ConditionPanel
          cards={cards} setCards={setCards}
          conditionWidth={conditionWidth} setConditionWidth={setConditionWidth}
          selectListItems={getOrderedSelectItems()}
        />
      </div>

      {/* ── Scheduler Modal ── */}
      <SchedulerModal
        isOpen={showScheduler} onClose={() => setShowScheduler(false)}
        currentQuery={displayQuery}
        workspaces={ws.workspaces}
        onLoadWorkspaceQuery={ws.handleLoadWorkspaceQuery}
      />
    </div>
  );
}
