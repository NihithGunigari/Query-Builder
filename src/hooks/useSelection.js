import { useState } from "react";
import { COLLAPSED_HEIGHT } from "../constants";

export function useSelection(cards, setCards, canvasRef) {
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [selectionRect, setSelectionRect] = useState(null);

  /* ── Start drawing selection rectangle on canvas background click ── */
  const handleCanvasMouseDown = (e) => {
    const tag = e.target.tagName.toLowerCase();
    const isBackground =
      e.target === canvasRef.current ||
      tag === "svg" ||
      (tag === "rect" && e.target.getAttribute("data-bg") === "true");
    if (!isBackground) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left + canvasRef.current.scrollLeft;
    const startY = e.clientY - rect.top + canvasRef.current.scrollTop;
    setSelectedCardIds(new Set());
    setSelectionRect({ startX, startY, x: startX, y: startY, w: 0, h: 0 });
  };

  /* ── Update selection rectangle on mouse move ── */
  const updateSelectionRect = (e) => {
    if (!selectionRect || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left + canvasRef.current.scrollLeft;
    const currentY = e.clientY - rect.top + canvasRef.current.scrollTop;
    setSelectionRect((prev) => ({
      ...prev,
      x: Math.min(prev.startX, currentX),
      y: Math.min(prev.startY, currentY),
      w: Math.abs(currentX - prev.startX),
      h: Math.abs(currentY - prev.startY),
    }));
  };

  /* ── Finalize selection rectangle ── */
  const finalizeSelection = () => {
    if (!selectionRect) return;
    if (selectionRect.w > 8 && selectionRect.h > 8) {
      const selected = new Set();
      cards.forEach((card) => {
        const cardRight = card.x + card.width;
        const cardBottom = card.y + (card.isCollapsed ? COLLAPSED_HEIGHT : card.height);
        const rectRight = selectionRect.x + selectionRect.w;
        const rectBottom = selectionRect.y + selectionRect.h;
        if (card.x < rectRight && cardRight > selectionRect.x && card.y < rectBottom && cardBottom > selectionRect.y) {
          selected.add(card.id);
        }
      });
      setSelectedCardIds(selected);
    }
    setSelectionRect(null);
  };

  /* ── Scroll-to-resize selected cards ── */
  const handleCanvasWheel = (e) => {
    if (selectedCardIds.size === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -20 : 20;
    setCards((prev) =>
      prev.map((c) => {
        if (!selectedCardIds.has(c.id)) return c;
        return { ...c, width: Math.max(180, c.width + delta), height: Math.max(80, c.height + delta) };
      })
    );
  };

  /* ── Escape clears selection ── */
  const clearSelection = () => {
    setSelectedCardIds(new Set());
    setSelectionRect(null);
  };

  return {
    selectedCardIds,
    setSelectedCardIds,
    selectionRect,
    handleCanvasMouseDown,
    updateSelectionRect,
    finalizeSelection,
    handleCanvasWheel,
    clearSelection,
  };
}
