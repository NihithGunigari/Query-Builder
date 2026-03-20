import { useEffect, useState } from "react";
import {
  getDatabases,
  getTables,
  clearAllCache,
  clearDbCache,
} from "../api";

export function useSidebarData() {
  const [databases, setDatabases] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedDb, setSelectedDb] = useState(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  useEffect(() => {
    refreshAllDbs();
  }, []);

  const refreshAllDbs = async () => {
    setDbLoading(true);
    await clearAllCache();
    const dbs = await getDatabases();
    setDatabases(dbs);
    setDbLoading(false);
  };

  const selectDb = async (db) => {
    setSelectedDb(db);
    setTableLoading(true);
    const t = await getTables(db);
    setTables(t);
    setTableLoading(false);
  };

  const refreshTables = async () => {
    if (!selectedDb) return;
    setTableLoading(true);
    await clearDbCache(selectedDb);
    const t = await getTables(selectedDb);
    setTables(t);
    setTableLoading(false);
  };

  return {
    databases,
    tables,
    selectedDb,
    dbLoading,
    tableLoading,
    selectDb,
    refreshAllDbs,
    refreshTables,
  };
}
