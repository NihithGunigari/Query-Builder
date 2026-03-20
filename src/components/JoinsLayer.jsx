import React from "react";
import {
  HEADER_HEIGHT,
  SEARCH_HEIGHT,
  COL_OFFSET,
  ROW_HEIGHT,
  COLLAPSED_HEIGHT,
} from "../constants";

export default function JoinsLayer({
  joins,
  cards,
  dragConnection,
  pendingConnection,
  cycleJoinType,
  removeJoin,
}) {
  const paths = [];

  joins.forEach((join) => {
    const leftCard = cards.find((c) => c.id === join.leftTableId);
    const rightCard = cards.find((c) => c.id === join.rightTableId);

    if (!leftCard) return;

    /* ── SELF JOIN ── */
    if (join.leftTableId === join.rightTableId) {
      const card = leftCard;
      let y1, y2;
      if (card.isCollapsed) {
        y1 = card.y + COLLAPSED_HEIGHT / 2 - 10;
        y2 = card.y + COLLAPSED_HEIGHT / 2 + 10;
      } else {
        const lIndex = card.columns.indexOf(join.leftCol);
        const rIndex = card.columns.indexOf(join.rightCol);
        y1 = card.y + HEADER_HEIGHT + SEARCH_HEIGHT + COL_OFFSET + (lIndex >= 0 ? lIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2;
        y2 = card.y + HEADER_HEIGHT + SEARCH_HEIGHT + COL_OFFSET + (rIndex >= 0 ? rIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2;
      }
      const xBase = card.x + card.width;
      const loopExtend = 65;
      const d = `M ${xBase} ${y1} C ${xBase + loopExtend} ${y1} ${xBase + loopExtend} ${y2} ${xBase} ${y2}`;

      paths.push(
        <path key={`halo-${join.id}`} d={d} className="join-line-halo"
          onClick={() => cycleJoinType(join.id)}
          onContextMenu={(e) => removeJoin(e, join.id)}
        >
          <title>Self Join ({join.type}) | Click: change type | Right-Click: Delete</title>
        </path>
      );
      paths.push(
        <path key={join.id} d={d} className="join-line self-join-line"
          markerStart="url(#circle-start)" markerEnd="url(#arrow-end-filled)"
          style={{ strokeDasharray: "6,3" }}
        />
      );
      return;
    }

    if (!rightCard) return;

    /* ── CROSS JOIN ── */
    if (join.type === "CROSS JOIN") {
      const x1 = leftCard.x + leftCard.width;
      const y1 = leftCard.y + (leftCard.isCollapsed ? COLLAPSED_HEIGHT : leftCard.height) / 2;
      const x2 = rightCard.x;
      const y2 = rightCard.y + (rightCard.isCollapsed ? COLLAPSED_HEIGHT : rightCard.height) / 2;
      const d = `M ${x1} ${y1} C ${x1 + 80} ${y1} ${x2 - 80} ${y2} ${x2} ${y2}`;

      paths.push(
        <path key={`halo-${join.id}`} d={d} className="join-line-halo"
          onClick={() => cycleJoinType(join.id)}
          onContextMenu={(e) => removeJoin(e, join.id)}
        >
          <title>CROSS JOIN — Produces Cartesian Product | Click: change | Right-Click: Delete</title>
        </path>
      );
      paths.push(
        <path key={join.id} d={d} className="join-line cross-join-line"
          markerStart="url(#cross-start)" markerEnd="url(#cross-end)"
          style={{ strokeDasharray: "8,4" }}
        />
      );
      return;
    }

    /* ── STANDARD JOIN ── */
    let x1, y1;
    if (leftCard.isCollapsed) {
      x1 = leftCard.x + leftCard.width;
      y1 = leftCard.y + COLLAPSED_HEIGHT / 2;
    } else {
      const lIndex = leftCard.columns.indexOf(join.leftCol);
      x1 = leftCard.x + leftCard.width;
      y1 = leftCard.y + HEADER_HEIGHT + SEARCH_HEIGHT + COL_OFFSET + (lIndex >= 0 ? lIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2;
    }

    let x2, y2;
    if (rightCard.isCollapsed) {
      x2 = rightCard.x;
      y2 = rightCard.y + COLLAPSED_HEIGHT / 2;
    } else {
      const rIndex = rightCard.columns.indexOf(join.rightCol);
      x2 = rightCard.x;
      y2 = rightCard.y + HEADER_HEIGHT + SEARCH_HEIGHT + COL_OFFSET + (rIndex >= 0 ? rIndex : 0) * ROW_HEIGHT + ROW_HEIGHT / 2;
    }

    let markerStart, markerEnd;
    const jt = join.type;
    if (jt === "LEFT JOIN" || jt === "LEFT OUTER JOIN") {
      markerStart = "url(#arrow-start-filled)";
      markerEnd = "url(#circle-end)";
    } else if (jt === "RIGHT JOIN" || jt === "RIGHT OUTER JOIN") {
      markerStart = "url(#circle-start)";
      markerEnd = "url(#arrow-end-filled)";
    } else if (jt === "FULL OUTER JOIN") {
      markerStart = "url(#arrow-start-filled)";
      markerEnd = "url(#arrow-end-filled)";
    } else {
      markerStart = "url(#circle-start)";
      markerEnd = "url(#circle-end)";
    }

    const d = `M ${x1} ${y1} C ${x1 + 80} ${y1} ${x2 - 80} ${y2} ${x2} ${y2}`;
    const isDotted = jt !== "INNER JOIN" || leftCard.isCollapsed || rightCard.isCollapsed;

    paths.push(
      <path key={`halo-${join.id}`} d={d} className="join-line-halo"
        onClick={() => cycleJoinType(join.id)}
        onContextMenu={(e) => removeJoin(e, join.id)}
      >
        <title>Click: {join.type} | Right-Click: Delete</title>
      </path>
    );
    paths.push(
      <path key={join.id} d={d} className="join-line"
        markerStart={markerStart} markerEnd={markerEnd}
        style={{ strokeDasharray: isDotted ? "5,5" : "none" }}
      />
    );
  });

  /* Drag-in-progress line */
  if (dragConnection) {
    const { startX, startY, endX, endY } = dragConnection;
    paths.push(<path key="dragging" d={`M ${startX} ${startY} L ${endX} ${endY}`} className="join-line temp" />);
  }

  /* Pending click-connection pulse dot */
  if (pendingConnection) {
    paths.push(
      <circle key="pending-dot" cx={pendingConnection.x} cy={pendingConnection.y} r={7} className="pending-connection-dot" />
    );
  }

  return paths;
}

/* ===================================================================
   SVG <defs> for marker arrows / circles / crosses.
   Rendered once inside the <svg> in Canvas.jsx.
   =================================================================== */
export function JoinMarkerDefs() {
  return (
    <defs>
      <marker id="arrow-start-filled" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M6,0 L0,3 L6,6 z" fill="#546e7a" />
      </marker>
      <marker id="arrow-end-filled" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L6,3 L0,6 z" fill="#546e7a" />
      </marker>
      <marker id="circle-start" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
        <circle cx="2.5" cy="2.5" r="2" fill="#546e7a" />
      </marker>
      <marker id="circle-end" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
        <circle cx="2.5" cy="2.5" r="2" fill="#546e7a" />
      </marker>
      <marker id="cross-start" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <line x1="1" y1="1" x2="7" y2="7" stroke="#e67e22" strokeWidth="1.5" />
        <line x1="7" y1="1" x2="1" y2="7" stroke="#e67e22" strokeWidth="1.5" />
      </marker>
      <marker id="cross-end" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <line x1="1" y1="1" x2="7" y2="7" stroke="#e67e22" strokeWidth="1.5" />
        <line x1="7" y1="1" x2="1" y2="7" stroke="#e67e22" strokeWidth="1.5" />
      </marker>
    </defs>
  );
}
