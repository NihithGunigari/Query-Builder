import { useState } from "react";

/* --- HELPER: Split string by comma but ignore commas inside parentheses --- */
const splitByCommaIgnoreBrackets = (str) => {
  if (!str) return [];
  let depth = 0;
  let quote = null; // ' or "
  let current = "";
  const parts = [];
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    // Handle Quotes to ignore brackets/commas inside strings
    if ((char === "'" || char === '"') && (i === 0 || str[i-1] !== '\\')) {
        if (quote === char) quote = null;
        else if (!quote) quote = char;
    }

    if (!quote) {
        if (char === "(") depth++;
        else if (char === ")") depth--;
    }
    
    if (char === "," && depth === 0 && !quote) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current.trim());
  return parts;
};

/* --- HELPER: Split by AND but ignore brackets AND BETWEEN clauses --- */
const splitConditions = (str) => {
  if (!str) return [];
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = "";
  
  // Normalize spacing to single spaces (except in quotes? simplified here)
  // We'll iterate the raw string to be safe about quotes
  const input = str.replace(/\n/g, " "); 
  
  let inBetween = false; // true if we hit BETWEEN and are waiting for the matching AND

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    // 1. Handle Quotes
    if ((char === "'" || char === '"') && (i === 0 || input[i-1] !== '\\')) {
        if (quote === char) quote = null;
        else if (!quote) quote = char;
    }

    // 2. Handle Parentheses (only if not in quote)
    if (!quote) {
        if (char === "(") depth++;
        else if (char === ")") depth--;
    }

    // 3. Accumulate char
    current += char;

    // 4. Check for logic split
    // We look for " AND " (spaces around it)
    // AND we must not be in brackets, quotes, or a BETWEEN...AND block
    if (!quote && depth === 0) {
        const upper = current.toUpperCase();
        
        // Detect BETWEEN start
        if (upper.endsWith(" BETWEEN ")) {
            inBetween = true;
        }

        // Detect " AND "
        if (upper.endsWith(" AND ")) {
             // If we are "inBetween", this AND closes the BETWEEN range, it does NOT split the condition
             if (inBetween) {
                 inBetween = false; 
                 // We keep going, this is just part of the value range
             } else {
                 // REAL SPLIT
                 // Remove the " AND " from the end of current
                 const content = current.slice(0, -5).trim();
                 if (content) parts.push(content);
                 current = "";
             }
        }
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

/* --- HELPER: Strip outer parentheses --- */
const stripOuterParens = (str) => {
    let s = str.trim();
    // Safety break
    let limit = 0;
    while (s.startsWith("(") && s.endsWith(")") && limit < 50) {
        limit++;
        let depth = 0;
        let isOuter = true;
        let quote = null;

        for(let i=0; i<s.length-1; i++) {
            const char = s[i];
            if ((char === "'" || char === '"') && (i===0 || s[i-1] !== '\\')) {
                if(quote === char) quote = null;
                else if(!quote) quote = char;
            }

            if(!quote) {
                if(char === '(') depth++;
                if(char === ')') depth--;
                if(depth === 0) {
                    isOuter = false; 
                    break;
                }
            }
        }
        if(isOuter) s = s.slice(1, -1).trim();
        else break;
    }
    return s;
};

/* ============================================================
   NORMALIZE QUERY ALIASES
   Converts unaliased queries (db.table.column style) to aliased
   format (alias.column) so parseQueryToState can understand them.
   Tables without aliases get auto-assigned t1, t2, t3...
   ============================================================ */
export const normalizeQueryAliases = (sql) => {
  if (!sql) return sql;

  // Flatten to single line for parsing (we'll apply changes to original)
  const flatSql = sql.replace(/\r\n/g, '\n').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const upperFlat = flatSql.toUpperCase();

  // Locate FROM section
  const fromMatchIdx = upperFlat.search(/\bFROM\b/);
  if (fromMatchIdx === -1) return sql;

  const afterFromIdx = fromMatchIdx + 5; // length of "FROM "

  // Find where FROM section ends (start of WHERE/GROUP/HAVING/ORDER)
  const clauseSearchStr = upperFlat.slice(afterFromIdx);
  const clauseOffsets = [
    clauseSearchStr.search(/\bWHERE\b/),
    clauseSearchStr.search(/\bGROUP\s+BY\b/),
    clauseSearchStr.search(/\bHAVING\b/),
    clauseSearchStr.search(/\bORDER\s+BY\b/),
  ].filter(o => o !== -1);

  const endOfFromSection = clauseOffsets.length > 0
    ? afterFromIdx + Math.min(...clauseOffsets)
    : flatSql.length;

  const fromSection = flatSql.substring(afterFromIdx, endOfFromSection).trim();

  // Reserved words that can appear after table name (not aliases)
  const RESERVED = new Set([
    'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'JOIN', 'ON',
    'WHERE', 'GROUP', 'HAVING', 'ORDER', 'AND', 'OR', 'AS',
    'FROM', 'SELECT', 'BETWEEN', 'IN', 'NOT', 'LIKE', 'IS',
    'NULL', 'OUTER', 'SET', 'UNION', 'LIMIT'
  ]);

  const tableAliasMap = {}; // lowercase(tableName) -> { original, alias, hadAlias }
  let counter = 1;

  // Parse main table after FROM
  const mainTableMatch = fromSection.match(
    /^([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/i
  );
  if (mainTableMatch) {
    const tableName = mainTableMatch[1];
    const possAlias = mainTableMatch[2];
    const hasRealAlias = possAlias && !RESERVED.has(possAlias.toUpperCase());
    tableAliasMap[tableName.toLowerCase()] = {
      original: tableName,
      alias: hasRealAlias ? possAlias : `t${counter}`,
      hadAlias: !!hasRealAlias,
    };
    counter++;
  }

  // Parse JOIN tables
  const joinParseRegex = /(?:INNER|LEFT(?:\s+OUTER)?|RIGHT(?:\s+OUTER)?|FULL(?:\s+OUTER)?|CROSS)?\s*JOIN\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/gi;
  let jm;
  while ((jm = joinParseRegex.exec(fromSection)) !== null) {
    const tableName = jm[1];
    const possAlias = jm[2];
    const hasRealAlias = possAlias && !RESERVED.has(possAlias.toUpperCase());
    const key = tableName.toLowerCase();
    if (!tableAliasMap[key]) {
      tableAliasMap[key] = {
        original: tableName,
        alias: hasRealAlias ? possAlias : `t${counter}`,
        hadAlias: !!hasRealAlias,
      };
      counter++;
    }
  }

  // If every table already has an alias, no normalization needed
  const needsNorm = Object.values(tableAliasMap).some(v => !v.hadAlias);
  if (!needsNorm) return sql;

  // Sort by table name length DESC to prevent partial replacements
  const sortedEntries = Object.entries(tableAliasMap)
    .sort((a, b) => b[1].original.length - a[1].original.length);

  let result = sql;

  // STEP 1: Replace db.table.column -> alias.column throughout SQL
  for (const [, info] of sortedEntries) {
    const { original, alias } = info;
    // Escape dots in regex (db.table -> db\.table)
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\./g, '\\.');
    const colRefRegex = new RegExp(`\\b${escaped}\\.([a-zA-Z0-9_]+)`, 'gi');
    result = result.replace(colRefRegex, `${alias}.$1`);
  }

  // STEP 2: In FROM/JOIN clauses, insert alias after tables that had none
  for (const [, info] of sortedEntries) {
    if (info.hadAlias) continue;
    const { original, alias } = info;
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\./g, '\\.');
    // Match the table name in FROM/JOIN context followed by a JOIN keyword, ON, or end of clause
    const addAliasRegex = new RegExp(
      `(\\b(?:FROM|JOIN)\\s+)(${escaped})((?=\\s+(?:INNER|LEFT|RIGHT|FULL|CROSS|JOIN|ON|WHERE|GROUP|HAVING|ORDER|LIMIT|;))|(?=[\\s]*$)|(?=[\\s]*[,;]))`,
      'gi'
    );
    result = result.replace(addAliasRegex, `$1$2 ${alias}$3`);
  }

  return result;
};

/* --- UPDATED PARSER UTILITY --- */
export const parseQueryToState = (sql) => {
  if (!sql) return { parsedCards: [], parsedJoins: [] };

  // 1. Basic cleanup — also strip trailing semicolons so GROUP BY "1,2,...,8;" is parsed correctly
  let cleanSql = sql.replace(/\n/g, " ").replace(/\s+/g, " ").trim().replace(/;+\s*$/, '');
  
  const parsedCards = [];
  const parsedJoins = [];
  const aliasMap = {}; // alias -> cardId
  const selectListMap = []; // Index -> { type: 'col'|'agg', cardId, column, func, alias }

  // 2. Extract Clauses
  const fromIndex = cleanSql.toUpperCase().indexOf("FROM ");
  const whereIndex = cleanSql.toUpperCase().indexOf(" WHERE ");
  const groupIndex = cleanSql.toUpperCase().indexOf(" GROUP BY ");
  const havingIndex = cleanSql.toUpperCase().indexOf(" HAVING ");
  const orderIndex = cleanSql.toUpperCase().indexOf(" ORDER BY ");

  const idxFrom = fromIndex;
  const idxWhere = whereIndex > -1 ? whereIndex : (groupIndex > -1 ? groupIndex : (havingIndex > -1 ? havingIndex : (orderIndex > -1 ? orderIndex : cleanSql.length)));
  const idxGroup = groupIndex > -1 ? groupIndex : (havingIndex > -1 ? havingIndex : (orderIndex > -1 ? orderIndex : cleanSql.length));
  const idxHaving = havingIndex > -1 ? havingIndex : (orderIndex > -1 ? orderIndex : cleanSql.length);
  const idxOrder = orderIndex > -1 ? orderIndex : cleanSql.length;

  const selectSection = cleanSql.substring(6, idxFrom).trim(); 
  const fromSection = cleanSql.substring(idxFrom + 5, idxWhere).trim();
  const whereSection = whereIndex > -1 ? cleanSql.substring(idxWhere + 7, idxGroup).trim() : "";
  const groupSection = groupIndex > -1 ? cleanSql.substring(idxGroup + 10, idxHaving).trim() : "";
  const havingSection = havingIndex > -1 ? cleanSql.substring(idxHaving + 8, idxOrder).trim() : "";
  const orderSection = orderIndex > -1 ? cleanSql.substring(idxOrder + 10).trim() : "";

  let cardCounter = 0;

  // --- PARSE FROM & JOINS ---
  const mainTableRegex = /^([a-zA-Z0-9_.]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/i;
  const mainTableMatch = fromSection.match(mainTableRegex);
  
  if (mainTableMatch) {
      const fullTableName = mainTableMatch[1];
      const alias = mainTableMatch[2] || "t1";
      const [db, table] = fullTableName.includes(".") ? fullTableName.split(".") : ["default", fullTableName];
      const cardId = `${db}.${table}`;
      aliasMap[alias] = cardId;
      
      parsedCards.push({
          id: cardId, db, table, alias,
          x: 20, y: 20, width: 190, height: 200, isCollapsed: false,
          columns: [], selectedColumns: [], whereConditions: [], havingConditions: [],
          groupBy: [], orderBy: [], aggregates: [], zIndex: 1,
          columnSelectOrder: {}
      });
      cardCounter++;
  }

  const joinRegex = /(INNER|LEFT(?:\s+OUTER)?|RIGHT(?:\s+OUTER)?|FULL(?:\s+OUTER)?|CROSS)?\s*JOIN\s+([a-zA-Z0-9_.]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?(?:\s+ON\s+\(?\s*([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)\s*\)?)?/gi;

  let joinMatch;
  while ((joinMatch = joinRegex.exec(fromSection)) !== null) {
      const rawType = joinMatch[1] ? joinMatch[1].replace(/\s+/g, ' ').trim().toUpperCase() : "INNER";
      // Normalise: "CROSS" → "CROSS JOIN", "LEFT OUTER" → "LEFT OUTER JOIN", etc.
      let type;
      if (rawType === 'CROSS') {
        type = 'CROSS JOIN';
      } else {
        type = rawType.includes("JOIN") ? rawType : `${rawType} JOIN`;
      }
      
      const fullTableName = joinMatch[2];
      const alias = joinMatch[3] || `t${cardCounter + 1}`;
      const leftOp = joinMatch[4]; // undefined for CROSS JOIN (no ON)
      const rightOp = joinMatch[5]; // undefined for CROSS JOIN (no ON)

      const [db, table] = fullTableName.includes(".") ? fullTableName.split(".") : ["default", fullTableName];
      const cardId = `${db}.${table}`;
      aliasMap[alias] = cardId;

      if (!parsedCards.find(c => c.id === cardId)) {
          parsedCards.push({
            id: cardId, db, table, alias,
            x: 20 + (parsedCards.length * 240), y: 20,
            width: 190, height: 200, isCollapsed: false,
            columns: [], selectedColumns: [], whereConditions: [], havingConditions: [],
            groupBy: [], orderBy: [], aggregates: [], zIndex: 1,
            columnSelectOrder: {}
          });
          cardCounter++;
      }

      if (type === 'CROSS JOIN') {
        // CROSS JOIN has no ON clause — link to the card that came before this one
        const prevCard = parsedCards.length >= 2 ? parsedCards[parsedCards.length - 2] : parsedCards[0];
        if (prevCard && prevCard.id !== cardId) {
          parsedJoins.push({
            id: Date.now() + Math.random(),
            leftTableId: prevCard.id, leftCol: '',
            rightTableId: cardId, rightCol: '',
            type: 'CROSS JOIN'
          });
        }
      } else if (leftOp && rightOp) {
        // Standard join with ON clause
        const [lAlias, lCol] = leftOp.includes(".") ? leftOp.split(".") : [null, leftOp];
        const [rAlias, rCol] = rightOp.includes(".") ? rightOp.split(".") : [null, rightOp];

        const leftTableId = aliasMap[lAlias];
        const rightTableId = aliasMap[rAlias];

        if (leftTableId && rightTableId) {
            parsedJoins.push({
                id: Date.now() + Math.random(),
                leftTableId, leftCol: lCol,
                rightTableId, rightCol: rCol,
                type: type.trim().replace(/\s+/g, " ")
            });
        }
      }
  }

  // --- PARSE SELECT ---
  // Handle SELECT * — mark all cards for full column selection
  const trimmedSelect = selectSection.trim();
  if (trimmedSelect === '*') {
    parsedCards.forEach(card => { card.selectAll = true; });
  }

  const selectParts = splitByCommaIgnoreBrackets(selectSection);
  selectParts.forEach((part, index) => {
    // Handle alias.* (e.g. t1.*)
    const starMatch = part.trim().match(/^([a-zA-Z0-9_]+)\.\*$/);
    if (starMatch) {
      const tAlias = starMatch[1];
      const cardId = aliasMap[tAlias];
      const card = parsedCards.find(c => c.id === cardId);
      if (card) card.selectAll = true;
      return;
    }
      // Check Aggregate: func(alias.col)
      const aggMatch = part.match(/^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([a-zA-Z0-9_.]+)\s*\)(?:\s+AS\s+([a-zA-Z0-9_]+))?/i);
      
      if (aggMatch) {
          const func = aggMatch[1].toUpperCase();
          const fullCol = aggMatch[2];
          const aliasName = aggMatch[3] || "";
          const [tAlias, tCol] = fullCol.includes(".") ? fullCol.split(".") : [null, fullCol];

          const cardId = aliasMap[tAlias];
          const card = parsedCards.find(c => c.id === cardId) || parsedCards[0];
          
          if (card) {
              card.aggregates.push({ func, column: tCol, alias: aliasName, cardId: card.id, selectIndex: index + 1 });
              
              // Map for Group By 1,2..
              selectListMap.push({ 
                  type: 'agg', 
                  index: index + 1, 
                  cardId: card.id, 
                  column: tCol, 
                  func,
                  alias: aliasName
              });
          }
      } else {
          // Column: alias.col
          const colPart = part.split(/\s+AS\s+/i)[0]; 
          const [tAlias, tCol] = colPart.includes(".") ? colPart.split(".") : [null, colPart];
          
          if (tAlias && aliasMap[tAlias]) {
              const cardId = aliasMap[tAlias];
              const card = parsedCards.find(c => c.id === cardId);
              if (card) {
                  if(!card.selectedColumns.includes(tCol)) {
                      card.selectedColumns.push(tCol);
                  }
                  // Track select position for correct ordering in SELECT/GROUP BY
                  if (!card.columnSelectOrder) card.columnSelectOrder = {};
                  card.columnSelectOrder[tCol] = index + 1;
                  // Map for Group By 1,2..
                  selectListMap.push({ 
                      type: 'col', 
                      index: index + 1, 
                      cardId: card.id, 
                      column: tCol 
                  });
              }
          } else {
              selectListMap.push({ type: 'unknown', index: index + 1 });
          }
      }
  });

  // --- PARSE WHERE ---
  if (whereSection) {
      const cleanWhere = stripOuterParens(whereSection);
      // Use new smart splitter
      const conditions = splitConditions(cleanWhere);

      // Helper: parse a single atomic (non-compound) condition string and push to correct card.
      // This is needed because multi-condition groups for one table are wrapped in parens,
      // e.g. "(t1.a = 1 AND t1.b > 5)" — after outer split + stripOuterParens we get
      // "t1.a = 1 AND t1.b > 5" which must be re-split before atomic matching.
      // Without this, stdMatch greedily captures the trailing " AND t1.b > 5" as the value.
      const parseAtomicCond = (cleanCond) => {
          // Helper: resolve alias+col from a "alias.col" or bare "col" reference.
          // When there is no dot, search all parsedCards for a matching column name
          // and default to the first table that owns it (or the very first card).
          const resolveColRef = (fullCol) => {
              if (fullCol.includes(".")) {
                  const dotIdx = fullCol.indexOf(".");
                  const alias = fullCol.substring(0, dotIdx);
                  const col   = fullCol.substring(dotIdx + 1);
                  const cardId = aliasMap[alias];
                  const card = parsedCards.find(c => c.id === cardId);
                  return { alias, col, cardId, card };
              }
              // No alias — treat fullCol as a bare column name; search cards for it
              const col = fullCol;
              // First look for a card whose selectedColumns already includes this col
              let card = parsedCards.find(c => c.selectedColumns && c.selectedColumns.includes(col));
              // Fallback: first card (the main FROM table)
              if (!card) card = parsedCards[0];
              const cardId = card ? card.id : null;
              return { alias: null, col, cardId, card };
          };

          // Handle BETWEEN
          const betweenMatch = cleanCond.match(/([a-zA-Z0-9_.]+)\s+BETWEEN\s+'?([^']+)'?\s+AND\s+'?([^']+)'?/i);
          if (betweenMatch) {
              const [fullCol, val1, val2] = betweenMatch;
              const { col, cardId, card } = resolveColRef(fullCol);
              if (card) {
                  card.whereConditions.push({
                      logic: "AND", column: col, operator: "BETWEEN", value: val1, value2: val2,
                      cardId, openBracket: "", closeBracket: ""
                  });
              }
              return;
          }

          // Handle IN
          const inMatch = cleanCond.match(/([a-zA-Z0-9_.]+)\s+(IN|NOT IN)\s*\((.+)\)/i);
          if (inMatch) {
              const [fullCol, op, valStr] = inMatch;
              const { col, cardId, card } = resolveColRef(fullCol);
              if (card) {
                  const cleanedVals = valStr.split(",").map(v => v.trim().replace(/^'|'$/g, "")).join(",");
                  card.whereConditions.push({
                      logic: "AND", column: col, operator: op.toUpperCase(), value: cleanedVals,
                      cardId, openBracket: "", closeBracket: ""
                  });
              }
              return;
          }

          // Handle Standard Ops
          const stdMatch = cleanCond.match(/([a-zA-Z0-9_.]+)\s*(=|!=|<>|>|<|>=|<=|LIKE|IS NULL|IS NOT NULL)\s*(.*)/i);
          if (stdMatch) {
               const [fullCol, op, valRaw] = stdMatch;
               const { col, cardId, card } = resolveColRef(fullCol);

               let val = valRaw ? valRaw.trim() : "";
               if ((val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);

               if (card) {
                  card.whereConditions.push({
                      logic: "AND", column: col, operator: op.toUpperCase(), value: val,
                      cardId, openBracket: "", closeBracket: ""
                  });
               }
          }
      }; // end parseAtomicCond

      conditions.forEach(condStr => {
          const cleanCond = stripOuterParens(condStr);

          // Re-split in case this group contains multiple AND conditions for the same table
          // (e.g. "(t1.a = 1 AND t1.b > 5)" after outer split and stripOuterParens becomes
          // "t1.a = 1 AND t1.b > 5", which must be re-split before atomic matching).
          const subConditions = splitConditions(cleanCond);
          if (subConditions.length > 1) {
              subConditions.forEach(sub => parseAtomicCond(stripOuterParens(sub)));
          } else {
              parseAtomicCond(cleanCond);
          }
      });
  }

  // --- PARSE GROUP BY ---
  if (groupSection) {
      const groups = splitByCommaIgnoreBrackets(groupSection);
      let groupSeq = 1; // Track exact group sequence from query to preserve order
      groups.forEach(g => {
          const trimmed = g.trim();
          
          // Case A: Positional (1, 2, 3)
          if (/^\d+$/.test(trimmed)) {
              const idx = parseInt(trimmed);
              const mapped = selectListMap.find(m => m.index === idx);
              
              if (mapped && mapped.cardId && mapped.column) {
                  const card = parsedCards.find(c => c.id === mapped.cardId);
                  if (card) {
                      if (mapped.type === 'agg') {
                          // Added groupByOrder to track global positioning accurately
                          card.groupBy.push({ column: mapped.column, cardId: mapped.cardId, isAggregate: true, func: mapped.func, groupByOrder: groupSeq++ });
                      } else {
                          // Added groupByOrder to track global positioning accurately
                          card.groupBy.push({ column: mapped.column, cardId: mapped.cardId, groupByOrder: groupSeq++ });
                      }
                  }
              }
          } 
          // Case B: Column Name (t2.dt)
          else {
              const [tAlias, tCol] = trimmed.includes(".") ? trimmed.split(".") : [null, trimmed];
              if (tAlias && aliasMap[tAlias]) {
                  const cardId = aliasMap[tAlias];
                  const card = parsedCards.find(c => c.id === cardId);
                  if (card) {
                      card.groupBy.push({ column: tCol, cardId, groupByOrder: groupSeq++ });
                  }
              }
          }
      });
  }

  // --- PARSE HAVING ---
  if (havingSection) {
     const hParts = splitConditions(stripOuterParens(havingSection));
     hParts.forEach(part => {
         const hMatch = part.match(/(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([a-zA-Z0-9_.]+)\s*\)\s*(=|!=|>|<|>=|<=)\s*(.+)/i);
         if (hMatch) {
             const func = hMatch[1].toUpperCase();
             const fullCol = hMatch[2];
             const op = hMatch[3];
             let val = hMatch[4].trim();
             if (val.startsWith("'")) val = val.slice(1, -1);

             const [alias, col] = fullCol.split(".");
             const cardId = aliasMap[alias];
             const card = parsedCards.find(c => c.id === cardId) || parsedCards[0];
             
             if (card) {
                 card.havingConditions.push({
                     logic: "AND", func, column: col, operator: op, value: val, cardId: card.id
                 });
             }
         }
     });
  }

  // --- PARSE ORDER BY ---
  if (orderSection) {
      const orders = splitByCommaIgnoreBrackets(orderSection);
      orders.forEach(o => {
          const parts = o.trim().split(/\s+/);
          const dir = ["ASC", "DESC"].includes(parts[parts.length-1].toUpperCase()) ? parts.pop().toUpperCase() : "ASC";
          const colRaw = parts.join(" "); 
          
          const [tAlias, tCol] = colRaw.includes(".") ? colRaw.split(".") : [null, colRaw];
          if (tAlias && aliasMap[tAlias]) {
              const cardId = aliasMap[tAlias];
              const card = parsedCards.find(c => c.id === cardId);
              if (card) card.orderBy.push({ column: tCol, direction: dir, cardId });
          }
      });
  }

  return { parsedCards, parsedJoins };
};

export function useQueryBuilder() {
  const [generatedQuery, setGeneratedQuery] = useState("");

  const generateAliasMap = (cards) => {
    const map = {};
    cards.forEach((card, index) => {
      map[card.id] = card.alias || `t${index + 1}`;
    });
    return map;
  };

  const processConditions = (card, defaultAlias, aliasMap) => {
    if (!card.whereConditions || card.whereConditions.length === 0) return "";

    const validConditions = card.whereConditions.filter(cond => {
      if (!cond.column) return false;
      const isNullOp = ["IS NULL", "IS NOT NULL"].includes(cond.operator);
      if (!isNullOp) {
        if (cond.operator === "BETWEEN") return cond.value && cond.value2;
        return cond.value !== undefined && cond.value !== ""; 
      }
      return true;
    });

    if (validConditions.length === 0) return "";

    return validConditions.map((cond, index) => {
        const open = cond.openBracket || "";
        const close = cond.closeBracket || "";
        const prefix = index > 0 ? ` ${cond.logic} ` : "";
        
        let targetAlias = defaultAlias;
        if (cond.cardId) {
            targetAlias = aliasMap[cond.cardId] || defaultAlias;
        }

        const fullCol = `${targetAlias}.${cond.column}`;

        let valPart = "";
        if (["IS NULL", "IS NOT NULL"].includes(cond.operator)) {
            valPart = "";
        } else if (cond.operator === "BETWEEN") {
            valPart = ` '${cond.value}' AND '${cond.value2}'`;
        } else if (["IN", "NOT IN"].includes(cond.operator)) {
            const rawVal = cond.value.trim();
            // If value already has outer parens, use as-is; otherwise wrap
            if (rawVal.startsWith("(") && rawVal.endsWith(")")) {
                valPart = ` ${rawVal}`;
            } else {
                // Re-quote individual string values (non-numeric)
                const vals = rawVal.split(",").map(v => {
                    const t = v.trim();
                    if (t === "") return t;
                    const isNum = !isNaN(parseFloat(t)) && isFinite(t);
                    return isNum ? t : `'${t}'`;
                });
                valPart = ` (${vals.join(", ")})`;
            }
        } else {
            const isNumber = !isNaN(parseFloat(cond.value)) && isFinite(cond.value);
            const val = isNumber ? cond.value : `'${cond.value}'`;
            valPart = ` ${val}`;
        }
        
        return `${prefix}${open}${fullCol} ${cond.operator}${valPart}${close}`;
    }).join("");
  };

  const processHavingConditions = (card, defaultAlias, allCards, aliasMap) => {
    if (!card.havingConditions || card.havingConditions.length === 0) return "";

    const validConditions = card.havingConditions.filter(cond => {
        return cond.func && cond.column && cond.value !== undefined && cond.value !== "";
    });

    if (validConditions.length === 0) return "";

    return validConditions.map((cond, index) => {
        const prefix = index > 0 ? ` ${cond.logic} ` : "";
        
        let targetAlias = defaultAlias;
        if (cond.cardId) {
            targetAlias = aliasMap[cond.cardId] || defaultAlias;
        }
        
        const fullCol = `${targetAlias}.${cond.column}`;
        const isNumber = !isNaN(parseFloat(cond.value)) && isFinite(cond.value);
        const val = isNumber ? cond.value : `'${cond.value}'`;
        return `${prefix}${cond.func}(${fullCol}) ${cond.operator} ${val}`;
    }).join("");
  };

  const buildQueryString = (cards, activeCardId, joins, isDownloadMode) => {
    const aliasMap = generateAliasMap(cards);

    // Build Select
    const buildSelectClause = () => {
        let allItemsWithOrder = [];

        const MAX_IDX = 1000000;

        // 1. Columns — collected with their original SELECT position
        cards.forEach(card => {
            const alias = aliasMap[card.id];

            // If this card has selectAll enabled, emit alias.* and skip individual columns
            if (card.selectAll) {
                // Give it a very early order so it sorts before any explicit columns/aggregates
                allItemsWithOrder.push({ order: -1, expr: `${alias}.*`, displayExpr: `${alias}.*` });
                return; // skip selectedColumns loop for this card
            }

            if(card.selectedColumns && card.selectedColumns.length > 0){
                card.selectedColumns.forEach((col, colArrayIdx) => {
                    // Use stored select index if available (set during query parsing), else append
                    const selectIdx = (card.columnSelectOrder && card.columnSelectOrder[col] !== undefined)
                        ? card.columnSelectOrder[col]
                        : MAX_IDX + colArrayIdx;
                    const baseCol = `${alias}.${col}`;
                    const displayExpr = isDownloadMode
                        ? `${baseCol} AS \`${card.table}.${col}\``
                        : baseCol;
                    allItemsWithOrder.push({ order: selectIdx, expr: baseCol, displayExpr });
                });
            }
        });
        
        // 2. Aggregates — collected with their original SELECT position
        cards.forEach(card => {
            if(card.aggregates && card.aggregates.length > 0) {
                card.aggregates.forEach((agg, aggArrayIdx) => {
                    if(agg.func && agg.column) {
                        let targetAlias;
                        if (agg.cardId) {
                            targetAlias = aliasMap[agg.cardId];
                        } else {
                            targetAlias = aliasMap[card.id];
                        }
                        const aggExpr = `${agg.func}(${targetAlias}.${agg.column})`;
                        const aliasPart = agg.alias ? ` AS ${agg.alias}` : "";
                        // Use stored select index if available (set during query parsing), else append after columns
                        const selectIdx = agg.selectIndex !== undefined
                            ? agg.selectIndex
                            : MAX_IDX + 500 + aggArrayIdx;
                        allItemsWithOrder.push({ order: selectIdx, expr: aggExpr, displayExpr: `${aggExpr}${aliasPart}` });
                    }
                });
            }
        });

        // Sort everything by the original SELECT position to maintain query-defined order
        allItemsWithOrder.sort((a, b) => a.order - b.order);
        const allItems = allItemsWithOrder.map(item => item.displayExpr);
        return allItems.length > 0 ? allItems.join(",\n  ") : "*";
    };

    // Build Order By
    const buildOrderByClause = () => {
        let allOrders = [];
        cards.forEach(card => {
            if(card.orderBy && card.orderBy.length > 0) {
                const defaultAlias = aliasMap[card.id];
                const validOrders = card.orderBy.filter(o => o.column && o.column.trim() !== "");
                const formattedOrders = validOrders.map(o => {
                    let targetAlias = defaultAlias;
                    if (o.cardId) targetAlias = aliasMap[o.cardId] || defaultAlias;
                    return `${targetAlias}.${o.column} ${o.direction}`;
                });
                allOrders.push(...formattedOrders);
            }
        });
        if (allOrders.length === 0) return "";
        return `ORDER BY ${allOrders.join(", ")}`;
    };

    // Single Table Mode
    if (!joins || joins.length === 0) {
      const activeCard = activeCardId ? cards.find((c) => c.id === activeCardId) : (cards.length === 1 ? cards[0] : null);

      if (!activeCard) {
        return "-- Select a table or drag dots to join tables to generate a query";
      }

      const { db, table, groupBy, id } = activeCard;
      const alias = aliasMap[id];
      const selectClause = buildSelectClause();
      const fromClause = `${db}.${table} ${alias}`;
      
      const conditionStr = processConditions(activeCard, alias, aliasMap);
      const whereClause = conditionStr ? `WHERE\n  ${conditionStr}` : "";

      let groupByClause = "";
      if (groupBy && groupBy.length > 0) {
        const validGroups = groupBy.filter((g) => {
             if (typeof g === 'object') return g.column && g.column.trim() !== "";
             return g && g.trim() !== "";
        });
        
        if (validGroups.length > 0) {
            const groupStrs = validGroups.map(g => {
                let targetAlias = alias;
                let colName = "";
                let isAgg = false;
                let aggFunc = "";

                if (typeof g === 'object') {
                    if (g.cardId) targetAlias = aliasMap[g.cardId] || alias;
                    colName = g.column;
                    isAgg = !!g.isAggregate;
                    aggFunc = g.func || "";
                } else {
                    colName = g;
                }

                if (isAgg && aggFunc) {
                    // Output the full aggregate expression (e.g. COUNT(t1.col)) instead of
                    // a positional number so GROUP BY is always readable and unambiguous.
                    // The parser (parseQueryToState) still accepts positional numbers when
                    // the user edits the query manually via Edit Query mode.
                    const fullAggExpr = `${aggFunc}(${targetAlias}.${colName})`;
                    return fullAggExpr;
                }

                // Output the full qualified column name (e.g. t1.col) instead of a
                // positional number for readability and Edit-Query compatibility.
                const fullColName = `${targetAlias}.${colName}`;
                return fullColName;
            });
            groupByClause = `GROUP BY\n  ${groupStrs.join(",\n  ")}`;
        }
      }

      const havingStr = processHavingConditions(activeCard, alias, cards, aliasMap);
      const havingClause = havingStr ? `HAVING\n  ${havingStr}` : "";
      const orderByClause = buildOrderByClause();
      const orderClauseFinal = orderByClause ? `\n${orderByClause}` : "";

      let query = `SELECT\n  ${selectClause}\nFROM\n  ${fromClause}`;
      if (whereClause) query += `\n${whereClause}`;
      if (groupByClause) query += `\n${groupByClause}`;
      if (havingClause) query += `\n${havingClause}`;
      if (orderClauseFinal) query += orderClauseFinal;
      query += ";";
      
      return query;
    }

    // Multi Table Mode

    // ── Safety guard: strip any joins whose referenced cards no longer exist.
    // This prevents "Invalid base table" errors when the user removes tables
    // that were previously part of a join configuration.
    // For self-joins (leftTableId === rightTableId), only leftTableId needs to exist.
    const cardIdSet = new Set(cards.map(c => c.id));
    const validJoins = joins.filter(j => {
      if (j.leftTableId === j.rightTableId) return cardIdSet.has(j.leftTableId);
      return cardIdSet.has(j.leftTableId) && cardIdSet.has(j.rightTableId);
    });

    // If all joins reference removed cards, fall back to single-table mode
    // for each remaining card (generate per-card queries or a simple no-join query).
    if (validJoins.length === 0) {
      const selectClauseFallback = buildSelectClause();
      if (cards.length === 0) return "-- No tables selected";
      const firstCard = cards[0];
      const firstAlias = aliasMap[firstCard.id];
      return `SELECT\n  ${selectClauseFallback}\nFROM\n  ${firstCard.db}.${firstCard.table} ${firstAlias};`;
    }

    const selectClause = buildSelectClause();
    
    const firstJoin = validJoins[0];
    const baseTableId = firstJoin.leftTableId;
    const baseCard = cards.find(c => c.id === baseTableId);
    
    if(!baseCard) {
        return "-- Error: Invalid base table in join configuration";
    }

    const baseAlias = aliasMap[baseCard.id];
    let fromClause = `${baseCard.db}.${baseCard.table} ${baseAlias}`;
    let joinClauses = "";

    validJoins.forEach(join => {
        const left = cards.find(c => c.id === join.leftTableId);
        const right = cards.find(c => c.id === join.rightTableId);
        if(left && right) {
            const joinType = join.type || "INNER JOIN";
            const leftAlias = aliasMap[left.id];
            const rightAlias = aliasMap[right.id];
            const isSelfJoin = join.leftTableId === join.rightTableId;
            if (joinType === 'CROSS JOIN') {
                // CROSS JOIN has no ON clause
                joinClauses += `\n  CROSS JOIN ${right.db}.${right.table} ${rightAlias}`;
            } else if (isSelfJoin) {
                // Self-join: same table aliased once; ON references the same alias for both sides
                joinClauses += `\n  ${joinType} ${right.db}.${right.table} ${rightAlias} ON ${leftAlias}.${join.leftCol} = ${rightAlias}.${join.rightCol}`;
            } else {
                joinClauses += `\n  ${joinType} ${right.db}.${right.table} ${rightAlias} ON ${leftAlias}.${join.leftCol} = ${rightAlias}.${join.rightCol}`;
            }
        }
    });

    let allConditionsStr = [];
    cards.forEach(card => {
        const alias = aliasMap[card.id];
        const conditionStr = processConditions(card, alias, aliasMap);
        if (conditionStr) {
            // Use the first condition's logic field as the connector to the previous group
            // (only applies when there is already a previous condition group)
            const firstCond = card.whereConditions && card.whereConditions.find(
                c => c.column && (["IS NULL","IS NOT NULL"].includes(c.operator) || (c.value !== undefined && c.value !== ""))
            );
            const interLogic = (allConditionsStr.length > 0 && firstCond && firstCond.logic)
                ? firstCond.logic
                : "AND";
            allConditionsStr.push({ str: `(${conditionStr})`, logic: interLogic });
        }
    });
    const whereClause = allConditionsStr.length > 0
        ? `WHERE\n  ${allConditionsStr.map((item, i) => i === 0 ? item.str : `${item.logic}\n  ${item.str}`).join("\n  ")}`
        : "";

    // GROUP BY (Updated to track sequence and ignore Canvas table order)
    let allGroupsObjs = [];
    let defaultGroupOrder = 10000; // Acts as fallback for groups added manually via UI where sequence is not known
    
    cards.forEach(card => {
        if(card.groupBy && card.groupBy.length > 0) {
            const alias = aliasMap[card.id];
            card.groupBy.forEach(g => {
                let targetAlias = alias;
                let colName = "";
                let isAgg = false;
                let aggFunc = "";
                let order = defaultGroupOrder;

                if (typeof g === 'string') {
                    if (!g.trim()) return;
                    colName = g;
                    order = defaultGroupOrder++;
                } else if (g.column && g.column.trim()) {
                    if (g.cardId) targetAlias = aliasMap[g.cardId] || alias;
                    colName = g.column;
                    isAgg = !!g.isAggregate;
                    aggFunc = g.func || "";
                    if (g.groupByOrder !== undefined) {
                        order = g.groupByOrder;
                    } else {
                        order = defaultGroupOrder++;
                    }
                } else {
                    return;
                }

                if (isAgg && aggFunc) {
                    // Output the full aggregate expression (e.g. COUNT(t1.col)) instead of
                    // a positional number so GROUP BY is always readable and unambiguous.
                    // The parser (parseQueryToState) still accepts positional numbers when
                    // the user edits the query manually via Edit Query mode.
                    const fullAggExpr = `${aggFunc}(${targetAlias}.${colName})`;
                    allGroupsObjs.push({ str: fullAggExpr, order });
                    return;
                }

                // Output the full qualified column name (e.g. t1.col) instead of a
                // positional number for readability and Edit-Query compatibility.
                const fullColName = `${targetAlias}.${colName}`;
                allGroupsObjs.push({ str: fullColName, order });
            });
        }
    });

    // Sort globally by the extracted parsing sequence order, completely bypassing the array's native alphabetical order
    allGroupsObjs.sort((a, b) => a.order - b.order);
    const allGroups = allGroupsObjs.map(obj => obj.str);
    const groupByClause = allGroups.length > 0 ? `GROUP BY\n  ${allGroups.join(",\n  ")}` : "";

    let allHavingStr = [];
    cards.forEach(card => {
        const alias = aliasMap[card.id];
        const havingStr = processHavingConditions(card, alias, cards, aliasMap);
        if (havingStr) allHavingStr.push(`(${havingStr})`);
    });
    const havingClause = allHavingStr.length > 0 ? `HAVING\n  ${allHavingStr.join(" AND\n  ")}` : "";

    const orderByClause = buildOrderByClause();
    const orderClauseFinal = orderByClause ? `\n${orderByClause}` : "";

    let query = `SELECT\n  ${selectClause}\nFROM\n  ${fromClause}${joinClauses}`;
    if (whereClause) query += `\n${whereClause}`;
    if (groupByClause) query += `\n${groupByClause}`;
    if (havingClause) query += `\n${havingClause}`;
    if (orderClauseFinal) query += orderClauseFinal;
    query += ";";
    
    return query;
  };

  const createQuery = (cards, activeCardId, joins = []) => {
    const sql = buildQueryString(cards, activeCardId, joins, false);
    setGeneratedQuery(sql);
    return sql; // Return it so the UI can force update
  };

  const resetQuery = () => {
    setGeneratedQuery("");
  };

  const getDownloadSQL = (cards, activeCardId, joins = []) => {
    return buildQueryString(cards, activeCardId, joins, true);
  };

  return {
    generatedQuery,
    createQuery,
    resetQuery,
    getDownloadSQL, 
  };
};
