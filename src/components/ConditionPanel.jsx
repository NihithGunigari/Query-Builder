import React from "react";
import SearchableSelect from "./SearchableSelect";

/* ── helpers ── */
const cycleBracket = (current, type) => {
  const symbol = type === "open" ? "(" : ")";
  if (!current) return symbol;
  if (current === symbol) return symbol + symbol;
  return "";
};

/**
 * Helper to build a flattened list across all cards for a given property.
 */
const flattenCardProp = (cards, prop) =>
  cards.flatMap((c) =>
    (c[prop] || []).map((item, idx) => ({ ...item, cardId: c.id, originalIndex: idx }))
  );

/**
 * Update a specific item inside a per-card array.
 */
const updateCardArrayItem = (setCards, cardId, prop, originalIndex, updater) => {
  setCards((prev) =>
    prev.map((c) =>
      c.id === cardId
        ? { ...c, [prop]: c[prop].map((item, i) => (i === originalIndex ? updater(item) : item)) }
        : c
    )
  );
};

/**
 * Remove a specific item from a per-card array.
 */
const removeCardArrayItem = (setCards, cardId, prop, originalIndex) => {
  setCards((prev) =>
    prev.map((c) =>
      c.id === cardId ? { ...c, [prop]: c[prop].filter((_, i) => i !== originalIndex) } : c
    )
  );
};

/**
 * Move an item from one card's array to another card's array.
 */
const moveItemBetweenCards = (setCards, cards, oldCardId, newCardId, prop, originalIndex, resetFields = {}) => {
  setCards((prev) => {
    const oldCard = prev.find((c) => c.id === oldCardId);
    const itemToMove = oldCard[prop][originalIndex];
    return prev.map((c) => {
      if (c.id === oldCardId) return { ...c, [prop]: c[prop].filter((_, i) => i !== originalIndex) };
      if (c.id === newCardId) return { ...c, [prop]: [...c[prop], { ...itemToMove, cardId: newCardId, ...resetFields }] };
      return c;
    });
  });
};

/**
 * Add a new item to the FIRST card's array (default target).
 */
const addToFirstCard = (setCards, prop, newItem) => {
  setCards((prev) =>
    prev.map((c, i) =>
      i === 0
        ? { ...c, [prop]: [...(c[prop] || []), { ...newItem, cardId: c.id }] }
        : c
    )
  );
};

/* ── Table selector shared by all sections ── */
const TableSelector = ({ value, cards, onChange }) => (
  <select style={{ width: "90px", fontSize: "11px", marginRight: "4px" }} value={value} onChange={onChange}>
    {cards.map((card) => (
      <option key={card.id} value={card.id}>{card.table}</option>
    ))}
  </select>
);

/* ===================================================================
   MAIN COMPONENT
   =================================================================== */
export default function ConditionPanel({
  cards,
  setCards,
  conditionWidth,
  setConditionWidth,
  selectListItems,   // from getOrderedSelectItems()
}) {
  if (cards.length === 0) {
    return (
      <div className="condition-panel" style={{ width: conditionWidth, borderLeft: "1px solid #ddd", display: "flex", flexDirection: "column", backgroundColor: "#f9f9f9", flexShrink: 0 }}>
        <ResizeHandle conditionWidth={conditionWidth} setConditionWidth={setConditionWidth} />
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px 8px 14px" }}>
          <div className="condition-panel-empty">
            Select a table card to add conditions or filters. <br />
            Drag connector dots between tables to Join.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="condition-panel" style={{ width: conditionWidth, borderLeft: "1px solid #ddd", display: "flex", flexDirection: "column", backgroundColor: "#f9f9f9", flexShrink: 0 }}>
      <ResizeHandle conditionWidth={conditionWidth} setConditionWidth={setConditionWidth} />
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px 8px 14px" }}>
        <div className="condition-panel-content">
          <WhereSection cards={cards} setCards={setCards} />
          <div className="section-divider" />
          <AggregatesSection cards={cards} setCards={setCards} />
          <div className="section-divider" />
          <GroupBySection cards={cards} setCards={setCards} selectListItems={selectListItems} />
          <div className="section-divider" />
          <HavingSection cards={cards} setCards={setCards} />
          <div className="section-divider" />
          <OrderBySection cards={cards} setCards={setCards} />
        </div>
      </div>
    </div>
  );
}

/* ── Resize handle (left edge drag) ── */
function ResizeHandle({ conditionWidth, setConditionWidth }) {
  return (
    <div
      className="condition-resize-handle"
      style={{ width: "4px", cursor: "ew-resize", height: "100%" }}
      onMouseDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = conditionWidth;
        const onMove = (ev) => setConditionWidth(Math.min(580, Math.max(240, startWidth + (startX - ev.clientX))));
        const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
    />
  );
}

/* ===================================================================
   SECTION 1: WHERE CONDITIONS
   =================================================================== */
function WhereSection({ cards, setCards }) {
  const items = flattenCardProp(cards, "whereConditions");

  return (
    <div className="cp-section cp-section--where">
      <h4>Conditions</h4>
      <div className="where-builder">
        {items.map((cond, globalIdx) => (
          <div className="panel-item-row" key={`${cond.cardId}-${cond.originalIndex}`}>
            {/* Logic (AND/OR) */}
            {globalIdx > 0 ? (
              <select className="logic-select" value={cond.logic}
                onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "whereConditions", cond.originalIndex, (w) => ({ ...w, logic: e.target.value }))}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            ) : (
              <div style={{ width: "65px", flexShrink: 0 }} />
            )}

            {/* Table selector */}
            <TableSelector value={cond.cardId} cards={cards}
              onChange={(e) => {
                const newCardId = e.target.value;
                if (newCardId === cond.cardId) return;
                moveItemBetweenCards(setCards, cards, cond.cardId, newCardId, "whereConditions", cond.originalIndex, { column: "" });
              }}
            />

            {/* Open bracket */}
            <button className={`bracket-btn ${cond.openBracket ? "active" : ""}`}
              onClick={() => updateCardArrayItem(setCards, cond.cardId, "whereConditions", cond.originalIndex, (w) => ({ ...w, openBracket: cycleBracket(w.openBracket, "open") }))}
            >
              {cond.openBracket || "("}
            </button>

            {/* Column */}
            <div style={{ flex: 1, minWidth: "80px" }}>
              <SearchableSelect placeholder="Column" value={cond.column}
                options={cards.find((c) => c.id === cond.cardId)?.columns || []}
                onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "whereConditions", cond.originalIndex, (w) => ({ ...w, column: e.target.value }))}
              />
            </div>

            {/* Operator */}
            <select style={{ width: "80px", flexShrink: 0 }} value={cond.operator}
              onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "whereConditions", cond.originalIndex, (w) => ({ ...w, operator: e.target.value }))}
            >
              <option value="=">=</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="LIKE">LIKE</option>
              <option value="NOT LIKE">NOT LIKE</option>
              <option value="IN">IN</option>
              <option value="NOT IN">NOT IN</option>
              <option value="BETWEEN">BETWEEN</option>
              <option value="IS NULL">IS NULL</option>
              <option value="IS NOT NULL">IS NOT NULL</option>
            </select>

            {/* Value(s) */}
            {["IS NULL", "IS NOT NULL"].includes(cond.operator) ? null : cond.operator === "BETWEEN" ? (
              <div style={{ display: "flex", gap: "2px", flex: 1 }}>
                <input style={{ width: "50%" }} type="text" placeholder="From" value={cond.value}
                  onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "whereConditions", cond.originalIndex, (w) => ({ ...w, value: e.target.value }))}
                />
                <input style={{ width: "50%" }} type="text" placeholder="To" value={cond.value2 || ""}
                  onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "whereConditions", cond.originalIndex, (w) => ({ ...w, value2: e.target.value }))}
                />
              </div>
            ) : (
              <input style={{ flex: 1, minWidth: "60px" }} type="text" placeholder="Value" value={cond.value}
                onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "whereConditions", cond.originalIndex, (w) => ({ ...w, value: e.target.value }))}
              />
            )}

            {/* Close bracket */}
            <button className={`bracket-btn ${cond.closeBracket ? "active" : ""}`}
              onClick={() => updateCardArrayItem(setCards, cond.cardId, "whereConditions", cond.originalIndex, (w) => ({ ...w, closeBracket: cycleBracket(w.closeBracket, "close") }))}
            >
              {cond.closeBracket || ")"}
            </button>

            {/* Remove */}
            <button className="panel-remove-btn"
              onClick={() => removeCardArrayItem(setCards, cond.cardId, "whereConditions", cond.originalIndex)}
            >×</button>
          </div>
        ))}

        <button className="add-condition-btn"
          onClick={() => addToFirstCard(setCards, "whereConditions", { column: "", operator: "=", value: "", value2: "", logic: "AND", openBracket: "", closeBracket: "" })}
        >
          + Add Condition
        </button>
      </div>
    </div>
  );
}

/* ===================================================================
   SECTION 2: AGGREGATES
   =================================================================== */
function AggregatesSection({ cards, setCards }) {
  const items = flattenCardProp(cards, "aggregates");

  return (
    <div className="cp-section cp-section--agg">
      <h4>Aggregates</h4>
      {items.map((agg) => (
        <div key={`${agg.cardId}-${agg.originalIndex}`} className="panel-item-row">
          {/* Function */}
          <select style={{ width: "80px", fontWeight: "bold" }} value={agg.func ? agg.func.toUpperCase() : "COUNT"}
            onChange={(e) => updateCardArrayItem(setCards, agg.cardId, "aggregates", agg.originalIndex, (a) => ({ ...a, func: e.target.value.toUpperCase() }))}
          >
            <option value="COUNT">COUNT</option>
            <option value="SUM">SUM</option>
            <option value="AVG">AVG</option>
            <option value="MIN">MIN</option>
            <option value="MAX">MAX</option>
          </select>

          {/* Table */}
          <TableSelector value={agg.cardId} cards={cards}
            onChange={(e) => {
              const newCardId = e.target.value;
              if (newCardId === agg.cardId) return;
              moveItemBetweenCards(setCards, cards, agg.cardId, newCardId, "aggregates", agg.originalIndex, { column: "" });
            }}
          />

          {/* Column */}
          <div style={{ flex: 1, minWidth: "80px" }}>
            <SearchableSelect placeholder="Column" value={agg.column}
              options={cards.find((c) => c.id === agg.cardId)?.columns || []}
              onChange={(e) => updateCardArrayItem(setCards, agg.cardId, "aggregates", agg.originalIndex, (a) => ({ ...a, column: e.target.value }))}
            />
          </div>

          {/* Alias */}
          <input style={{ width: "80px" }} type="text" placeholder="Alias" value={agg.alias || ""}
            onChange={(e) => updateCardArrayItem(setCards, agg.cardId, "aggregates", agg.originalIndex, (a) => ({ ...a, alias: e.target.value }))}
          />

          {/* Remove */}
          <button className="panel-remove-btn"
            onClick={() => removeCardArrayItem(setCards, agg.cardId, "aggregates", agg.originalIndex)}
          >×</button>
        </div>
      ))}

      <button className="add-condition-btn"
        onClick={() => addToFirstCard(setCards, "aggregates", { func: "COUNT", column: "", alias: "" })}
      >
        + Add Aggregate
      </button>
    </div>
  );
}

/* ===================================================================
   SECTION 3: GROUP BY
   =================================================================== */
function GroupBySection({ cards, setCards, selectListItems }) {
  const items = cards.flatMap((c) =>
    (c.groupBy || []).map((g, idx) => {
      const obj = typeof g === "string" ? { column: g, cardId: c.id } : g;
      return { ...obj, cardId: obj.cardId || c.id, originalIndex: idx };
    })
  );

  return (
    <div className="cp-section cp-section--group">
      <h4>Group By</h4>
      <div style={{ marginBottom: "10px", fontSize: "12px", color: "#666", fontStyle: "italic" }}>
        Group By select list positions
      </div>

      {items.map((groupObj) => {
        const currentSelectionIndex = selectListItems.findIndex((item) => {
          if (groupObj.isAggregate) {
            const funcMatch = !groupObj.func || !item.func || item.func.toUpperCase() === groupObj.func.toUpperCase();
            return item.type === "aggregate" && item.cardId === groupObj.cardId && item.column === groupObj.column && funcMatch;
          }
          return item.cardId === groupObj.cardId && item.column === groupObj.column && item.type !== "aggregate";
        });
        const dropdownValue = currentSelectionIndex !== -1 ? currentSelectionIndex : "";

        return (
          <div key={`${groupObj.cardId}-${groupObj.originalIndex}`} className="panel-item-row">
            <div style={{ flex: 1 }}>
              <select style={{ width: "100%" }} value={dropdownValue}
                onChange={(e) => {
                  const newIndex = parseInt(e.target.value, 10);
                  if (isNaN(newIndex)) return;
                  const selectedItem = selectListItems[newIndex];
                  const newCardId = selectedItem.cardId;
                  const oldCardId = groupObj.cardId;
                  const updatedGroupData = {
                    column: selectedItem.column,
                    cardId: selectedItem.cardId,
                    isAggregate: selectedItem.type === "aggregate",
                    func: selectedItem.type === "aggregate" ? selectedItem.func : undefined,
                  };

                  if (newCardId === oldCardId) {
                    setCards((prev) =>
                      prev.map((c) =>
                        c.id === oldCardId
                          ? { ...c, groupBy: c.groupBy.map((g, i) => (i === groupObj.originalIndex ? { ...g, ...updatedGroupData } : g)) }
                          : c
                      )
                    );
                  } else {
                    setCards((prev) => {
                      const oldCard = prev.find((c) => c.id === oldCardId);
                      let itemToMove = oldCard.groupBy[groupObj.originalIndex];
                      itemToMove = typeof itemToMove === "string" ? updatedGroupData : { ...itemToMove, ...updatedGroupData };
                      return prev.map((c) => {
                        if (c.id === oldCardId) return { ...c, groupBy: c.groupBy.filter((_, i) => i !== groupObj.originalIndex) };
                        if (c.id === newCardId) return { ...c, groupBy: [...c.groupBy, itemToMove] };
                        return c;
                      });
                    });
                  }
                }}
              >
                <option value="">Select position...</option>
                {selectListItems.map((item, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {item.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="panel-remove-btn"
              onClick={() => removeCardArrayItem(setCards, groupObj.cardId, "groupBy", groupObj.originalIndex)}
            >×</button>
          </div>
        );
      })}

      <button className="add-condition-btn"
        onClick={() => addToFirstCard(setCards, "groupBy", { column: "" })}
      >
        + Add Group By
      </button>
    </div>
  );
}

/* ===================================================================
   SECTION 4: HAVING
   =================================================================== */
function HavingSection({ cards, setCards }) {
  const items = flattenCardProp(cards, "havingConditions");

  return (
    <div className="cp-section cp-section--having">
      <h4>Having</h4>
      <div style={{ marginBottom: "10px", fontSize: "12px", color: "#666", fontStyle: "italic" }}>
        Filter aggregated results (e.g. COUNT(id) &gt; 5)
      </div>

      {items.map((cond, idx) => (
        <div className="panel-item-row" key={`${cond.cardId}-${cond.originalIndex}`}>
          {/* Logic */}
          {idx > 0 ? (
            <select className="logic-select" value={cond.logic}
              onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "havingConditions", cond.originalIndex, (h) => ({ ...h, logic: e.target.value }))}
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          ) : (
            <div style={{ width: "65px", flexShrink: 0 }} />
          )}

          {/* Function */}
          <select style={{ width: "70px", marginRight: "4px" }} value={cond.func ? cond.func.toUpperCase() : "COUNT"}
            onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "havingConditions", cond.originalIndex, (h) => ({ ...h, func: e.target.value.toUpperCase() }))}
          >
            <option value="COUNT">COUNT</option>
            <option value="SUM">SUM</option>
            <option value="AVG">AVG</option>
            <option value="MIN">MIN</option>
            <option value="MAX">MAX</option>
          </select>

          {/* Table */}
          <TableSelector value={cond.cardId} cards={cards}
            onChange={(e) => {
              const newCardId = e.target.value;
              if (newCardId === cond.cardId) return;
              moveItemBetweenCards(setCards, cards, cond.cardId, newCardId, "havingConditions", cond.originalIndex, { column: "" });
            }}
          />

          {/* Column */}
          <div style={{ flex: 1, minWidth: "80px" }}>
            <SearchableSelect placeholder="Column" value={cond.column}
              options={cards.find((c) => c.id === cond.cardId)?.columns || []}
              onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "havingConditions", cond.originalIndex, (h) => ({ ...h, column: e.target.value }))}
            />
          </div>

          {/* Operator */}
          <select style={{ width: "60px", flexShrink: 0 }} value={cond.operator}
            onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "havingConditions", cond.originalIndex, (h) => ({ ...h, operator: e.target.value }))}
          >
            <option value="=">=</option>
            <option value="!=">!=</option>
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value=">=">&gt;=</option>
            <option value="<=">&lt;=</option>
          </select>

          {/* Value */}
          <input style={{ width: "60px" }} type="text" placeholder="Value" value={cond.value}
            onChange={(e) => updateCardArrayItem(setCards, cond.cardId, "havingConditions", cond.originalIndex, (h) => ({ ...h, value: e.target.value }))}
          />

          {/* Remove */}
          <button className="panel-remove-btn"
            onClick={() => removeCardArrayItem(setCards, cond.cardId, "havingConditions", cond.originalIndex)}
          >×</button>
        </div>
      ))}

      <button className="add-condition-btn"
        onClick={() => addToFirstCard(setCards, "havingConditions", { logic: "AND", func: "COUNT", column: "", operator: ">", value: "" })}
      >
        + Add Having
      </button>
    </div>
  );
}

/* ===================================================================
   SECTION 5: ORDER BY
   =================================================================== */
function OrderBySection({ cards, setCards }) {
  const items = flattenCardProp(cards, "orderBy");

  return (
    <div className="cp-section cp-section--order">
      <h4>Order By</h4>
      {items.map((item) => (
        <div key={`${item.cardId}-${item.originalIndex}`} className="panel-item-row">
          {/* Table */}
          <TableSelector value={item.cardId} cards={cards}
            onChange={(e) => {
              const newCardId = e.target.value;
              if (newCardId === item.cardId) return;
              moveItemBetweenCards(setCards, cards, item.cardId, newCardId, "orderBy", item.originalIndex, { column: "" });
            }}
          />

          {/* Column */}
          <div style={{ flex: 1 }}>
            <SearchableSelect placeholder="Select column" value={item.column}
              options={cards.find((c) => c.id === item.cardId)?.columns || []}
              onChange={(e) => updateCardArrayItem(setCards, item.cardId, "orderBy", item.originalIndex, (o) => ({ ...o, column: e.target.value }))}
            />
          </div>

          {/* Direction */}
          <select style={{ width: "80px" }} value={item.direction}
            onChange={(e) => updateCardArrayItem(setCards, item.cardId, "orderBy", item.originalIndex, (o) => ({ ...o, direction: e.target.value }))}
          >
            <option value="ASC">ASC</option>
            <option value="DESC">DESC</option>
          </select>

          {/* Remove */}
          <button className="panel-remove-btn"
            onClick={() => removeCardArrayItem(setCards, item.cardId, "orderBy", item.originalIndex)}
          >×</button>
        </div>
      ))}

      <button className="add-condition-btn"
        onClick={() => addToFirstCard(setCards, "orderBy", { column: "", direction: "ASC" })}
      >
        + Add Order By
      </button>
    </div>
  );
}
