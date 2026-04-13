"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { DataContext } from "@/hooks/use-data";
import type { Athlete, Coach, TrainingTypeRecord, Session } from "@/hooks/use-data";
import demoData from "@/data.json";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function getCurrentMondayISO(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 + 7 : (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7) + (day === 0 ? 7 : 0));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [trainingTypes, setTrainingTypes] = useState<TrainingTypeRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getCurrentMondayISO);
  const initialLoaded = useRef(false);

  // Single fetch for all data
  const fetchAll = useCallback(async (ws?: string) => {
    if (DEMO_MODE) {
      setAthletes(demoData.athletes as unknown as Athlete[]);
      setCoaches(demoData.coaches as unknown as Coach[]);
      setTrainingTypes(demoData.trainingTypes as unknown as TrainingTypeRecord[]);
      setSessions(demoData.sessions as unknown as Session[]);
      return;
    }
    try {
      const res = await fetch(`/api/init?weekStart=${ws || weekStart}`);
      if (res.ok) {
        const data = await res.json();
        setAthletes(data.athletes);
        setCoaches(data.coaches);
        setTrainingTypes(data.trainingTypes);
        setSessions(data.sessions);
      }
    } catch {}
  }, [weekStart]);

  // Initial load
  useEffect(() => {
    if (!initialLoaded.current) {
      initialLoaded.current = true;
      setLoading(true);
      fetchAll().finally(() => setLoading(false));
    }
  }, []);

  // Refetch sessions when week changes
  useEffect(() => {
    if (initialLoaded.current) {
      fetch(`/api/sessions?weekStart=${weekStart}`)
        .then(r => r.ok ? r.json() : [])
        .then(setSessions)
        .catch(() => {});
    }
  }, [weekStart]);

  // Individual refetch functions (lightweight - only fetch what changed)
  const refetchAthletes = useCallback(async () => {
    try {
      const res = await fetch("/api/athletes");
      if (res.ok) setAthletes(await res.json());
    } catch {}
  }, []);

  const refetchCoaches = useCallback(async () => {
    try {
      const res = await fetch("/api/coaches");
      if (res.ok) setCoaches(await res.json());
    } catch {}
  }, []);

  const refetchTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/training-types");
      if (res.ok) setTrainingTypes(await res.json());
    } catch {}
  }, []);

  const refetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions?weekStart=${weekStart}`);
      if (res.ok) setSessions(await res.json());
    } catch {}
  }, [weekStart]);

  return (
    <DataContext.Provider value={{
      athletes, coaches, trainingTypes, sessions, loading,
      refetchAthletes, refetchCoaches, refetchTypes, refetchSessions,
      weekStart, setWeekStart,
    }}>
      {children}
    </DataContext.Provider>
  );
}
