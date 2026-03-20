import { useState } from "react";
import {
  HEADER_HEIGHT,
  SEARCH_HEIGHT,
  COL_OFFSET,
  ROW_HEIGHT,
} from "../constants";

export function useJoins(cards, setCards, canvasRef) {
  const [joins, setJoins] = useState([]);
  const [dragConnection, setDragConnection] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);

  /* ── Cycle through join types on click ── */
  const cycleJoinType = (joinId) => {
    const types = ["INNER JOIN", "LEFT OUTER JOIN", "RIGHT OUTER JOIN", "FULL OUTER JOIN", "CROSS JOIN"];
    setJoins((prev) =>
      prev.map((j) => {
        if (j.id !== joinId) return j;
        let ct = j.type;
        if (ct === "LEFT JOIN") ct = "LEFT OUTER JOIN";
        if (ct === "RIGHT JOIN") ct = "RIGHT OUTER JOIN";
        const idx = types.indexOf(ct);
        return { ...j, type: types[(idx + 1) % types.length] };
      })
    );
  };

  /* ── Remove join on right-click ── */
  const removeJoin = (e, joinId) => {
    e.preventDefault();
    setJoins((prev) => prev.filter((j) => j.id !== joinId));
  };

  /* ── Float joined columns to top of their cards ── */
  const floatJoinedColumns = (cardIdA, colA, cardIdB, colB) => {
    if (cardIdA === cardIdB) return; // skip for self-join
    setCards((prev) =>
      prev.map((card) => {
        if (card.id === cardIdA) {
          const filtered = card.columns.filter((c) => c !== colA);
          return { ...card, columns: [colA, ...filtered] };
        }
        if (card.id === cardIdB) {
          const filtered = card.columns.filter((c) => c !== colB);
          return { ...card, columns: [colB, ...filtered] };
        }
        return card;
      })
    );
  };

  /* ── Drag-based join: mouse down on a connector dot ── */
  const handleDotMouseDown = (e, cardId, column, side) => {
    e.stopPropagation();
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isCollapsed) return;
    const startX = side === "left" ? card.x : card.x + card.width;
    const colIndex = card.columns.indexOf(column);
    const startY = card.y + HEADER_HEIGHT + SEARCH_HEIGHT + COL_OFFSET + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    setDragConnection({ startCardId: cardId, startCol: column, startX, startY, endX: startX, endY: startY });
  };

  /* ── Drag-based join: mouse up on target dot ── */
  const handleDotMouseUp = (e, targetCardId, targetCol) => {
    e.stopPropagation();
    if (!dragConnection) return;

    const isSelfJoin = dragConnection.startCardId === targetCardId;
    if (isSelfJoin && dragConnection.startCol === targetCol) { setDragConnection(null); return; }

    let leftTableId, leftCol, rightTableId, rightCol;
    if (isSelfJoin) {
      leftTableId = dragConnection.startCardId; leftCol = dragConnection.startCol;
      rightTableId = targetCardId; rightCol = targetCol;
    } else {
      const startCard = cards.find((c) => c.id === dragConnection.startCardId);
      const targetCard = cards.find((c) => c.id === targetCardId);
      const isStartLeft = !startCard || !targetCard || startCard.x <= targetCard.x;
      leftTableId = isStartLeft ? dragConnection.startCardId : targetCardId;
      leftCol = isStartLeft ? dragConnection.startCol : targetCol;
      rightTableId = isStartLeft ? targetCardId : dragConnection.startCardId;
      rightCol = isStartLeft ? targetCol : dragConnection.startCol;
    }

    setJoins((prev) => [...prev, { id: Date.now(), leftTableId, leftCol, rightTableId, rightCol, type: "INNER JOIN" }]);
    floatJoinedColumns(leftTableId, leftCol, rightTableId, rightCol);
    setDragConnection(null);
  };

  /* ── Click-based join via arrow symbols ── */
  const handleArrowClick = (e, cardId, column, side) => {
    e.stopPropagation();
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isCollapsed) return;

    if (!pendingConnection) {
      const colIndex = card.columns.indexOf(column);
      const xPos = side === "right" ? card.x + card.width : card.x;
      const yPos = card.y + HEADER_HEIGHT + SEARCH_HEIGHT + COL_OFFSET + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      setPendingConnection({ cardId, column, side, x: xPos, y: yPos });
    } else if (pendingConnection.cardId === cardId) {
      if (pendingConnection.column !== column) {
        // Self-join: same card, different column
        setJoins((prev) => [...prev, { id: Date.now(), leftTableId: cardId, leftCol: pendingConnection.column, rightTableId: cardId, rightCol: column, type: "INNER JOIN" }]);
      }
      setPendingConnection(null);
    } else {
      // Complete join between different cards
      const startCard = cards.find((c) => c.id === pendingConnection.cardId);
      const targetCard = cards.find((c) => c.id === cardId);
      const isStartLeft = !startCard || !targetCard || startCard.x <= targetCard.x;
      const newJoin = {
        id: Date.now(),
        leftTableId: isStartLeft ? pendingConnection.cardId : cardId,
        leftCol: isStartLeft ? pendingConnection.column : column,
        rightTableId: isStartLeft ? cardId : pendingConnection.cardId,
        rightCol: isStartLeft ? column : pendingConnection.column,
        type: "INNER JOIN",
      };
      setJoins((prev) => [...prev, newJoin]);
      floatJoinedColumns(pendingConnection.cardId, pendingConnection.column, cardId, column);
      setPendingConnection(null);
    }
  };

  /* ── Update drag position on global mouse move ── */
  const updateDragPosition = (e) => {
    if (!dragConnection || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragConnection((prev) => ({
      ...prev,
      endX: e.clientX - rect.left + canvasRef.current.scrollLeft,
      endY: e.clientY - rect.top + canvasRef.current.scrollTop,
    }));
  };

  /* ── Release drag ── */
  const releaseDrag = () => {
    if (dragConnection) setDragConnection(null);
  };

  /* ── Cancel pending on Escape ── */
  const cancelPending = () => setPendingConnection(null);

  return {
    joins,
    setJoins,
    dragConnection,
    pendingConnection,
    cycleJoinType,
    removeJoin,
    handleDotMouseDown,
    handleDotMouseUp,
    handleArrowClick,
    updateDragPosition,
    releaseDrag,
    cancelPending,
  };
}
