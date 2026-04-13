"use client";
import { createContext, useContext } from "react";

export type Risk = "ok" | "atenção" | "alto";
export type Status = "ativo" | "inativo";
export type SessionStatus = "Confirmado" | "Em andamento" | "Concluído" | "Pendente";
export type Intensity = "Baixa" | "Média" | "Alta";

export type Athlete = {
  id: number;
  name: string;
  email: string;
  age: number | null;
  position: string | null;
  isEnabled: boolean;
  goal: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  weight: string | null;
  height: string | null;
  coachId: number | null;
  coach: { name: string } | null;
};

export type Coach = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  color: string;
  isEnabled: boolean;
  _count?: { athletes: number };
};

export type TrainingTypeRecord = {
  id: number;
  name: string;
  category: string;
  isEnabled: boolean;
  isDefault: boolean;
};

export type Session = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  athleteId: number;
  athlete: { id: number; name: string };
  coachId: number;
  coach: { id: number; name: string };
  trainingTypeId: number;
  trainingType: { id: number; name: string };
  status: string;
  location: string;
  psePlanned: number;
  pseActual: number | null;
  psr: number | null;
  duration: number | null;
  summary: string | null;
  completedAt: string | null;
  wellbeing?: any;
  pains?: any[];
  injuries?: any[];
};

export type DataContextType = {
  athletes: Athlete[];
  coaches: Coach[];
  trainingTypes: TrainingTypeRecord[];
  sessions: Session[];
  loading: boolean;
  refetchAthletes: () => void;
  refetchCoaches: () => void;
  refetchTypes: () => void;
  refetchSessions: () => void;
  weekStart: string;
  setWeekStart: (ws: string) => void;
};

export const DataContext = createContext<DataContextType>({
  athletes: [],
  coaches: [],
  trainingTypes: [],
  sessions: [],
  loading: true,
  refetchAthletes: () => {},
  refetchCoaches: () => {},
  refetchTypes: () => {},
  refetchSessions: () => {},
  weekStart: "",
  setWeekStart: () => {},
});

export function useData() {
  return useContext(DataContext);
}
