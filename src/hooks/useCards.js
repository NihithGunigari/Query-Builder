import { useState } from "react";

export function useCards(canvasRef) {
  const [cards, setCards] = useState([]);

  const startDrag = (e, id, selectedCardIds = new Set()) => {
    // If clicking on resize handle or inputs, don't drag
    if (e.target.className.includes("card-resize-handle") || e.target.tagName === "INPUT") return;

    const card = cards.find((c) => c.id === id);
    if (!card) return;

    // We need the canvas boundaries
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = e.clientX;
    const startY = e.clientY;

    // Determine if this is a group drag (card is part of a multi-selection)
    const isGroupDrag = selectedCardIds.has(id) && selectedCardIds.size > 1;
    const idsToMove = isGroupDrag ? [...selectedCardIds] : [id];

    // Snapshot initial positions for all cards involved in this drag
    const initialPositions = {};
    idsToMove.forEach((cid) => {
      const c = cards.find((x) => x.id === cid);
      if (c) initialPositions[cid] = { x: c.x, y: c.y };
    });

    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      setCards((prev) =>
        prev.map((c) => {
          if (!initialPositions[c.id]) return c;
          let newX = initialPositions[c.id].x + dx;
          let newY = initialPositions[c.id].y + dy;
          if (newX < 0) newX = 0;
          if (newY < 0) newY = 0;
          return { ...c, x: newX, y: newY };
        })
      );
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const startResize = (e, id) => {
    e.stopPropagation(); 
    const card = cards.find((c) => c.id === id);
    if (!card) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = card.width;
    const startHeight = card.height;

    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      setCards(prev => prev.map(c => {
          if (c.id === id) {
              return {
                  ...c,
                  width: Math.max(190, startWidth + dx), // Min width
                  height: Math.max(150, startHeight + dy) // Min height
              };
          }
          return c;
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const removeCard = (id) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  return {
    cards,
    setCards,
    startDrag,
    startResize,
    removeCard,
  };
}