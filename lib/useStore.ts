"use client";

import { useEffect, useRef, useState } from "react";
import type { Transaction } from "./parse";

export type Import = {
  id: string;
  account: string;
  fileName: string;
  importedAt: string;
  flipped: boolean;
  added: number;
  duplicates: number;
};

export type StoreData = { transactions: Transaction[]; imports: Import[] };
export type SaveState = "loading" | "saved" | "saving" | "error";

/** Loads your saved data from the server and writes it back automatically whenever it changes. */
export function useStore() {
  const [data, setData] = useState<StoreData>({ transactions: [], imports: [] });
  const [status, setStatus] = useState<SaveState>("loading");
  const loaded = useRef(false);

  useEffect(() => {
    fetch("/api/store")
      .then((r) => r.json())
      .then((d: StoreData) => {
        setData(d);
        setStatus("saved");
        loaded.current = true;
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    setStatus("saving");
    // Wait briefly so a burst of quick edits gets saved in one write.
    const timer = setTimeout(() => {
      fetch("/api/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((r) => setStatus(r.ok ? "saved" : "error"))
        .catch(() => setStatus("error"));
    }, 400);
    return () => clearTimeout(timer);
  }, [data]);

  return { data, setData, status };
}
