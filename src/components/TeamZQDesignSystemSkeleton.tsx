"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { DndContext, DragOverlay, useDroppable, useDraggable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Dumbbell,
  HeartPulse,
  KanbanSquare,
  LayoutDashboard,
  List,
  Menu,
  Search,
  Shield,
  Table2,
  Timer,
  UserCog,
  UserRound,
  Users,
  ZoomIn,
  ZoomOut,
  X,
  Check,
  MapPin,
  Sun,
  Moon,
  LogOut,
  Settings,
  UserRound as UserIcon,
  Trash2,
  CalendarCheck,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  CalendarIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import rawData from "@/data.json";
import { useData } from "@/hooks/use-data";
import type { Session, Coach as CoachDB, TrainingTypeRecord } from "@/hooks/use-data";
import { useApi, apiPost, apiPut, apiDelete } from "@/hooks/use-api";
import { dayOfWeekKey as getDayKey, formatDateBR } from "@/lib/date-utils";
import { usePermissions, PermissionsContext, resolvePermissions } from "@/hooks/use-permissions";
import type { CurrentUser, UserRole } from "@/hooks/use-permissions";

/* ─── Theme & Coach Color Context ─── */
const ThemeContext = React.createContext<{ isDark: boolean; coachColors: Record<string, string>; setCoachColor: (name: string, color: string) => void }>({ isDark: true, coachColors: {}, setCoachColor: () => {} });
function useTheme() { return React.useContext(ThemeContext); }

type Risk = "ok" | "atenção" | "alto";
type Status = "ativo" | "inativo";
type SessionStatus = "Confirmado" | "Em andamento" | "Concluído" | "Pendente" | "Cancelado";
type Intensity = "Baixa" | "Média" | "Alta";
type PageKey = "dashboard" | "agenda" | "athletes" | "athlete-detail" | "physical-alerts" | "collaborators" | "training-types" | "reports" | "design-system";
type AgendaView = "timeline" | "diaria" | "mensal" | "semana" | "tabela" | "lista" | "kanban" | "personal";

type Athlete = {
  id: number;
  name: string;
  email: string;
  age: number;
  position: string;
  status: Status;
  risk: Risk;
  nextTraining: string;
  coach: string;
  objective: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  weight: string;
  height: string;
  monitoring: {
    acwr: number;
    monotony: number;
    strain: number;
    plannedLoad: number;
    completedLoad: number;
    wellbeing: number;
    sleep: number;
    fatigue: number;
    weeklyLoads: number[];
    weeklyPse: number[];
    acuteLoad: number;
    chronicLoad: number;
    totalMinutes: number;
    sessionsCompleted: number;
    sessionsPlanned: number;
    riskLevel: Risk;
  };
  plannedTrainings: Array<{ day: string; type: string; duration: string; pse: number; load: string }>;
  completedTrainings: Array<{
    day: string; date: string; type: string; duration: string; pse: number; psr: number; load: string; summary: string;
    wellbeing: {
      sleepQuality: string; sleepHours: string; energy: string; stress: string;
      nutrition: string; water: string; pain: string; fatigue: string; mood: string; motivation: string;
    };
    pains: Array<{ area: string; intensity: string; side: string; moment: string; description: string }>;
    injuries: Array<{ type: string; area: string; side: string; grade: string; description: string }>;
  }>;
  pains: Array<{ date: string; area: string; intensity: string; side: string }>;
  injuries: Array<{ date: string; type: string; grade: string; area: string; side: string }>;
};

type Collaborator = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: Status;
  color: string;
  athletes: number;
};

type TrainingType = {
  id: number;
  name: string;
  status: Status;
  isDefault: boolean;
  category: string;
};

type AgendaColumn = { key: string; label: string; date: string };

type AgendaSession = {
  id: number;
  day: string;
  time: string;
  endTime: string;
  athlete: string;
  athleteId?: number;
  type: string;
  coach: string;
  status: SessionStatus;
  location: string;
  intensity: Intensity;
  pse: number;
};

function seededRand(seed: number) { const x = Math.sin(seed) * 10000; return x - Math.floor(x); }
function generateDefaultMonitoring(seed: number): Athlete["monitoring"] {
  const r = (i: number) => seededRand(seed * 100 + i);
  const acwr = +(0.7 + r(1) * 0.8).toFixed(2);
  const pl = Math.round(200 + r(2) * 300);
  const cl = Math.round(pl * (0.7 + r(3) * 0.3));
  return { acwr, monotony: +(1 + r(4) * 1.2).toFixed(1), strain: Math.round(200 + r(5) * 500), plannedLoad: pl, completedLoad: cl, wellbeing: Math.round(50 + r(6) * 45), sleep: Math.round(50 + r(7) * 45), fatigue: Math.round(10 + r(8) * 60), weeklyLoads: [Math.round(pl*0.7), Math.round(pl*0.8), Math.round(pl*0.9), pl], weeklyPse: [Math.round(2+r(9)*3), Math.round(2+r(10)*3), Math.round(2+r(11)*3), Math.round(2+r(12)*3)], acuteLoad: pl, chronicLoad: Math.round(pl*(0.8+r(13)*0.3)), totalMinutes: Math.round(150+r(14)*200), sessionsCompleted: Math.round(3+r(15)*4), sessionsPlanned: Math.round(5+r(16)*3), riskLevel: (acwr > 1.3 ? "alto" : acwr < 0.8 ? "ok" : "atenção") as Risk };
}

const athletesMock: Athlete[] = rawData.athletes.map((a: any, idx: number) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  age: a.age || 25,
  position: a.position || "—",
  status: (a.isEnabled ? "ativo" : "inativo") as Status,
  risk: (["ok", "atenção", "alto"][Math.floor(seededRand(idx + 1) * 3)]) as Risk,
  nextTraining: "—",
  coach: rawData.coaches[Math.floor(seededRand(idx + 50) * rawData.coaches.length)]?.name || "—",
  objective: a.goal || "—",
  phone: a.phone || "—",
  city: "—",
  state: "—",
  country: "Brasil",
  weight: a.weight ? String(a.weight) : "—",
  height: a.height ? String(a.height) : "—",
  monitoring: generateDefaultMonitoring(idx + 1),
  plannedTrainings: [],
  completedTrainings: [],
  pains: [],
  injuries: [],
}));

const collaboratorsMock: Collaborator[] = rawData.coaches.map((c: any) => ({
  id: c.id, name: c.name, email: c.email, role: c.role, status: (c.isEnabled ? "ativo" : "inativo") as Status, color: c.color, athletes: 0,
}));

const trainingTypesMock: TrainingType[] = rawData.trainingTypes.map((t: any) => ({
  id: t.id, name: t.name, status: (t.isEnabled ? "ativo" : "inativo") as Status, isDefault: false, category: "Geral",
}));

const agendaColumns: AgendaColumn[] = [
  { key: "Seg", label: "Segunda", date: "23" },
  { key: "Ter", label: "Terça", date: "24" },
  { key: "Qua", label: "Quarta", date: "25" },
  { key: "Qui", label: "Quinta", date: "26" },
  { key: "Sex", label: "Sexta", date: "27" },
  { key: "Sáb", label: "Sábado", date: "28" },
];

const statusMap: Record<string, SessionStatus> = { Confirmado: "Confirmado", Pendente: "Pendente", Cancelado: "Pendente" };
const intensityMap = (pse: number): Intensity => pse >= 5 ? "Alta" : pse >= 3 ? "Média" : "Baixa";
const agendaSessionsMock: AgendaSession[] = ((rawData as any).weekSchedules || [])
  .filter((s: any) => s.status !== "Cancelado")
  .map((s: any) => ({
    id: s.id, day: s.day, time: s.time, endTime: s.endTime, athlete: s.athlete,
    type: s.type, coach: s.coach, status: statusMap[s.status] || ("Pendente" as SessionStatus),
    location: s.location, intensity: intensityMap(s.pse), pse: s.pse,
  }));

// Legacy mock kept for reference - replaced by real data above
const _legacyMock = [
  { id: 1, day: "Seg", time: "04:40", endTime: "05:30", athlete: "Lucas Peyber Brambilla", type: "Força Estrutural", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 4 },
  { id: 2, day: "Seg", time: "05:30", endTime: "06:20", athlete: "Matheus A. Souza", type: "Força Estrutural", coach: "Zilmar Quadros", status: "Em andamento", location: "CT", intensity: "Alta", pse: 5 },
  { id: 3, day: "Seg", time: "13:00", endTime: "13:50", athlete: "Felipe de Moura", type: "Livre", coach: "Juninho Silveira", status: "Pendente", location: "Home", intensity: "Baixa", pse: 1 },
  { id: 4, day: "Ter", time: "04:40", endTime: "05:30", athlete: "Douglas A. Gomes", type: "Força Estrutural", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 4 },
  { id: 5, day: "Ter", time: "07:10", endTime: "08:00", athlete: "Rafael Batista", type: "Core", coach: "Juninho Silveira", status: "Confirmado", location: "Campo", intensity: "Média", pse: 3 },
  { id: 6, day: "Ter", time: "17:10", endTime: "18:00", athlete: "Adriana Mello", type: "Livre", coach: "Juninho Silveira", status: "Concluído", location: "Home", intensity: "Baixa", pse: 2 },
  { id: 7, day: "Qua", time: "05:30", endTime: "06:20", athlete: "Marco S. Moura", type: "Força Estrutural", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 5 },
  { id: 8, day: "Qua", time: "09:40", endTime: "10:30", athlete: "Daniel D. Silva", type: "Livre", coach: "Pepo Gomes", status: "Pendente", location: "Campo", intensity: "Baixa", pse: 1 },
  { id: 9, day: "Qua", time: "20:30", endTime: "21:20", athlete: "Andrew Ventura", type: "Mobilidade", coach: "Zilmar Quadros", status: "Confirmado", location: "CT", intensity: "Média", pse: 2 },
  { id: 10, day: "Qui", time: "05:30", endTime: "06:20", athlete: "Lucas Brambilla", type: "Força Rápida", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 6 },
  { id: 11, day: "Qui", time: "14:40", endTime: "15:30", athlete: "Andrey F. Santos", type: "Força", coach: "Pepo Gomes", status: "Em andamento", location: "Campo", intensity: "Alta", pse: 5 },
  { id: 12, day: "Sex", time: "05:30", endTime: "06:20", athlete: "Fernando V. Jerônimo", type: "Força Rápida", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 6 },
  { id: 13, day: "Sex", time: "13:00", endTime: "13:50", athlete: "Eduarda A. Henrique", type: "Livre", coach: "Juninho Silveira", status: "Concluído", location: "Home", intensity: "Baixa", pse: 1 },
  { id: 14, day: "Sex", time: "18:00", endTime: "18:50", athlete: "Silas V. Felipe", type: "Livre", coach: "Pepo Gomes", status: "Pendente", location: "CT", intensity: "Baixa", pse: 0 },
  { id: 15, day: "Sáb", time: "10:30", endTime: "11:20", athlete: "Enzo Berger Tedesco", type: "Força Específica", coach: "Jefferson Miranda", status: "Confirmado", location: "Academia", intensity: "Média", pse: 4 },
  { id: 16, day: "Sáb", time: "08:00", endTime: "08:50", athlete: "Caio Henrique Lima", type: "Avaliação", coach: "Lucas Quarti", status: "Confirmado", location: "CT", intensity: "Média", pse: 2 },
  // Sessões simultâneas - Segunda 05:30
  { id: 17, day: "Seg", time: "05:30", endTime: "06:20", athlete: "Rafael Batista", type: "Core", coach: "Juninho Silveira", status: "Confirmado", location: "Campo", intensity: "Média", pse: 3 },
  { id: 18, day: "Seg", time: "05:30", endTime: "06:20", athlete: "Enzo Berger Tedesco", type: "Força Específica", coach: "Jefferson Miranda", status: "Pendente", location: "Academia", intensity: "Alta", pse: 5 },
  // Sessões simultâneas - Terça 04:40
  { id: 19, day: "Ter", time: "04:40", endTime: "05:30", athlete: "Felipe de Moura", type: "Mobilidade", coach: "Pepo Gomes", status: "Confirmado", location: "CT", intensity: "Baixa", pse: 1 },
  // Sessões simultâneas - Quarta 05:30
  { id: 20, day: "Qua", time: "05:30", endTime: "06:20", athlete: "Adriana Mello", type: "Core", coach: "Juninho Silveira", status: "Em andamento", location: "Campo", intensity: "Média", pse: 3 },
  { id: 21, day: "Qua", time: "05:30", endTime: "06:20", athlete: "Andrey F. Santos", type: "Aceleração", coach: "Pepo Gomes", status: "Confirmado", location: "CT", intensity: "Alta", pse: 4 },
  // Sessões simultâneas - Quinta 05:30
  { id: 22, day: "Qui", time: "05:30", endTime: "06:20", athlete: "Fernando V. Jerônimo", type: "Força Estrutural", coach: "Juninho Silveira", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 5 },
  // Sessões simultâneas - Sexta 05:30
  { id: 23, day: "Sex", time: "05:30", endTime: "06:20", athlete: "Daniel D. Silva", type: "Core", coach: "Juninho Silveira", status: "Em andamento", location: "Campo", intensity: "Média", pse: 3 },
  { id: 24, day: "Sex", time: "05:30", endTime: "06:20", athlete: "Caio Henrique Lima", type: "Mobilidade", coach: "Lucas Quarti", status: "Pendente", location: "CT", intensity: "Baixa", pse: 1 },
  // +20 sessões extras
  { id: 25, day: "Seg", time: "07:10", endTime: "08:00", athlete: "Hugo Gomes", type: "Força Estrutural", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 5 },
  { id: 26, day: "Seg", time: "07:10", endTime: "08:00", athlete: "Caio Bruno", type: "Livre", coach: "Juninho Silveira", status: "Confirmado", location: "Campo", intensity: "Baixa", pse: 1 },
  { id: 27, day: "Seg", time: "08:00", endTime: "08:50", athlete: "Raquel Leão", type: "Livre", coach: "Juninho Silveira", status: "Pendente", location: "Home", intensity: "Baixa", pse: 0 },
  { id: 28, day: "Seg", time: "08:00", endTime: "08:50", athlete: "Gabriel Batista", type: "Força Rápida", coach: "Pepo Gomes", status: "Confirmado", location: "CT", intensity: "Alta", pse: 5 },
  { id: 29, day: "Ter", time: "05:30", endTime: "06:20", athlete: "Decio Ferreira", type: "Força Estrutural", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 4 },
  { id: 30, day: "Ter", time: "05:30", endTime: "06:20", athlete: "Maíra Batista", type: "Livre", coach: "Juninho Silveira", status: "Em andamento", location: "Campo", intensity: "Baixa", pse: 1 },
  { id: 31, day: "Ter", time: "08:50", endTime: "09:40", athlete: "João Filipe", type: "Força Específica", coach: "Jefferson Miranda", status: "Confirmado", location: "Academia", intensity: "Média", pse: 3 },
  { id: 32, day: "Ter", time: "08:50", endTime: "09:40", athlete: "Vinicius Lopes", type: "Força Estrutural", coach: "Pepo Gomes", status: "Confirmado", location: "CT", intensity: "Alta", pse: 4 },
  { id: 33, day: "Qua", time: "07:10", endTime: "08:00", athlete: "Samuel Conceição", type: "Core", coach: "Juninho Silveira", status: "Confirmado", location: "Campo", intensity: "Média", pse: 3 },
  { id: 34, day: "Qua", time: "07:10", endTime: "08:00", athlete: "Kazu Christiano", type: "Mobilidade", coach: "Zilmar Quadros", status: "Pendente", location: "CT", intensity: "Baixa", pse: 1 },
  { id: 35, day: "Qua", time: "08:00", endTime: "08:50", athlete: "Felipe Ryan", type: "Força Estrutural", coach: "Lucas Quarti", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 5 },
  { id: 36, day: "Qui", time: "07:10", endTime: "08:00", athlete: "Djalma Santos", type: "Força Rápida", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 6 },
  { id: 37, day: "Qui", time: "07:10", endTime: "08:00", athlete: "Raquel Leão", type: "Livre", coach: "Juninho Silveira", status: "Pendente", location: "Home", intensity: "Baixa", pse: 0 },
  { id: 38, day: "Qui", time: "08:00", endTime: "08:50", athlete: "Matheus Pato", type: "Aceleração", coach: "Pepo Gomes", status: "Em andamento", location: "Campo", intensity: "Alta", pse: 5 },
  { id: 39, day: "Qui", time: "08:50", endTime: "09:40", athlete: "Dalberto Luares", type: "Força Estrutural", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 4 },
  { id: 40, day: "Sex", time: "07:10", endTime: "08:00", athlete: "Silas V. Felipe", type: "Livre", coach: "Pepo Gomes", status: "Confirmado", location: "CT", intensity: "Baixa", pse: 1 },
  { id: 41, day: "Sex", time: "07:10", endTime: "08:00", athlete: "Matheus Pato", type: "Força Estrutural", coach: "Zilmar Quadros", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 5 },
  { id: 42, day: "Sex", time: "08:00", endTime: "08:50", athlete: "Ruan Pereira", type: "Livre", coach: "Juninho Silveira", status: "Pendente", location: "Home", intensity: "Baixa", pse: 0 },
  { id: 43, day: "Sáb", time: "08:50", endTime: "09:40", athlete: "Felipe Ryan", type: "Força Rápida", coach: "Lucas Quarti", status: "Confirmado", location: "Academia", intensity: "Alta", pse: 5 },
  { id: 44, day: "Sáb", time: "08:50", endTime: "09:40", athlete: "Dalberto Luares", type: "Aceleração", coach: "Juninho Silveira", status: "Confirmado", location: "Campo", intensity: "Alta", pse: 4 },
];

const palette = {
  background: "#0B0F14",
  backgroundalt: "#050505",
  panel: "#0D0D0D",
  surface: "#151515",
  surfaceAlt: "#1A1A1A",
  border: "rgba(245, 245, 244, 0.1)",
  line: "rgba(245, 245, 244, 0.18)",
  muted: "#a8a29e",
  text: "#f5f5f4",
  brand: "hsl(47, 100%, 47%)",
  brandHover: "hsl(47, 100%, 55%)",
  brandSoft: "rgba(250, 204, 21, 0.12)",
  success: "#84CC16",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#1D4ED8",
  purple: "#8B5CF6",
};

const agendaViewOptions: Array<{ value: AgendaView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "timeline", label: "Grade horária", icon: Timer },
  { value: "diaria", label: "Diária", icon: Clock },
  { value: "mensal", label: "Mensal", icon: CalendarIcon },
  { value: "semana", label: "Calendário semanal", icon: CalendarDays },
  { value: "tabela", label: "Tabela", icon: Table2 },
  { value: "lista", label: "Lista", icon: List },
  { value: "kanban", label: "Kanban", icon: KanbanSquare },
  { value: "personal", label: "Por personal", icon: UserRound },
];

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("");
}

function generateTimeSlots(start = "04:40", end = "22:00", stepMinutes = 50): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const slots: string[] = [];
  for (let t = startMin; t <= endMin; t += stepMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  const endLabel = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  if (slots[slots.length - 1] !== endLabel) slots.push(endLabel);
  return slots;
}

// Generate time slots from real data + fill gaps
const timeSlots = generateTimeSlots("05:30", "22:10", 50);

function Logo() {
  const { isDark } = useTheme();
  return (
    <span className={cn("text-xl font-display font-black tracking-tight uppercase", isDark ? "text-white" : "text-gray-900")}>
      brainston
    </span>
  );
}

function SurfaceCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const { isDark } = useTheme();
  return <Card className={cn("rounded-2xl shadow-glass", isDark ? "glass-panel text-white" : "bg-white border-gray-200 text-gray-900", className)}>{children}</Card>;
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  const { isDark } = useTheme();
  return (
    <div className="mb-8">
      <h1 className={cn("text-3xl md:text-4xl font-display font-bold uppercase tracking-tight", isDark ? "text-white" : "text-gray-900")}>{title}</h1>
      {description ? <p className={cn("mt-2 text-sm leading-relaxed", isDark ? "text-slate-400" : "text-gray-500")}>{description}</p> : null}
    </div>
  );
}

function StatusBadge({ value }: { value: Risk | Status }) {
  const styles: Record<string, string> = {
    ativo: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    inativo: "bg-white/10 text-slate-300 border-white/20",
    ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    atenção: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    alto: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return <Badge className={cn("rounded-md border px-2 py-1 text-[10px] font-bold font-mono tracking-wider uppercase", styles[value])}>{value}</Badge>;
}

function StatCard({ icon: Icon, label, value, helper, tone = "default" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; helper: string; tone?: "default" | "brand" | "success" | "warning" | "danger" | "info" }) {
  const { isDark } = useTheme();
  const glowIcon: Record<string, string> = {
    default: isDark ? "bg-white/10 text-slate-400" : "bg-gray-100 text-gray-400",
    brand: "bg-primary/20 text-primary",
    success: "bg-emerald-400/10 text-emerald-400",
    warning: "bg-amber-400/10 text-amber-400",
    danger: "bg-red-400/10 text-red-400",
    info: "bg-blue-400/10 text-blue-400",
  };
  return (
    <div className={cn("rounded-xl border p-6 transition-colors relative overflow-hidden", isDark ? "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]" : "border-gray-200 bg-white hover:bg-gray-50")}>
      <div className={cn("flex items-center justify-between mb-6 relative z-10", isDark ? "text-slate-400" : "text-gray-500")}>
        <span className="text-[10px] font-mono uppercase tracking-widest block">{label}</span>
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", glowIcon[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-3 relative z-10">
        <span className={cn("text-3xl font-display font-medium tracking-tight", isDark ? "text-white" : "text-gray-900")}>{value}</span>
      </div>
      <div className={cn("mt-3 text-xs", isDark ? "text-slate-500" : "text-gray-400")}>{helper}</div>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  const { isDark } = useTheme();
  return (
    <div className={cn("rounded-xl border px-3 py-2 text-center", isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-200 bg-gray-50")}>
      <div className={cn("text-[10px] font-mono uppercase tracking-widest", isDark ? "text-slate-500" : "text-gray-400")}>{label}</div>
      <div className={cn("mt-1 text-sm font-display font-medium", isDark ? "text-white" : "text-gray-900")}>{value}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  const { isDark } = useTheme();
  return (
    <div className={cn("rounded-xl border p-4", isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-200 bg-gray-50")}>
      <div className={cn("text-[10px] font-mono uppercase tracking-widest border-b pb-2 mb-3", isDark ? "text-slate-500 border-white/10" : "text-gray-400 border-gray-200")}>{label}</div>
      <div className={cn("text-sm font-sans", isDark ? "text-slate-300" : "text-gray-700")}>{value}</div>
    </div>
  );
}

function KpiLine({ label, value, progress }: { label: string; value: string; progress: number }) {
  const { isDark } = useTheme();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className={cn("font-mono text-xs uppercase tracking-wider", isDark ? "text-slate-400" : "text-gray-500")}>{label}</span>
        <span className={cn("font-display font-medium", isDark ? "text-white" : "text-gray-900")}>{value}</span>
      </div>
      <div className={cn("h-1.5 w-full rounded-full overflow-hidden", isDark ? "bg-white/5" : "bg-gray-200")}>
        <div className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)] transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
    </div>
  );
}

function ViewPill({ active, icon: Icon, label, onClick }: { active: boolean; icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  const { isDark } = useTheme();
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2 px-5 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase transition-all", active ? "bg-primary text-black shadow-glow" : isDark ? "border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900")}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function AppShell({ children, currentPage, setCurrentPage, theme, toggleTheme }: { children: React.ReactNode; currentPage: PageKey; setCurrentPage: (page: PageKey) => void; theme: "dark" | "light"; toggleTheme: () => void }) {
  const { isAdmin, user } = usePermissions();
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileName, setProfileName] = useState(user.name || "Usuário");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState({
    businessName: "brainston",
    email: "zilmar@brainston.com",
    phone: "(21) 99999-9999",
    cref: "012345-G/RJ",
    specialty: "Preparação Física - Futebol",
    address: "Rio de Janeiro, RJ",
    bio: "Preparador físico especializado em atletas de futebol profissional.",
    sessionDuration: "50",
    startTime: "05:30",
    endTime: "22:00",
  });
  const profileFileRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const isDark = theme === "dark";
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { data: notifData } = useApi<any>(`/api/notifications${!isAdmin ? `?coachEmail=${encodeURIComponent(user.email)}` : ""}`);
  useEffect(() => {
    function handler(e: MouseEvent) { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const menu = [
    { key: "dashboard" as PageKey, label: "Dashboard", icon: LayoutDashboard },
    { key: "agenda" as PageKey, label: "Agenda", icon: CalendarDays },
    { key: "athletes" as PageKey, label: "Atletas", icon: Users },
    { key: "physical-alerts" as PageKey, label: "Alertas Físicos", icon: CircleAlert },
    ...(isAdmin ? [
      { key: "collaborators" as PageKey, label: "Colaboradores", icon: UserCog },
      { key: "training-types" as PageKey, label: "Tipos de Treino", icon: Dumbbell },
      { key: "reports" as PageKey, label: "Relatórios", icon: Activity },
    ] : []),
  ];

  return (
    <div data-theme={theme} className={cn("relative min-h-screen transition-colors duration-300", isDark ? "text-foreground" : "bg-[#F5F5F0] text-[#1a1a1a]")}>
      <div className="flex min-h-screen">
        <aside className={cn("hidden xl:flex xl:flex-col fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 border-r", sidebarCollapsed ? "w-[68px]" : "w-[260px]", isDark ? "border-white/10 bg-[#050505]/80 backdrop-blur-sm" : "border-gray-200 bg-white")}>
          <div className={cn("border-b flex items-center gap-3 transition-all duration-300", sidebarCollapsed ? "px-3 py-5 justify-center" : "px-6 py-5", isDark ? "border-white/10" : "border-gray-200")}>
            <div className="w-2 h-2 bg-primary shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse flex-shrink-0" />
            {!sidebarCollapsed && <Logo />}
          </div>
          <div className={cn("flex-1 space-y-1", sidebarCollapsed ? "p-2" : "p-4")}>
            {menu.map((item) => {
              const Icon = item.icon;
              const active = currentPage === item.key;
              return (
                <button key={item.key} onClick={() => setCurrentPage(item.key)} title={item.label} className={cn("flex w-full items-center gap-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] transition-all", sidebarCollapsed ? "justify-center px-2 py-2.5 rounded-lg" : "px-4 py-2.5", active ? "bg-primary text-black shadow-glow" : isDark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900")}>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {!sidebarCollapsed && item.label}
                </button>
              );
            })}
          </div>
          {/* Collapse toggle */}
          <div className={cn("border-t flex items-center", sidebarCollapsed ? "justify-center p-3" : "justify-between px-6 py-4", isDark ? "border-white/10" : "border-gray-200")}>
            {!sidebarCollapsed && <div className={cn("text-[10px] font-mono tracking-[0.3em] uppercase", isDark ? "text-slate-600" : "text-gray-400")}>System v3.0</div>}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={cn("w-7 h-7 rounded-full border flex items-center justify-center transition-all", isDark ? "border-white/10 text-slate-500 hover:text-white hover:bg-white/5" : "border-gray-200 text-gray-400 hover:text-gray-900 hover:bg-gray-100")}>
              <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform", sidebarCollapsed && "rotate-180")} />
            </button>
          </div>
        </aside>

        <div className={cn("hidden xl:block shrink-0 transition-all duration-300", sidebarCollapsed ? "w-[68px]" : "w-[260px]")} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className={cn("sticky top-0 z-30 border-b transition-colors duration-300", isDark ? "glass-dark border-white/10" : "bg-white/90 backdrop-blur border-gray-200")}>
            <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-10">
              <div className="flex items-center gap-3 xl:hidden">
                <button onClick={() => setMobileMenuOpen(true)} className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] transition-colors"><Menu className="h-4 w-4 text-slate-400" /></button>
                <Logo />
              </div>
              <div className="hidden max-w-xl flex-1 items-center gap-3 xl:flex">
                <div className={cn("flex items-center border rounded-md px-4 py-2.5 transition-all w-full", isDark ? "bg-white/[0.03] border-white/10 focus-within:border-white/30" : "bg-gray-50 border-gray-200 focus-within:border-gray-400")}>
                  <Search className={cn("h-4 w-4 mr-3", isDark ? "text-slate-500" : "text-gray-400")} />
                  <input type="text" placeholder="Buscar componentes..." className={cn("bg-transparent border-none outline-none text-sm w-full font-sans", isDark ? "text-slate-200 placeholder:text-slate-600" : "text-gray-900 placeholder:text-gray-400")} />
                  <span className={cn("text-[10px] font-bold border rounded px-1.5 py-0.5 ml-2", isDark ? "text-slate-500 border-white/10" : "text-gray-400 border-gray-300")}>&#8984;K</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div ref={notifRef} className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] transition-colors relative">
                  {(notifData?.count || 0) > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-[#0B0F14] flex items-center justify-center text-[9px] font-bold text-white">{notifData.count}</span>}
                  <Bell className="h-4 w-4 text-slate-400" />
                </button>
                {showNotifications && (
                  <div className={cn("absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-2xl overflow-hidden z-50", isDark ? "border-white/10 bg-[#0B0F14]" : "border-gray-200 bg-white")}>
                    <div className={cn("px-4 py-3 border-b flex items-center justify-between", isDark ? "border-white/10" : "border-gray-200")}>
                      <div className={cn("text-sm font-display font-bold", isDark ? "text-white" : "text-gray-900")}>Pendências</div>
                      <span className="text-[10px] font-mono text-slate-500">{notifData?.count || 0} treinos</span>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {notifData?.notifications?.length > 0 ? notifData.notifications.map((n: any) => (
                        <button key={n.id} onClick={() => { setShowNotifications(false); setCurrentPage("agenda"); }} className={cn("w-full flex items-start gap-3 px-4 py-3 text-left border-b transition-colors", isDark ? "border-white/5 hover:bg-white/[0.03]" : "border-gray-100 hover:bg-gray-50")}>
                          <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CircleAlert className="w-3.5 h-3.5 text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-red-400">Treino não concluído</div>
                            <div className={cn("text-sm font-medium truncate", isDark ? "text-white" : "text-gray-900")}>{n.athleteName}</div>
                            <div className="text-[10px] text-slate-500">{n.date} · {n.time} · {n.detail.split(" · ").slice(1).join(" · ")}</div>
                          </div>
                        </button>
                      )) : (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma pendência</div>
                      )}
                    </div>
                  </div>
                )}
                </div>
                {/* Profile dropdown */}
                <div ref={profileRef} className="relative">
                  <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                    <span className={cn("text-sm font-medium hidden lg:block", isDark ? "text-white" : "text-gray-900")}>{profileName || user.name}</span>
                    <Avatar className="h-10 w-10 border border-white/10">
                      {profileAvatarUrl ? <img src={profileAvatarUrl} alt={profileName} className="w-full h-full object-cover rounded-full" /> : <AvatarFallback className="bg-white/10 text-white font-display font-bold text-sm">{initials(profileName)}</AvatarFallback>}
                    </Avatar>
                  </button>
                  {profileOpen && (
                    <div className={cn("absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-2xl overflow-hidden z-50", isDark ? "border-white/10 bg-[#0B0F14]" : "border-gray-200 bg-white")}>
                      <div className={cn("px-4 py-3 border-b", isDark ? "border-white/10" : "border-gray-200")}>
                        <div className={cn("text-sm font-display font-bold", isDark ? "text-white" : "text-gray-900")}>Minha conta</div>
                      </div>
                      <div className="py-1">
                        <button onClick={() => { setShowProfileModal(true); setProfileOpen(false); }} className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left", isDark ? "text-slate-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-100")}>
                          <UserIcon className={cn("w-4 h-4", isDark ? "text-slate-500" : "text-gray-400")} /> Perfil
                        </button>
                        {isAdmin && <button onClick={() => { setShowSettingsModal(true); setProfileOpen(false); }} className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left", isDark ? "text-slate-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-100")}>
                          <Settings className={cn("w-4 h-4", isDark ? "text-slate-500" : "text-gray-400")} /> Configurações
                        </button>}
                      </div>
                      <div className={cn("border-t py-1", isDark ? "border-white/10" : "border-gray-200")}>
                        <button onClick={() => { toggleTheme(); setProfileOpen(false); }} className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left", isDark ? "text-slate-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-100")}>
                          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
                          {isDark ? "Modo claro" : "Modo escuro"}
                        </button>
                      </div>
                      <div className={cn("border-t py-1", isDark ? "border-white/10" : "border-gray-200")}>
                        <button onClick={async () => { const { createClient } = await import("@/lib/supabase/client"); const supabase = createClient(); await supabase.auth.signOut(); window.location.href = "/login"; }} className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left", isDark ? "text-slate-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-100")}>
                          <LogOut className={cn("w-4 h-4", isDark ? "text-slate-500" : "text-gray-400")} /> Sair
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>
          {/* Mobile menu drawer */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-[90] xl:hidden" onClick={() => setMobileMenuOpen(false)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div className="absolute left-0 top-0 h-full w-[260px] bg-[#0B0F14] border-r border-white/10 p-6 space-y-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <Logo />
                  <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                {menu.map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.key;
                  return (
                    <button key={item.key} onClick={() => { setCurrentPage(item.key); setMobileMenuOpen(false); }} className={cn("flex w-full items-center gap-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-3 rounded-lg transition-all", active ? "bg-primary text-black shadow-glow" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {showProfileModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setShowProfileModal(false)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div className={cn("relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden", isDark ? "border-white/10 bg-[#0B0F14]" : "border-gray-200 bg-white")} onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <h2 className={cn("text-xl font-display font-bold", isDark ? "text-white" : "text-gray-900")}>Editar Perfil</h2>
                    <button onClick={() => setShowProfileModal(false)} className={cn("w-8 h-8 rounded-full border flex items-center justify-center transition-colors", isDark ? "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.05]" : "border-gray-200 text-gray-400 hover:text-gray-900")}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Avatar */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative group mb-3">
                      <div className={cn("w-24 h-24 rounded-full border-2 flex items-center justify-center overflow-hidden", isDark ? "border-white/10 bg-white/[0.05]" : "border-gray-200 bg-gray-100")}>
                        {profileAvatarUrl ? (
                          <img src={profileAvatarUrl} alt={profileName} className="w-full h-full object-cover" />
                        ) : (
                          <span className={cn("text-3xl font-display font-bold", isDark ? "text-white" : "text-gray-900")}>{initials(profileName)}</span>
                        )}
                      </div>
                      <button onClick={() => profileFileRef.current?.click()} className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <Plus className="w-6 h-6 text-white" />
                      </button>
                      <input ref={profileFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setProfileAvatarUrl(URL.createObjectURL(f)); }} />
                    </div>
                    <button onClick={() => profileFileRef.current?.click()} className="text-xs text-primary hover:text-primary-hover transition-colors font-medium">
                      Alterar foto
                    </button>
                    {profileAvatarUrl && (
                      <button onClick={() => setProfileAvatarUrl(null)} className="text-xs text-red-400 hover:text-red-300 transition-colors mt-1">
                        Remover foto
                      </button>
                    )}
                  </div>

                  {/* Name */}
                  <div className="mb-6">
                    <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>Nome</div>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white placeholder:text-slate-500 focus:border-primary/50" : "border-gray-200 bg-gray-50 text-gray-900 focus:border-gray-400")}
                      placeholder="Seu nome..."
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div className="mb-6">
                    <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>E-mail</div>
                    <div className={cn("rounded-lg border px-4 py-3 text-sm", isDark ? "border-white/10 bg-[#050505] text-slate-400" : "border-gray-200 bg-gray-50 text-gray-500")}>
                      zilmar@brainston.com
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button onClick={() => setShowProfileModal(false)} className={cn("flex-1 py-3 rounded-xl border text-sm font-bold uppercase tracking-[0.15em] transition-colors", isDark ? "border-white/20 text-white hover:bg-white/5" : "border-gray-200 text-gray-700 hover:bg-gray-100")}>
                      Cancelar
                    </button>
                    <button onClick={() => setShowProfileModal(false)} className="flex-1 py-3 rounded-xl bg-primary text-black text-sm font-bold uppercase tracking-[0.15em] hover:bg-primary-hover transition-all shadow-glow">
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showSettingsModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setShowSettingsModal(false)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div className={cn("relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col", isDark ? "border-white/10 bg-[#0B0F14]" : "border-gray-200 bg-white")} onClick={(e) => e.stopPropagation()}>
                <div className="p-6 pb-0">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className={cn("text-xl font-display font-bold", isDark ? "text-white" : "text-gray-900")}>Configurações</h2>
                      <p className={cn("text-sm mt-1", isDark ? "text-slate-500" : "text-gray-500")}>Dados do personal e configurações da agenda</p>
                    </div>
                    <button onClick={() => setShowSettingsModal(false)} className={cn("w-8 h-8 rounded-full border flex items-center justify-center transition-colors", isDark ? "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.05]" : "border-gray-200 text-gray-400 hover:text-gray-900")}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-6 space-y-5">
                  {/* Business info */}
                  <div className={cn("rounded-xl border p-4 space-y-4", isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-200 bg-gray-50")}>
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider", isDark ? "text-slate-400" : "text-gray-500")}>Dados profissionais</div>
                    <div>
                      <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>Nome do negócio</div>
                      <input value={settingsData.businessName} onChange={(e) => setSettingsData({ ...settingsData, businessName: e.target.value })} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>E-mail</div>
                        <input value={settingsData.email} onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                      </div>
                      <div>
                        <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>Telefone</div>
                        <input value={settingsData.phone} onChange={(e) => setSettingsData({ ...settingsData, phone: e.target.value })} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>CREF</div>
                        <input value={settingsData.cref} onChange={(e) => setSettingsData({ ...settingsData, cref: e.target.value })} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                      </div>
                      <div>
                        <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>Especialidade</div>
                        <input value={settingsData.specialty} onChange={(e) => setSettingsData({ ...settingsData, specialty: e.target.value })} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>Endereço</div>
                      <input value={settingsData.address} onChange={(e) => setSettingsData({ ...settingsData, address: e.target.value })} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                    </div>
                    <div>
                      <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>Bio / Descrição</div>
                      <textarea value={settingsData.bio} onChange={(e) => setSettingsData({ ...settingsData, bio: e.target.value })} rows={3} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors resize-none", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                    </div>
                  </div>

                  {/* Agenda settings */}
                  <div className={cn("rounded-xl border p-4 space-y-4", isDark ? "border-white/10 bg-white/[0.02]" : "border-gray-200 bg-gray-50")}>
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider", isDark ? "text-slate-400" : "text-gray-500")}>Configurações da agenda</div>
                    <div className="grid grid-cols-3 gap-4 items-end">
                      <div>
                        <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>Duração (min)</div>
                        <input type="number" value={settingsData.sessionDuration} onChange={(e) => setSettingsData({ ...settingsData, sessionDuration: e.target.value })} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                      </div>
                      <div>
                        <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>Horário início</div>
                        <input type="time" value={settingsData.startTime} onChange={(e) => setSettingsData({ ...settingsData, startTime: e.target.value })} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors [color-scheme:dark]", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                      </div>
                      <div>
                        <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900")}>Horário fim</div>
                        <input type="time" value={settingsData.endTime} onChange={(e) => setSettingsData({ ...settingsData, endTime: e.target.value })} className={cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors [color-scheme:dark]", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-white text-gray-900 focus:border-gray-400")} />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowSettingsModal(false)} className={cn("flex-1 py-3 rounded-xl border text-sm font-bold uppercase tracking-[0.15em] transition-colors", isDark ? "border-white/20 text-white hover:bg-white/5" : "border-gray-200 text-gray-700 hover:bg-gray-100")}>
                      Cancelar
                    </button>
                    <button onClick={() => setShowSettingsModal(false)} className="flex-1 py-3 rounded-xl bg-primary text-black text-sm font-bold uppercase tracking-[0.15em] hover:bg-primary-hover transition-all shadow-glow">
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <main className="relative z-10 flex-1 px-4 py-8 lg:px-10">{children}</main>
          <footer className={cn("py-8 border-t relative overflow-hidden transition-colors duration-300", isDark ? "bg-[#050505] text-slate-400 border-white/10" : "bg-gray-50 text-gray-500 border-gray-200")}>
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-10">
              <Logo />
              <p className="text-[10px] font-mono tracking-widest uppercase">&copy; 2026 brainston. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({ openAthlete, goAgenda }: { openAthlete: (a: Athlete) => void; goAgenda: () => void }) {
  const { isDark } = useTheme();
  const { sessions: dbSessions, athletes: dbAthletesDash, athletes: cachedAthletes } = useData();
  const { isAdmin, user: currentUserPerm } = usePermissions();
  const { coaches: dbCoachesDash } = useData();
  const [riskFilter, setRiskFilter] = useState<"todos" | "atenção" | "alto">("todos");
  const [showAlerts, setShowAlerts] = useState(false);
  const { data: alertData } = useApi<any>("/api/alerts?period=week");
  const { data: dashNotifData } = useApi<any>(`/api/notifications${!isAdmin ? `?coachEmail=${encodeURIComponent(currentUserPerm.email)}` : ""}`);
  const { data: riskData } = useApi<any>("/api/alerts/athletes");
  const allCritical = useMemo(() => riskData?.athletes || [], [riskData]);
  const criticalAthletes = useMemo(() => riskFilter === "todos" ? allCritical : allCritical.filter((a: any) => a.risk === riskFilter), [allCritical, riskFilter]);

  // Find coach name linked to logged-in user's email
  const myCoachNameDash = useMemo(() => {
    // Show own sessions for everyone
    const match = dbCoachesDash.find(c => c.email.toLowerCase() === currentUserPerm.email.toLowerCase());
    return match?.name || null;
  }, [isAdmin, currentUserPerm.email, dbCoachesDash]);

  // Today's sessions from DB
  const todayKey = (() => { const d = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; return d[new Date().getDay()]; })();
  const todaySessions = useMemo(() => {
    if (dbSessions.length > 0) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      return dbSessions
        .filter((s) => {
          if (!s.date.startsWith(todayStr) || s.status === "Cancelado") return false;
          if (myCoachNameDash && s.coach.name !== myCoachNameDash) return false;
          return true;
        })
        .map((s) => ({ id: s.id, day: todayKey, time: s.startTime, endTime: s.endTime, athlete: s.athlete.name, type: s.trainingType.name, coach: s.coach.name, status: s.status as SessionStatus, location: s.location, intensity: (s.psePlanned >= 5 ? "Alta" : s.psePlanned >= 3 ? "Média" : "Baixa") as Intensity, pse: s.psePlanned }))
        .sort((a, b) => { const c = getCoachPriority(a.coach) - getCoachPriority(b.coach); return c !== 0 ? c : a.time.localeCompare(b.time); });
    }
    return agendaSessionsMock.filter((item) => item.day === todayKey);
  }, [dbSessions, todayKey, isAdmin, currentUserPerm.name]);

  const activeAthleteCount = dbAthletesDash.length > 0 ? dbAthletesDash.filter(a => a.isEnabled).length : 97;
  return (
    <div>
      {/* Alerts Modal */}
      {showAlerts && alertData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setShowAlerts(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg max-h-[80vh] rounded-2xl border border-white/10 bg-[#0B0F14] shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-3 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-display font-bold text-white">Alertas Físicos</h2>
                <p className="text-sm text-slate-500 mt-1">{alertData.total} alertas ativos</p>
              </div>
              <button onClick={() => setShowAlerts(false)} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
              {alertData.athletes?.length > 0 ? alertData.athletes.map((a: any, i: number) => (
                <button key={i} onClick={() => {
                  const dbMatch = cachedAthletes.find((ca: any) => ca.name === a.name);
                  if (dbMatch) {
                    const ath: Athlete = { id: dbMatch.id, name: dbMatch.name, email: dbMatch.email, age: dbMatch.age || 25, position: dbMatch.position || "—", status: "ativo" as Status, risk: "ok" as Risk, nextTraining: "—", coach: dbMatch.coach?.name || "—", objective: dbMatch.goal || "—", phone: dbMatch.phone || "—", city: "—", state: "—", country: "Brasil", weight: dbMatch.weight || "—", height: dbMatch.height || "—", monitoring: generateDefaultMonitoring(dbMatch.id), plannedTrainings: [], completedTrainings: [], pains: [], injuries: [] };
                    setShowAlerts(false);
                    openAthlete(ath);
                  }
                }} className="w-full rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left hover:bg-white/[0.05] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white text-sm">{a.name}</div>
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded", a.type === "dor" ? "text-amber-400 bg-amber-500/10" : a.type === "lesão" ? "text-red-400 bg-red-500/10" : "text-blue-400 bg-blue-500/10")}>{a.type}</div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{a.detail}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{a.date}</div>
                </button>
              )) : <div className="text-sm text-slate-600 text-center py-4">Nenhum alerta</div>}
            </div>
          </div>
        </div>
      )}
      <SectionHeader title="Dashboard" description="Resumo operacional do dia." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarDays} label="Treinos hoje" value={String(todaySessions.length)} helper="Confirmados, pendentes e concluídos" tone="brand" />
        <StatCard icon={Users} label="Atletas ativos" value={String(activeAthleteCount)} helper={`${new Set(todaySessions.map(s => s.athlete)).size} com treino hoje`} tone="default" />
        <div onClick={() => setShowAlerts(true)} className="cursor-pointer">
          <StatCard icon={CircleAlert} label="Alertas físicos" value={String(alertData?.total || 0)} helper={`${alertData?.painCount || 0} dores · ${alertData?.injuryCount || 0} lesões`} tone="warning" />
        </div>
        <StatCard icon={CheckCircle2} label="Conclusão semanal" value={alertData?.completionRate ? `${alertData.completionRate}%` : "—"} helper="Treinos realizados x planejados" tone="success" />
      </div>
      {/* Pendências */}
      {dashNotifData && dashNotifData.count > 0 && (
        <div className="mt-6">
          <SurfaceCard className="border-red-500/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center"><CircleAlert className="w-4 h-4 text-red-400" /></div>
                <div>
                  <CardTitle className="font-display font-medium uppercase tracking-tight text-red-400">Pendências</CardTitle>
                  <CardDescription className="text-slate-500">{dashNotifData.count} treinos não concluídos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {dashNotifData.notifications.slice(0, 10).map((n: any) => (
                <div key={n.id} className="flex items-center justify-between rounded-lg border border-red-500/10 bg-red-500/5 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-white">{n.athleteName}</div>
                    <div className="text-[10px] text-slate-500">{n.date} · {n.time} · {n.detail.split(" · ").slice(1).join(" · ")}</div>
                  </div>
                  <button onClick={goAgenda} className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/10 transition-colors">Ver</button>
                </div>
              ))}
              {dashNotifData.count > 10 && <div className="text-xs text-slate-500 text-center">+{dashNotifData.count - 10} mais pendências</div>}
            </CardContent>
          </SurfaceCard>
        </div>
      )}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_0.7fr] items-start">
        <SurfaceCard>
          <CardHeader><CardTitle className="font-display font-medium uppercase tracking-tight">Agenda do dia</CardTitle><CardDescription className="text-slate-500">Leitura rápida.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {todaySessions.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                <div>
                  <div className="font-display font-medium text-white">{item.time} · {item.athlete}</div>
                  <div className="text-xs text-slate-500 mt-1">{item.type} · {item.coach}</div>
                </div>
                <button onClick={goAgenda} className="bg-primary px-5 py-2 text-[11px] font-bold tracking-[0.2em] text-black uppercase hover:bg-primary-hover transition-all shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-[0_0_20px_rgba(250,204,21,0.4)]">Agenda</button>
              </div>
            ))}
          </CardContent>
        </SurfaceCard>
        <SurfaceCard className="self-start">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display font-medium uppercase tracking-tight">Atletas em atenção</CardTitle>
              <span className={cn("text-xs font-mono", isDark ? "text-slate-500" : "text-gray-400")}>{criticalAthletes.length}</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => setRiskFilter("todos")} className={cn("px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all", riskFilter === "todos" ? "bg-primary text-black" : isDark ? "border border-white/10 text-slate-400 hover:bg-white/5" : "border border-gray-200 text-gray-500 hover:bg-gray-100")}>Todos ({allCritical.length})</button>
              <button onClick={() => setRiskFilter("atenção")} className={cn("px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all", riskFilter === "atenção" ? "bg-amber-500 text-black" : isDark ? "border border-white/10 text-slate-400 hover:bg-white/5" : "border border-gray-200 text-gray-500 hover:bg-gray-100")}>Atenção ({allCritical.filter((a: any) => a.risk === "atenção").length})</button>
              <button onClick={() => setRiskFilter("alto")} className={cn("px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all", riskFilter === "alto" ? "bg-red-500 text-white" : isDark ? "border border-white/10 text-slate-400 hover:bg-white/5" : "border border-gray-200 text-gray-500 hover:bg-gray-100")}>Alto ({allCritical.filter((a: any) => a.risk === "alto").length})</button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[560px] overflow-y-auto space-y-3 pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:hover:bg-white/30">
              {criticalAthletes.length ? criticalAthletes.map((a: any) => (
                <button key={a.id} onClick={() => {
                  const dbMatch = cachedAthletes.find((ca: any) => ca.id === a.id);
                  if (dbMatch) {
                    const ath: Athlete = { id: dbMatch.id, name: dbMatch.name, email: dbMatch.email, age: dbMatch.age || 25, position: dbMatch.position || "—", status: "ativo" as Status, risk: a.risk as Risk, nextTraining: "—", coach: dbMatch.coach?.name || "—", objective: dbMatch.goal || "—", phone: dbMatch.phone || "—", city: "—", state: "—", country: "Brasil", weight: dbMatch.weight || "—", height: dbMatch.height || "—", monitoring: generateDefaultMonitoring(dbMatch.id), plannedTrainings: [], completedTrainings: [], pains: [], injuries: [] };
                    openAthlete(ath);
                  }
                }} className={cn("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors", isDark ? "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]" : "border-gray-200 bg-white hover:bg-gray-50")}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-white/10"><AvatarFallback className="bg-white/10 text-white font-display text-sm">{initials(a.name)}</AvatarFallback></Avatar>
                    <div>
                      <div className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>{a.name}</div>
                      <div className="text-xs text-slate-500">{a.position || "Atleta"} · ACWR {a.acwr}</div>
                    </div>
                  </div>
                  <StatusBadge value={a.risk} />
                </button>
              )) : <div className="text-sm text-slate-500 text-center py-6">{riskData ? "Nenhum atleta em risco." : "Carregando..."}</div>}
            </div>
          </CardContent>
        </SurfaceCard>
      </div>
    </div>
  );
}


const defaultCoachColors: Record<string, string> = {};
for (const c of rawData.coaches) defaultCoachColors[c.name] = c.color;
for (const c of collaboratorsMock) defaultCoachColors[c.name] = c.color;
function getCoachColor(coach: string) {
  return defaultCoachColors[coach] || "#6B7280";
}
function useCoachColor() {
  const { coachColors } = useTheme();
  return (coach: string) => coachColors[coach] || defaultCoachColors[coach] || "#6B7280";
}

const dayFullNames: Record<string, string> = {
  Seg: "Segunda-feira", Ter: "Terça-feira", Qua: "Quarta-feira",
  Qui: "Quinta-feira", Sex: "Sexta-feira", Sáb: "Sábado",
};

// Coach priority order: Zilmar first, then alphabetical
const coachPriority: Record<string, number> = {
  "Zilmar Quadros": 0,
  "Juninho Silveira": 1,
  "Jefferson Miranda": 2,
  "Pepo": 3,
  "Lucas Quarti": 4,
};
function getCoachPriority(name: string): number {
  return coachPriority[name] ?? 99;
}
function sortByCoach<T extends { coach: string; time: string }>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => {
    const coachDiff = getCoachPriority(a.coach) - getCoachPriority(b.coach);
    if (coachDiff !== 0) return coachDiff;
    return a.time.localeCompare(b.time);
  });
}
const dayDates: Record<string, string> = {
  Seg: "23 de março de 2026", Ter: "24 de março de 2026",
  Qua: "25 de março de 2026", Qui: "26 de março de 2026", Sex: "27 de março de 2026", Sáb: "28 de março de 2026",
};

const statusConfig: Record<SessionStatus, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  Confirmado: { icon: CalendarCheck, label: "Treino confirmado", color: "#3B82F6" },
  "Em andamento": { icon: Activity, label: "Treino em andamento", color: "#F59E0B" },
  Concluído: { icon: CheckCircle2, label: "Treino concluído", color: "#84CC16" },
  Pendente: { icon: Clock3, label: "Treino pendente", color: "#6B7280" },
  Cancelado: { icon: CircleAlert, label: "Treino cancelado", color: "#EF4444" },
};

function SessionModal({ session, onClose, onOpenAthlete, onOpenCollaborator, onComplete, isCompleted, onEdit, onDelete, onCancelSession, weekColumns }: { session: AgendaSession; onClose: () => void; onOpenAthlete?: (name: string) => void; onOpenCollaborator?: (name: string) => void; onComplete?: (id: number) => void; isCompleted?: boolean; onEdit?: (id: number, data: Partial<AgendaSession>) => void; onDelete?: (id: number) => void; onCancelSession?: (id: number) => void; weekColumns?: Array<{ key: string; label: string; date: string; fullDate: Date }> }) {
  const getColor = useCoachColor();
  const { canEdit, canDelete, isAdmin } = usePermissions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { athletes: dbAthletes, coaches: dbCoaches, trainingTypes: dbTypes } = useData();
  const color = getColor(session.coach);
  const statusCfg = statusConfig[session.status];
  const StatusIcon = statusCfg.icon;
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    time: session.time, endTime: session.endTime, athlete: session.athlete,
    coach: session.coach, type: session.type, location: session.location, pse: session.pse, summary: "",
  });
  const inputClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-colors";
  const selectClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer";

  const athleteNames = useMemo(() => dbAthletes.length > 0 ? dbAthletes.filter(a => a.isEnabled).map(a => a.name).sort() : [session.athlete], [dbAthletes]);
  const coachNames = useMemo(() => dbCoaches.length > 0 ? dbCoaches.filter(c => c.isEnabled).map(c => c.name).sort() : [session.coach], [dbCoaches]);
  const typeNames = useMemo(() => dbTypes.length > 0 ? dbTypes.filter(t => t.isEnabled).map(t => t.name).sort() : [session.type], [dbTypes]);

  function handleSave() {
    if (onEdit) onEdit(session.id, editData);
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border bg-[#0B0F14] p-0 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ borderColor: `${color}30` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }} />

        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">{editing ? "Editar agendamento" : "Agendamento"}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] transition-colors text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Hora de início</div>
                  <input type="time" value={editData.time} onChange={(e) => setEditData({ ...editData, time: e.target.value })} className={cn(inputClass, "[color-scheme:dark]")} />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Hora do fim</div>
                  <input type="time" value={editData.endTime} onChange={(e) => setEditData({ ...editData, endTime: e.target.value })} className={cn(inputClass, "[color-scheme:dark]")} />
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Atleta</div>
                <select value={editData.athlete} onChange={(e) => setEditData({ ...editData, athlete: e.target.value })} className={selectClass}>
                  {athleteNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Treinador</div>
                <select value={editData.coach} onChange={(e) => setEditData({ ...editData, coach: e.target.value })} className={selectClass}>
                  {coachNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo de Treino</div>
                <select value={editData.type} onChange={(e) => setEditData({ ...editData, type: e.target.value })} className={selectClass}>
                  {typeNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Local</div>
                <select value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })} className={selectClass}>
                  {["Academia", "Campo", "CT", "Home"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descrição</div>
                <textarea value={editData.summary} onChange={(e) => setEditData({ ...editData, summary: e.target.value })} placeholder="Detalhes do treino..." rows={2} className={cn(inputClass, "resize-none")} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">PSE Planejada</div>
                <input type="number" min={0} max={10} value={editData.pse} onChange={(e) => setEditData({ ...editData, pse: Number(e.target.value) })} className={inputClass} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-3 rounded-xl border border-white/20 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-colors">Cancelar</button>
                <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-primary text-black text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-primary-hover transition-all shadow-glow">Salvar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {/* Row 1: Day + Times */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-end">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">Dia</div>
                    <div className="text-sm font-display font-medium text-white">{(() => {
                      const col = weekColumns?.find(c => c.key === session.day);
                      if (col?.fullDate) {
                        return col.fullDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                      }
                      return `${dayFullNames[session.day] || session.day}`;
                    })()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">Início</div>
                    <div className="text-xl font-display font-bold text-white">{session.time}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">Fim</div>
                    <div className="text-xl font-display font-bold text-white">{session.endTime}</div>
                  </div>
                </div>

                {/* Row 2: Athlete + Coach */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">Atleta</div>
                    <button onClick={() => onOpenAthlete?.(session.athlete)} className="text-sm font-medium underline decoration-dotted underline-offset-4 hover:brightness-125 transition-all cursor-pointer truncate block max-w-full" style={{ color }}>{session.athlete}</button>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">Treinador</div>
                    <button onClick={() => onOpenCollaborator?.(session.coach)} className="flex items-center gap-1.5 underline decoration-dotted underline-offset-4 hover:brightness-125 transition-all cursor-pointer">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium truncate" style={{ color }}>{session.coach}</span>
                    </button>
                  </div>
                </div>

                {/* Row 3: Type + Local */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">Tipo de Treino</div>
                    <div className="text-sm font-medium" style={{ color }}>{session.type}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">Local</div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-300"><MapPin className="w-3.5 h-3.5 text-slate-500" />{session.location}</div>
                  </div>
                </div>

                {/* Row 4: PSE + Status + Intensity */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5">PSE</div>
                    <div className="inline-flex items-center justify-center w-9 h-9 rounded-full border-2 text-xs font-display font-bold" style={{ borderColor: color, color }}>{session.pse}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5">Status</div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium" style={{ borderColor: `${statusCfg.color}30`, backgroundColor: `${statusCfg.color}15`, color: statusCfg.color }}>
                      <StatusIcon className="w-3.5 h-3.5" />{statusCfg.label.replace("Treino ", "")}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5">Intensidade</div>
                    <div className={cn("inline-flex px-2.5 py-1 rounded-md border text-[10px] font-bold font-mono uppercase tracking-wider",
                      session.intensity === "Alta" ? "border-red-500/20 bg-red-500/10 text-red-400" :
                      session.intensity === "Média" ? "border-amber-500/20 bg-amber-500/10 text-amber-400" :
                      "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    )}>{session.intensity}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {((session.status !== "Concluído" && session.status !== "Cancelado") || isAdmin) && (
                  <button onClick={() => setEditing(true)} className="w-full py-3 rounded-xl border border-primary/30 text-primary text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-primary/10 transition-colors flex items-center justify-center gap-2">
                    <Settings className="w-4 h-4" /> Editar
                  </button>
                )}
                {!isCompleted && session.status !== "Concluído" && session.status !== "Cancelado" && onComplete && (
                  <button onClick={() => onComplete(session.id)} className="w-full py-3 rounded-xl bg-emerald-500 text-black text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(132,204,22,0.3)] flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Concluir treino
                  </button>
                )}
                {!isCompleted && session.status !== "Concluído" && session.status !== "Cancelado" && onCancelSession && (
                  <button onClick={() => onCancelSession(session.id)} className="w-full py-3 rounded-xl border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-2">
                    <CircleAlert className="w-4 h-4" /> Cancelar treino
                  </button>
                )}
                {isCompleted && (
                  <div className="w-full py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Treino concluído
                  </div>
                )}
                {session.status === "Cancelado" && (
                  <div className="w-full py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2">
                    <CircleAlert className="w-4 h-4" /> Treino cancelado
                  </div>
                )}
                {(canDelete || isCompleted || session.status === "Concluído") && onDelete && !confirmDelete && (
                  <button onClick={() => setConfirmDelete(true)} className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Excluir agendamento
                  </button>
                )}
                {confirmDelete && (
                  <div className="w-full rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-red-400 font-medium">
                      <AlertTriangle className="w-4 h-4" /> Tem certeza que deseja excluir este agendamento?
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-lg border border-white/20 text-white text-[11px] font-bold tracking-[0.15em] uppercase hover:bg-white/5 transition-colors">Cancelar</button>
                      <button onClick={() => onDelete?.(session.id)} className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-[11px] font-bold tracking-[0.15em] uppercase hover:bg-red-400 transition-all flex items-center justify-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={onClose} className="mt-3 w-full py-3 rounded-xl border border-white/20 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-colors">Fechar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Searchable Dropdown ─── */
function SearchableDropdown({ label, placeholder, options, value, onChange }: { label: string; placeholder: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const filtered = options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div ref={ref} className="relative">
      <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">{label}</div>
      <button type="button" onClick={() => { setOpen(!open); setFilter(""); }} className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-left transition-colors hover:border-white/20">
        <span className={value ? "text-white" : "text-slate-500"}>{value || placeholder}</span>
        <ChevronRight className={cn("w-4 h-4 text-slate-500 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#0B0F14] shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
            <Search className="w-4 h-4 text-slate-500" />
            <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Digite para filtrar..." className="bg-transparent text-sm text-white placeholder:text-slate-500 outline-none w-full" />
          </div>
          <div className="max-h-[200px] overflow-y-auto hide-scrollbar">
            {filtered.length ? filtered.map((o) => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }} className={cn("w-full text-left px-4 py-2.5 text-sm transition-colors", o === value ? "bg-primary/20 text-primary" : "text-slate-300 hover:bg-white/5")}>
                {o}
              </button>
            )) : <div className="px-4 py-3 text-sm text-slate-500">Nenhum resultado</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Mini Calendar ─── */
function MiniCalendar({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const [viewMonth, setViewMonth] = useState(2); // March = 2 (0-indexed)
  const [viewYear, setViewYear] = useState(2026);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const cells: Array<{ day: number; current: boolean }> = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, current: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) for (let d = 1; d <= remaining; d++) cells.push({ day: d, current: false });

  return (
    <div className="rounded-lg border border-white/10 bg-[#0B0F14] p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }} className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-medium text-white">{months[viewMonth]} {viewYear}</span>
        <button type="button" onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }} className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sab"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          const dateStr = c.current ? `${String(c.day).padStart(2, "0")}/${String(viewMonth + 1).padStart(2, "0")}/${viewYear}` : "";
          const isSelected = dateStr === value;
          const isToday = c.current && c.day === 28 && viewMonth === 2 && viewYear === 2026;
          return (
            <button key={i} type="button" disabled={!c.current} onClick={() => { if (c.current) { onChange(dateStr); onClose(); } }}
              className={cn("w-8 h-8 rounded-full text-sm flex items-center justify-center transition-colors",
                !c.current && "text-slate-600",
                c.current && !isSelected && !isToday && "text-slate-300 hover:bg-white/10",
                isToday && !isSelected && "bg-white/10 text-white font-bold",
                isSelected && "bg-primary text-black font-bold",
              )}>{c.day}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── New Schedule Modal ─── */
function NewScheduleModal({ onClose, onSave, onSaveBulk, initialDate, initialTime }: { onClose: () => void; onSave: (session: AgendaSession) => void; onSaveBulk?: (sessions: Array<{ day: string; date: Date; time: string; endTime: string; athlete: string; coach: string; type: string; pse: number }>) => void; initialDate?: string; initialTime?: string }) {
  const [tab, setTab] = useState<"agendar" | "detalhes">("agendar");
  const [date, setDate] = useState(initialDate || "");
  const [startTime, setStartTime] = useState(initialTime || "");
  const [endTime, setEndTime] = useState(() => {
    if (!initialTime) return "";
    const [h, m] = initialTime.split(":").map(Number);
    const total = h * 60 + m + 50;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  });
  const [athlete, setAthlete] = useState("");
  const [coach, setCoach] = useState("");
  const [recurrence, setRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<"semanal" | "quinzenal" | "mensal">("semanal");
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [showRecurrenceCalendar, setShowRecurrenceCalendar] = useState(false);
  const [trainingType, setTrainingType] = useState("Livre");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [pse, setPse] = useState(4);
  const [showCalendar, setShowCalendar] = useState(false);

  const { athletes: dbAthletesList, coaches: dbCoachesList, trainingTypes: dbTypesList } = useData();

  const athleteNames = useMemo(() => {
    if (dbAthletesList.length > 0) {
      return Array.from(new Set(dbAthletesList.filter(a => a.isEnabled).map(a => a.name))).sort();
    }
    return Array.from(new Set(athletesMock.map(a => a.name))).sort();
  }, [dbAthletesList]);

  const coachNames = useMemo(() => {
    if (dbCoachesList.length > 0) {
      return Array.from(new Set(dbCoachesList.filter(c => c.isEnabled).map(c => c.name))).sort();
    }
    return Array.from(new Set(collaboratorsMock.map(c => c.name))).sort();
  }, [dbCoachesList]);

  const trainingTypes = useMemo(() => {
    if (dbTypesList.length > 0) {
      return dbTypesList.filter(t => t.isEnabled).map(t => t.name).sort();
    }
    return trainingTypesMock.filter(t => t.status === "ativo").map(t => t.name).sort();
  }, [dbTypesList]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B0F14] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between mb-5">
            <h2 className="text-xl font-display font-bold text-white">Novo agendamento</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] transition-colors text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {/* Block schedule button */}
          <button type="button" className="w-full py-3 rounded-xl border-2 border-primary/50 text-white text-sm font-bold uppercase tracking-wider hover:bg-primary/10 transition-colors mb-4">
            Bloquear horário na agenda
          </button>

          {/* Tabs */}
          <div className="flex border border-white/10 rounded-lg overflow-hidden mb-6">
            <button type="button" onClick={() => setTab("agendar")} className={cn("flex-1 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors", tab === "agendar" ? "bg-white text-black" : "text-slate-400 hover:bg-white/5")}>Agendar para</button>
            <button type="button" onClick={() => setTab("detalhes")} className={cn("flex-1 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors", tab === "detalhes" ? "bg-white text-black" : "text-slate-400 hover:bg-white/5")}>Detalhes do Treino</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-6">
          {tab === "agendar" ? (
            <div className="space-y-5">
              {/* Date */}
              <div className="relative">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Dia</div>
                <button type="button" onClick={() => setShowCalendar(!showCalendar)} className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm transition-colors hover:border-white/20">
                  <span className={date ? "text-white" : "text-slate-500"}>{date || "Selecione a data"}</span>
                  <CalendarIcon className="w-4 h-4 text-slate-500" />
                </button>
                {showCalendar && (
                  <div className="absolute z-50 mt-1 left-0"><MiniCalendar value={date} onChange={setDate} onClose={() => setShowCalendar(false)} /></div>
                )}
              </div>

              {/* Start/End time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Hora de início</div>
                  <div className="flex items-center rounded-lg border border-white/10 bg-[#050505] px-4 py-3 gap-2">
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-transparent text-sm text-white outline-none w-full [color-scheme:dark]" placeholder="--:--" />
                    <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Hora do fim</div>
                  <div className="flex items-center rounded-lg border border-white/10 bg-[#050505] px-4 py-3 gap-2">
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-transparent text-sm text-white outline-none w-full [color-scheme:dark]" placeholder="--:--" />
                    <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  </div>
                </div>
              </div>

              {/* Athlete */}
              <SearchableDropdown label="Atleta" placeholder="Selecione o Atleta" options={athleteNames} value={athlete} onChange={setAthlete} />

              {/* Coach */}
              <SearchableDropdown label="Treinador" placeholder="Selecione o treinador" options={coachNames} value={coach} onChange={setCoach} />

              {/* Recurrence */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors", recurrence ? "border-primary bg-primary" : "border-white/20 bg-transparent")} onClick={() => setRecurrence(!recurrence)}>
                  {recurrence && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                </div>
                <span className="text-sm font-medium text-white">Habilitar recorrência</span>
              </label>

              {recurrence && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                  {/* Frequency */}
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Frequência</div>
                    <div className="flex gap-2">
                      {(["semanal", "quinzenal", "mensal"] as const).map((opt) => (
                        <button key={opt} type="button" onClick={() => setRecurrenceType(opt)} className={cn("flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all", recurrenceType === opt ? "border-primary bg-primary/20 text-primary" : "border-white/10 text-slate-400 hover:border-white/20")}>
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Days of week */}
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Dias da semana</div>
                    <div className="flex gap-1.5">
                      {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                        <button key={d} type="button" onClick={() => setRecurrenceDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])} className={cn("flex-1 py-2 rounded-lg text-[11px] font-bold border transition-all", recurrenceDays.includes(d) ? "border-primary bg-primary/20 text-primary" : "border-white/10 text-slate-500 hover:border-white/20")}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* End date */}
                  <div className="relative">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Repetir até</div>
                    <button type="button" onClick={() => setShowRecurrenceCalendar(!showRecurrenceCalendar)} className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm transition-colors hover:border-white/20">
                      <span className={recurrenceEndDate ? "text-white" : "text-slate-500"}>{recurrenceEndDate || "Selecione a data final"}</span>
                      <CalendarIcon className="w-4 h-4 text-slate-500" />
                    </button>
                    {showRecurrenceCalendar && (
                      <div className="absolute z-50 mt-1 left-0"><MiniCalendar value={recurrenceEndDate} onChange={setRecurrenceEndDate} onClose={() => setShowRecurrenceCalendar(false)} /></div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 space-y-3">
                <button type="button" onClick={() => setTab("detalhes")} className="w-full py-3 rounded-xl bg-primary text-black text-sm font-bold uppercase tracking-[0.2em] hover:bg-primary-hover transition-all shadow-glow">Avançar</button>
                <button type="button" onClick={onClose} className="w-full py-3 rounded-xl border border-white/20 text-white text-sm font-bold uppercase tracking-[0.2em] hover:bg-white/5 transition-colors">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Training type */}
              <SearchableDropdown label="Tipo de Treino" placeholder="Selecione o tipo" options={trainingTypes} value={trainingType} onChange={setTrainingType} />

              {/* Description */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Descrição</div>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o treinamento..." rows={3} className="w-full rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none resize-none focus:border-primary/50 transition-colors" />
              </div>

              {/* Duration - fixed at 50min */}

              {/* PSE */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">PSE Planejado</div>
                <input type="number" min={0} max={10} value={pse} onChange={(e) => setPse(Number(e.target.value))} className="w-full rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-colors mb-3" />
                <input type="range" min={0} max={10} value={pse} onChange={(e) => setPse(Number(e.target.value))} className="w-full h-1.5 appearance-none bg-white/10 rounded-full cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black" />
                <button type="button" className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 hover:text-white transition-colors">
                  <Info className="w-3.5 h-3.5" /> Ver escala
                </button>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-3">
                <button type="button" onClick={() => {
                  const pseVal = pse || 4;
                  const endT = endTime || (() => {
                    if (!startTime) return "06:20";
                    const [h, m] = startTime.split(":").map(Number);
                    const total = h * 60 + m + 50;
                    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                  })();

                  const dayKeyMap: Record<string, number> = { "Seg": 1, "Ter": 2, "Qua": 3, "Qui": 4, "Sex": 5, "Sáb": 6 };
                  const dayNameMap: Record<number, string> = { 0: "Sáb", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

                  function makeSession(dayKey: string): AgendaSession {
                    return {
                      id: Date.now() + Math.random() * 10000,
                      day: dayKey,
                      time: startTime || "05:30",
                      endTime: endT,
                      athlete: athlete || "Atleta",
                      type: trainingType || "Treino",
                      coach: coach || "Treinador",
                      status: "Confirmado" as SessionStatus,
                      location: "Academia",
                      intensity: (pseVal >= 5 ? "Alta" : pseVal >= 3 ? "Média" : "Baixa") as Intensity,
                      pse: pseVal,
                    };
                  }

                  if (recurrence && recurrenceDays.length > 0 && recurrenceEndDate && onSaveBulk) {
                    // Parse end date (DD/MM/YYYY)
                    const endParts = recurrenceEndDate.split("/");
                    const endDt = endParts.length >= 3
                      ? new Date(Number(endParts[2]), Number(endParts[1]) - 1, Number(endParts[0]), 23, 59, 59)
                      : new Date();

                    // Find next Monday from today
                    const today = new Date();
                    const todayDow = today.getDay(); // 0=Sun, 1=Mon...6=Sat
                    const daysUntilMonday = todayDow === 0 ? 1 : todayDow === 1 ? 0 : 8 - todayDow;
                    const firstMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilMonday, 12, 0, 0);

                    const stepWeeks = recurrenceType === "semanal" ? 1 : recurrenceType === "quinzenal" ? 2 : 4;
                    const dayOffsets: Record<string, number> = { "Seg": 0, "Ter": 1, "Qua": 2, "Qui": 3, "Sex": 4, "Sáb": 5 };

                    const bulk: Array<{ day: string; date: Date; time: string; endTime: string; athlete: string; coach: string; type: string; pse: number }> = [];

                    let weekMonday = new Date(firstMonday);
                    let safety = 0;
                    while (weekMonday <= endDt && safety < 200) {
                      safety++;
                      for (const dayKey of recurrenceDays) {
                        const offset = dayOffsets[dayKey] ?? 0;
                        const sessionDate = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() + offset, 12, 0, 0);
                        if (sessionDate >= today && sessionDate <= endDt) {
                          bulk.push({
                            day: dayKey, date: new Date(sessionDate),
                            time: startTime || "05:30", endTime: endT,
                            athlete: athlete || "Atleta", coach: coach || "Treinador",
                            type: trainingType || "Treino", pse: pseVal,
                          });
                        }
                      }
                      weekMonday = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() + 7 * stepWeeks, 12, 0, 0);
                    }

                    console.log(`Recurrence: ${bulk.length} sessions, days=${recurrenceDays.join(",")}, until=${recurrenceEndDate}, type=${recurrenceType}`);
                    onSaveBulk(bulk);
                  } else {
                    // Single session — parse selected date
                    const parts = (date || "").split("/");
                    let parsedDate: Date | null = null;
                    let dayOfWeek = "Seg";
                    if (parts.length >= 3) {
                      parsedDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
                      dayOfWeek = dayNameMap[parsedDate.getDay()] || "Seg";
                    }
                    const sess = makeSession(dayOfWeek);
                    // Attach parsed date for the onSave handler
                    (sess as any)._parsedDate = parsedDate;
                    onSave(sess);
                  }
                }} className="w-full py-3 rounded-xl bg-primary text-black text-sm font-bold uppercase tracking-[0.2em] hover:bg-primary-hover transition-all shadow-glow">Agendar</button>
                <button type="button" onClick={onClose} className="w-full py-3 rounded-xl border border-white/20 text-white text-sm font-bold uppercase tracking-[0.2em] hover:bg-white/5 transition-colors">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getWeekDates(baseMonday: Date) {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const labels = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return days.map((key, i) => {
    const d = new Date(baseMonday);
    d.setDate(baseMonday.getDate() + i);
    return { key, label: labels[i], date: String(d.getDate()), fullDate: d };
  });
}

function formatWeekRange(baseMonday: Date) {
  const end = new Date(baseMonday);
  end.setDate(baseMonday.getDate() + 5);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${fmt(baseMonday)} — ${fmt(end)}`;
}

/* ─── Kanban DnD Components ─── */
function TimelineCell({ droppableId, className, children, onMouseEnter, onMouseLeave }: { droppableId: string; className?: string; children: React.ReactNode; onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "bg-primary/10 ring-1 ring-primary/30")} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </div>
  );
}

function TimelineDraggableCard({ id, children, enabled }: { id: number; children: React.ReactNode; enabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: !enabled });
  const style: React.CSSProperties = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50, opacity: 0.8 } : {};
  return (
    <div ref={setNodeRef} {...(enabled ? { ...listeners, ...attributes } : {})} style={style} className={cn("flex-1 min-w-0", isDragging && "shadow-2xl ring-2 ring-primary/50 rounded-lg", enabled && "cursor-grab active:cursor-grabbing")}>
      {children}
    </div>
  );
}

function DroppableColumn({ id, title, count, color, children }: { id: string; title: string; count: number; color: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SurfaceCard className={cn("transition-all", isOver && "ring-2 ring-primary/50")}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />{title}</span>
          <span className="text-xs text-slate-500">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent ref={setNodeRef} className="space-y-3 min-h-[100px]">
        {children}
      </CardContent>
    </SurfaceCard>
  );
}

function DraggableCard({ id, session, getColor, isCompleted, onClick }: { id: number; session: AgendaSession; getColor: (coach: string) => string; isCompleted: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const color = getColor(session.coach);
  const cancelled = session.status === "Cancelado";
  const done = isCompleted || session.status === "Concluído";
  const cardColor = cancelled ? "#6B7280" : done ? "#FACC15" : color;

  const style: React.CSSProperties = {
    borderColor: `${cardColor}40`,
    backgroundColor: `${cardColor}10`,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={onClick}
      className={cn("rounded-lg border p-4 relative overflow-hidden cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]", cancelled && "opacity-50")}
    >
      <div className="w-full h-[2px] rounded-full absolute top-0 left-0" style={{ backgroundColor: cardColor }} />
      <div className="text-[10px] font-mono text-slate-500">{session.day} · {session.time}</div>
      <div className="mt-1 text-sm font-medium text-white">{cancelled ? "✕ " : done ? "✓ " : ""}{session.athlete}</div>
      <div className="text-xs text-slate-500 mt-0.5">{session.type}</div>
      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />{session.coach}</div>
    </div>
  );
}

function AgendaPage({ openAthlete, goToCollaborators }: { openAthlete: (a: Athlete, tab?: string, newTraining?: Athlete["completedTrainings"][0]) => void; goToCollaborators: () => void }) {
  const { canCreate, canEdit } = usePermissions();
  const { athletes: cachedAthletes, coaches: cachedCoaches, trainingTypes: cachedTypes } = useData();

  // Lookup helpers using cached data (no extra API calls)
  const findAthleteId = useCallback((name: string) => cachedAthletes.find(a => a.name === name)?.id, [cachedAthletes]);
  const findCoachId = useCallback((name: string) => cachedCoaches.find(c => c.name === name)?.id, [cachedCoaches]);
  const findTypeId = useCallback((name: string) => cachedTypes.find(t => t.name === name)?.id, [cachedTypes]);
  const [view, setView] = useState<AgendaView>("timeline");
  const [timePeriod, setTimePeriod] = useState<"semana" | "dia" | "mes">("semana");
  const [dailyDate, setDailyDate] = useState(() => new Date());
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [coachFilter, setCoachFilter] = useState("todos");
  const [zoomPercent, setZoomPercent] = useState(30);
  const [hoveredSession, setHoveredSession] = useState<number | null>(null);
  // Week navigation: base Monday date (real-time, sunday shows next week)
  const [weekOffset, setWeekOffset] = useState(0);
  const baseMonday = useMemo(() => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    // If Sunday (0), jump to next Monday
    const diff = day === 0 ? -6 + 7 : (day + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7) + (day === 0 ? 7 : 0) + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [weekOffset]);
  const currentWeekColumns = useMemo(() => getWeekDates(baseMonday), [baseMonday]);
  // Build week key from baseMonday to lookup in allSchedulesByWeek
  const weekKey = useMemo(() => {
    const y = baseMonday.getFullYear();
    const m = String(baseMonday.getMonth() + 1).padStart(2, "0");
    const d = String(baseMonday.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [baseMonday]);

  const statusMapFn = (s: string): SessionStatus => s === "Confirmado" ? "Confirmado" : "Pendente";
  const intensityFn = (pse: number): Intensity => pse >= 5 ? "Alta" : pse >= 3 ? "Média" : "Baixa";

  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<AgendaSession | null>(null);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [newScheduleSlot, setNewScheduleSlot] = useState<{ date: string; time: string } | null>(null);
  const [extraSessions, setExtraSessions] = useState<AgendaSession[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<number, SessionStatus>>({});

  // Fetch sessions from DB for this week
  const { data: dbWeekSessions, refetch: refetchWeekSessions } = useApi<Session[]>(`/api/sessions?weekStart=${weekKey}`);

  const weekSessions: AgendaSession[] = useMemo(() => {
    // If we have DB sessions, use them
    if (dbWeekSessions && dbWeekSessions.length > 0) {
      const fromDb = dbWeekSessions.map((s: Session) => ({
        id: s.id,
        day: getDayKey(new Date(s.date)),
        time: s.startTime,
        endTime: s.endTime,
        athlete: s.athlete.name, athleteId: s.athlete.id,
        type: s.trainingType.name,
        coach: s.coach.name,
        status: (s.status === "Concluído" ? "Concluído" : s.status === "Em andamento" ? "Em andamento" : s.status === "Confirmado" ? "Confirmado" : s.status === "Cancelado" ? "Cancelado" : "Pendente") as SessionStatus,
        location: s.location,
        intensity: (s.psePlanned >= 5 ? "Alta" : s.psePlanned >= 3 ? "Média" : "Baixa") as Intensity,
        pse: s.psePlanned,
      }));
      // Filter out sessions that were moved locally (exist in extraSessions)
      const movedIds = new Set(extraSessions.map(s => s.id));
      return [...fromDb.filter(s => !movedIds.has(s.id)), ...extraSessions];
    }
    // Fallback to mock data
    const allByWeek = (rawData as any).allSchedulesByWeek || {};
    const weekData = allByWeek[weekKey];
    const base = weekData ? weekData.map((s: any) => ({
      id: s.id, day: s.day, time: s.time, endTime: s.endTime, athlete: s.athlete,
      type: s.type, coach: s.coach, status: statusMapFn(s.status),
      location: s.location || "Academia", intensity: intensityFn(s.pse), pse: s.pse,
    })) : [];
    return [...base, ...extraSessions.filter((s) => {
      const cols = currentWeekColumns.map((c) => c.key);
      return cols.includes(s.day);
    })];
  }, [weekKey, extraSessions, currentWeekColumns, dbWeekSessions]);
  const [completedIds, setCompletedIds] = useState<Set<number>>(() => new Set(agendaSessionsMock.filter((s) => s.status === "Concluído").map((s) => s.id)));

  function isCompleted(id: number) {
    return completedIds.has(id);
  }

  // zoom: 0% = 0.5x scale, 50% = 1x (default), 100% = 2x
  const zoomScale = 0.5 + (zoomPercent / 100) * 1.5;

  const { isAdmin, user: currentUserPerm } = usePermissions();
  const { coaches: dbCoachesForFilter } = useData();

  // Find coach name linked to the logged-in user's email
  const myCoachName = useMemo(() => {
    if (isAdmin) return null;
    const match = dbCoachesForFilter.find(c => c.email.toLowerCase() === currentUserPerm.email.toLowerCase());
    return match?.name || null;
  }, [isAdmin, currentUserPerm.email, dbCoachesForFilter]);

  const filteredSessions = useMemo(() => {
    return weekSessions.filter((s) => {
      // Personais veem apenas seus próprios treinos
      if (!isAdmin && myCoachName) {
        if (s.coach !== myCoachName) return false;
      }
      const matchesQuery = !query || `${s.athlete} ${s.type} ${s.coach}`.toLowerCase().includes(query.toLowerCase());
      const matchesCoach = coachFilter === "todos" || s.coach === coachFilter;
      return matchesQuery && matchesCoach;
    });
  }, [query, coachFilter, weekSessions, isAdmin, myCoachName]);

  const sessionsByDay = useMemo(() => {
    return currentWeekColumns.reduce<Record<string, AgendaSession[]>>((acc, col) => {
      acc[col.key] = sortByCoach(filteredSessions.filter((s) => s.day === col.key));
      return acc;
    }, {});
  }, [filteredSessions, currentWeekColumns]);

  const sessionsByStatus = useMemo(() => {
    const getStatus = (s: AgendaSession): SessionStatus => statusOverrides[s.id] || s.status;
    return {
      Confirmado: sortByCoach(filteredSessions.filter((s) => getStatus(s) === "Confirmado")),
      "Em andamento": sortByCoach(filteredSessions.filter((s) => getStatus(s) === "Em andamento")),
      Concluído: sortByCoach(filteredSessions.filter((s) => getStatus(s) === "Concluído")),
      Pendente: sortByCoach(filteredSessions.filter((s) => getStatus(s) === "Pendente")),
      Cancelado: sortByCoach(filteredSessions.filter((s) => getStatus(s) === "Cancelado")),
    };
  }, [filteredSessions, statusOverrides]);

  const sessionsByCoach = useMemo(() => {
    const grouped = filteredSessions.reduce<Record<string, AgendaSession[]>>((acc, s) => {
      if (!acc[s.coach]) acc[s.coach] = [];
      acc[s.coach].push(s);
      return acc;
    }, {});
    // Sort each coach's sessions and return in coach priority order
    const sorted: Record<string, AgendaSession[]> = {};
    Object.keys(grouped).sort((a, b) => getCoachPriority(a) - getCoachPriority(b)).forEach(k => {
      sorted[k] = sortByCoach(grouped[k]);
    });
    return sorted;
  }, [filteredSessions]);

  const coachOptions = useMemo(() => Array.from(new Set(agendaSessionsMock.map((s) => s.coach))), []);
  const getColor = useCoachColor();

  const timelineSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  function handleTimelineDragEnd(event: any) {
    const { active, over } = event;
    if (!active || !over || !isAdmin) return;
    const sessionId = active.id as number;
    const [targetDay, targetTime] = (over.id as string).split("|");
    if (!targetDay || !targetTime) return;

    const sess = weekSessions.find(s => s.id === sessionId);
    if (!sess || (sess.day === targetDay && sess.time === targetTime)) return;

    // Calculate new end time
    const [h, m] = targetTime.split(":").map(Number);
    const total = h * 60 + m + 50;
    const newEndTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

    // Find the new date from currentWeekColumns
    const col = currentWeekColumns.find(c => c.key === targetDay);
    if (!col?.fullDate) return;
    const y = col.fullDate.getFullYear();
    const mo = String(col.fullDate.getMonth() + 1).padStart(2, "0");
    const d = String(col.fullDate.getDate()).padStart(2, "0");

    // Update locally INSTANTLY — move session in extraSessions
    setExtraSessions(prev => {
      // Remove from extras if exists, add moved version
      const filtered = prev.filter(s => s.id !== sessionId);
      return [...filtered, { ...sess, day: targetDay, time: targetTime, endTime: newEndTime }];
    });

    // Persist to DB in background (no refetch needed for instant feel)
    apiPut(`/api/sessions/${sessionId}`, {
      date: `${y}-${mo}-${d}T12:00:00.000Z`,
      startTime: targetTime,
      endTime: newEndTime,
    }).catch(() => {});
  }

  const renderTimelineView = () => (
    <DndContext sensors={timelineSensors} onDragEnd={handleTimelineDragEnd}>
    <SurfaceCard>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Grade horária</CardTitle>
            <CardDescription className="text-slate-500 mt-1">05:30 até 22:00, em blocos de 50 minutos.</CardDescription>
          </div>
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <button onClick={() => setZoomPercent(Math.max(0, zoomPercent - 10))} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
            <div className="flex items-center gap-3 w-[200px]">
              <input
                type="range"
                min={0}
                max={100}
                value={zoomPercent}
                onChange={(e) => setZoomPercent(Number(e.target.value))}
                className="w-full h-1.5 appearance-none bg-white/10 rounded-full cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
            <button onClick={() => setZoomPercent(Math.min(100, zoomPercent + 10))} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
            <span className="text-sm font-mono font-bold text-primary min-w-[42px] text-right">{zoomPercent}%</span>
            {zoomPercent !== 30 && <button onClick={() => setZoomPercent(30)} className="text-[10px] font-mono uppercase tracking-widest text-slate-500 hover:text-white transition-colors border border-white/10 rounded px-2 py-1">Reset</button>}
          </div>
        </div>
        {/* Coach legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Personais:</span>
          {coachOptions.map((coach) => (
            <div key={coach} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: getColor(coach) }} />
              <span className="text-[11px] text-slate-400">{coach}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "top left", width: `${100 / zoomScale}%` }}>
          <div className="min-w-[960px]">
            <div className="grid grid-cols-[80px_repeat(6,minmax(0,1fr))] border-b border-white/10 bg-white/[0.02]">
              <div className="px-3 py-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">Hora</div>
              {currentWeekColumns.map((col) => (
                <div key={col.key} className="border-l border-white/10 px-3 py-3 text-center">
                  <div className="text-sm font-display font-medium text-white">{col.label}</div>
                  <div className="text-[10px] font-mono text-slate-500">{col.date}/{String(col.fullDate.getMonth() + 1).padStart(2, "0")}</div>
                </div>
              ))}
            </div>
            {timeSlots.map((slot) => (
              <div key={slot} className="grid grid-cols-[80px_repeat(6,minmax(0,1fr))] border-b border-white/5">
                <div className="px-3 flex items-start pt-3 text-[10px] font-mono font-medium text-slate-500 min-h-[80px]">{slot}</div>
                {currentWeekColumns.map((col) => {
                  // Match sessions to nearest slot (handles broken times like 05:10, 06:00)
                  const slotIdx = timeSlots.indexOf(slot);
                  const nextSlot = timeSlots[slotIdx + 1] || "23:59";
                  const sessions = sessionsByDay[col.key]?.filter((i) => {
                    if (i.time === slot) return true;
                    // If time doesn't match any slot exactly, put in nearest slot
                    if (!timeSlots.includes(i.time) && i.time >= slot && i.time < nextSlot) return true;
                    return false;
                  }) || [];
                  const slotKey = `${col.key}-${slot}`;
                  const isSlotHovered = hoveredSlot === slotKey;
                  const hasMultiple = sessions.length > 1;
                  const droppableId = `${col.key}|${slot}`;
                  return (
                    <TimelineCell key={slotKey} droppableId={droppableId} className={cn("border-l border-white/10 p-1 min-h-[80px] relative group/cell", !isAdmin && isSlotHovered && sessions.length > 0 && "z-30")}
                      onMouseEnter={() => !isAdmin && sessions.length > 0 && setHoveredSlot(slotKey)}
                      onMouseLeave={() => setHoveredSlot(null)}
                    >
                      {/* Add button visible on hover */}
                      {canCreate && sessions.length > 0 && (
                        <button
                          onClick={() => { setNewScheduleSlot({ date: (() => { const c = currentWeekColumns.find(cc => cc.key === col.key); return c?.fullDate ? `${String(c.fullDate.getDate()).padStart(2,"0")}/${String(c.fullDate.getMonth()+1).padStart(2,"0")}/${c.fullDate.getFullYear()}` : ""; })(), time: slot }); setShowNewSchedule(true); }}
                          className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-primary text-black flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity hover:scale-110"
                          title="Adicionar treino"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                      {sessions.length > 0 ? (
                        <>
                          {/* Normal: side by side (no hover, or single session without hover) */}
                          {!isSlotHovered ? (
                            <div className={cn("flex gap-1 h-full", hasMultiple ? "flex-row" : "")}>
                              {sessions.map((session) => {
                                const coachColor = getColor(session.coach);
                                const done = isCompleted(session.id) || session.status === "Concluído";
                                const cancelled = session.status === "Cancelado";
                                const color = cancelled ? "#6B7280" : done ? "#FACC15" : coachColor;
                                return (<TimelineDraggableCard key={session.id} id={session.id} enabled={isAdmin}>
                                  <div
                                    
                                    className={cn("relative rounded-lg border transition-all cursor-pointer flex-1 min-w-0 overflow-hidden p-2", cancelled && "opacity-50")}
                                    style={{ borderColor: `${color}40`, backgroundColor: `${color}15` }}
                                    onClick={() => setSelectedSession(session)}
                                  >
                                    <div className="w-full h-[3px] rounded-full absolute top-0 left-0" style={{ backgroundColor: color }} />
                                    <div className="font-bold mt-1 truncate text-[10px]" style={{ color }}>{cancelled ? "✕ " : done ? "✓ " : ""}{session.time} – {session.type}</div>
                                    <div className={cn("font-medium truncate mt-0.5 text-xs", cancelled ? "text-slate-500" : "text-white")}>{session.athlete}</div>
                                    <div className="text-slate-400 truncate mt-0.5 text-[10px]">{session.coach}</div>
                                  </div></TimelineDraggableCard>
                                );
                              })}
                            </div>
                          ) : (
                            /* Expanded: stacked vertically in a floating popover */
                            <div className="absolute left-0 top-0 w-full z-40 rounded-xl border border-white/10 bg-[#0B0F14] p-2 shadow-2xl space-y-1.5" style={{ minWidth: "100%" }}>
                              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 px-1 mb-1">{sessions.length} {sessions.length === 1 ? "treino" : "treinos"} · {slot}</div>
                              {sessions.map((session) => {
                                const coachColor = getColor(session.coach);
                                const done = isCompleted(session.id) || session.status === "Concluído";
                                const cancelled = session.status === "Cancelado";
                                const color = cancelled ? "#6B7280" : done ? "#FACC15" : coachColor;
                                return (
                                  <div
                                    key={session.id}
                                    className={cn("relative rounded-lg border transition-all cursor-pointer overflow-hidden p-2.5 hover:brightness-110", cancelled && "opacity-50")}
                                    style={{ borderColor: `${color}40`, backgroundColor: `${color}15` }}
                                    onClick={() => setSelectedSession(session)}
                                  >
                                    <div className="w-full h-[3px] rounded-full absolute top-0 left-0" style={{ backgroundColor: color }} />
                                    <div className="font-bold mt-1 text-[10px]" style={{ color }}>{cancelled ? "✕ " : done ? "✓ " : ""}{session.time} – {session.type}</div>
                                    <div className={cn("font-medium mt-0.5 text-xs", cancelled ? "text-slate-500" : "text-white")}>{session.athlete}</div>
                                    <div className="text-slate-400 mt-0.5 text-[10px]">{session.coach}</div>
                                  </div>
                                );
                              })}
                              {canCreate && <button
                                className="w-full rounded-lg border border-dashed border-primary/20 p-2 text-center text-[10px] font-mono text-primary/60 hover:bg-primary/10 hover:text-primary transition-colors"
                                onClick={() => {
                                  const colDate = currentWeekColumns.find((c) => c.key === col.key)?.date || "23";
                                  setNewScheduleSlot({ date: (() => { const c = currentWeekColumns.find(cc => cc.key === col.key); return c?.fullDate ? `${String(c.fullDate.getDate()).padStart(2,"0")}/${String(c.fullDate.getMonth()+1).padStart(2,"0")}/${c.fullDate.getFullYear()}` : ""; })(), time: slot });
                                  setShowNewSchedule(true);
                                  setHoveredSlot(null);
                                }}
                              >
                                + Adicionar treino
                              </button>}
                            </div>
                          )}
                        </>
                    ) : (
                      <div
                        className="h-full rounded-lg border border-dashed border-white/5 bg-white/[0.01] cursor-pointer hover:bg-white/[0.04] hover:border-primary/20 transition-colors group"
                        onClick={() => {
                          const colDate = currentWeekColumns.find((c) => c.key === col.key)?.date || "23";
                          setNewScheduleSlot({ date: (() => { const c = currentWeekColumns.find(cc => cc.key === col.key); return c?.fullDate ? `${String(c.fullDate.getDate()).padStart(2,"0")}/${String(c.fullDate.getMonth()+1).padStart(2,"0")}/${c.fullDate.getFullYear()}` : ""; })(), time: slot });
                          setShowNewSchedule(true);
                        }}
                      >
                        <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4 text-primary/50" />
                        </div>
                      </div>
                    )}
                  </TimelineCell>
                );
              })}
            </div>
          ))}
          </div>
        </div>
      </CardContent>
    </SurfaceCard>
    </DndContext>
  );

  const renderWeekView = () => (
    <div className="grid gap-4 xl:grid-cols-6">
      {currentWeekColumns.map((col) => (
        <SurfaceCard key={col.key}>
          <CardHeader><CardTitle className="flex items-center justify-between text-base"><span>{col.label}</span><span className="text-sm text-slate-500">{col.date}</span></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(sessionsByDay[col.key] || []).length ? (sessionsByDay[col.key] || []).map((item) => {
              const color = getColor(item.coach);
              return (
                <div key={item.id} onClick={() => setSelectedSession(item)} className="rounded-lg border p-3 relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-all" style={{ borderColor: isCompleted(item.id) ? "#84CC1640" : `${color}30`, backgroundColor: isCompleted(item.id) ? "#84CC1610" : `${color}10` }}>
                  <div className="w-full h-[2px] rounded-full absolute top-0 left-0" style={{ backgroundColor: isCompleted(item.id) ? "#84CC16" : color }} />
                  <div className={cn("text-[10px] font-mono text-slate-500", isCompleted(item.id) && "opacity-60")}>{isCompleted(item.id) ? "✓ " : ""}{item.time} – {item.type}</div>
                  <div className={cn("mt-1 text-sm font-medium text-white", isCompleted(item.id) && "opacity-60")}>{item.athlete}</div>
                  <div className="text-xs text-slate-500">{item.coach}</div>
                </div>
              );
            }) : <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-600">Sem sessões</div>}
          </CardContent>
        </SurfaceCard>
      ))}
    </div>
  );

  const renderTableView = () => (
    <SurfaceCard>
      <CardHeader><CardTitle>Agenda em tabela</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              {["Dia", "Horário", "Atleta", "Treino", "Personal", "Status", "Local", "Intensidade"].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sortByCoach(filteredSessions).map((s) => {
              const color = getColor(s.coach);
              return (
                <tr key={s.id} onClick={() => setSelectedSession(s)} className={cn("border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer", isCompleted(s.id) && "opacity-60")}>
                  <td className="px-4 py-4">{s.day}</td>
                  <td className="px-4 py-4 font-mono">{s.time}</td>
                  <td className="px-4 py-4 font-medium text-white">{s.athlete}</td>
                  <td className="px-4 py-4">{s.type}</td>
                  <td className="px-4 py-4"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />{s.coach}</span></td>
                  <td className="px-4 py-4">{isCompleted(s.id) ? <span className="text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider">✓ Concluído</span> : s.status}</td>
                  <td className="px-4 py-4">{s.location}</td>
                  <td className="px-4 py-4">{s.intensity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </SurfaceCard>
  );

  const renderListView = () => (
    <div className="space-y-4">
      {currentWeekColumns.map((col) => (
        <SurfaceCard key={col.key}>
          <CardHeader><CardTitle className="text-base">{col.label}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(sessionsByDay[col.key] || []).length ? (sessionsByDay[col.key] || []).map((s) => {
              const color = getColor(s.coach);
              return (
                <div key={s.id} onClick={() => setSelectedSession(s)} className="flex items-center justify-between rounded-lg border p-4 relative overflow-hidden cursor-pointer hover:scale-[1.01] transition-all" style={{ borderColor: isCompleted(s.id) ? "#84CC1640" : `${color}30`, backgroundColor: isCompleted(s.id) ? "#84CC1608" : `${color}08` }}>
                  <div className="w-[3px] h-full absolute left-0 top-0 rounded-l" style={{ backgroundColor: isCompleted(s.id) ? "#84CC16" : color }} />
                  <div className="pl-2">
                    <div className={cn("font-medium text-white", isCompleted(s.id) && "opacity-60")}>{isCompleted(s.id) ? "✓ " : ""}{s.time} · {s.athlete}</div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">{s.type} · <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />{s.coach}</span></div>
                  </div>
                  <div className="text-xs">{isCompleted(s.id) ? <span className="text-emerald-400 font-mono font-bold uppercase tracking-wider">Concluído</span> : <span className="text-slate-500">{s.status}</span>}</div>
                </div>
              );
            }) : <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-600">Sem sessões</div>}
          </CardContent>
        </SurfaceCard>
      ))}
    </div>
  );

  // Daily view - single day with time slots + drag and drop
  function handleDailyDragEnd(event: any) {
    const { active, over } = event;
    if (!active || !over || !isAdmin) return;
    const sessionId = active.id as number;
    const targetTime = over.id as string;
    if (!targetTime) return;
    const sess = weekSessions.find(s => s.id === sessionId);
    if (!sess || sess.time === targetTime) return;
    const [h, m] = targetTime.split(":").map(Number);
    const total = h * 60 + m + 50;
    const newEndTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    // Update locally
    setExtraSessions(prev => [...prev.filter(s => s.id !== sessionId), { ...sess, time: targetTime, endTime: newEndTime }]);
    // Persist
    const y = dailyDate.getFullYear();
    const mo = String(dailyDate.getMonth() + 1).padStart(2, "0");
    const d = String(dailyDate.getDate()).padStart(2, "0");
    apiPut(`/api/sessions/${sessionId}`, { date: `${y}-${mo}-${d}T12:00:00.000Z`, startTime: targetTime, endTime: newEndTime }).catch(() => {});
  }

  const renderDailyView = () => {
    const dayKey = getDayKey(dailyDate);
    const daySessions = sortByCoach(filteredSessions.filter(s => s.day === dayKey));
    const dailyDateStr = `${String(dailyDate.getDate()).padStart(2,"0")}/${String(dailyDate.getMonth()+1).padStart(2,"0")}/${dailyDate.getFullYear()}`;

    return (
      <DndContext sensors={timelineSensors} onDragEnd={handleDailyDragEnd}>
      <div>
        <SurfaceCard>
          <CardContent className="p-0">
            {timeSlots.map((slot) => {
              const slotIdx = timeSlots.indexOf(slot);
              const nextSlot = timeSlots[slotIdx + 1] || "23:59";
              const sessions = daySessions.filter(s => {
                if (s.time === slot) return true;
                if (!timeSlots.includes(s.time) && s.time >= slot && s.time < nextSlot) return true;
                return false;
              });
              return (
                <TimelineCell key={slot} droppableId={slot} className="flex border-b border-white/5 min-h-[60px] group">
                  <div className="w-[70px] px-3 py-3 text-[10px] font-mono text-slate-500 flex-shrink-0 border-r border-white/5">{slot}</div>
                  <div className="flex-1 p-1.5 flex gap-1.5 flex-wrap">
                    {sessions.map(s => {
                      const coachColor = getColor(s.coach);
                      const done = isCompleted(s.id) || s.status === "Concluído";
                      const cancelled = s.status === "Cancelado";
                      const color = cancelled ? "#6B7280" : done ? "#FACC15" : coachColor;
                      return (
                        <TimelineDraggableCard key={s.id} id={s.id} enabled={isAdmin}>
                        <div onClick={() => setSelectedSession(s)} className={cn("rounded-lg border px-3 py-2 cursor-pointer hover:brightness-110 transition-all flex-1 min-w-[200px]", cancelled && "opacity-50")} style={{ borderColor: `${color}40`, backgroundColor: `${color}12` }}>
                          <div className="text-[10px] font-mono" style={{ color }}>{cancelled ? "✕ " : done ? "✓ " : ""}{s.time} - {s.type}</div>
                          <div className="text-sm font-medium text-white mt-0.5">{s.athlete}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: coachColor }} />{s.coach}</div>
                        </div>
                        </TimelineDraggableCard>
                      );
                    })}
                    {sessions.length === 0 && canCreate && (
                      <button onClick={() => { setNewScheduleSlot({ date: dailyDateStr, time: slot }); setShowNewSchedule(true); }} className="flex-1 rounded-lg border border-dashed border-primary/20 p-2 text-center text-[10px] font-mono text-primary/40 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                        <Plus className="w-3.5 h-3.5 inline" /> Adicionar treino
                      </button>
                    )}
                    {sessions.length > 0 && canCreate && (
                      <button onClick={() => { setNewScheduleSlot({ date: dailyDateStr, time: slot }); setShowNewSchedule(true); }} className="w-8 rounded-lg border border-dashed border-primary/20 flex items-center justify-center text-primary/40 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </TimelineCell>
              );
            })}
          </CardContent>
        </SurfaceCard>
      </div>
      </DndContext>
    );
  };

  // Monthly view - calendar grid
  const { data: monthSessions } = useApi<Session[]>(`/api/sessions?weekStart=${(() => {
    const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    return monday.toISOString().split("T")[0];
  })()}`);

  const renderMonthlyView = () => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const monthName = firstDay.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    // Build calendar grid starting from Sunday
    const startDow = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const cells: Array<{ date: number | null; fullDate: Date | null }> = [];
    for (let i = 0; i < startDow; i++) cells.push({ date: null, fullDate: null });
    for (let d = 1; d <= totalDays; d++) cells.push({ date: d, fullDate: new Date(year, month, d) });
    while (cells.length % 7 !== 0) cells.push({ date: null, fullDate: null });

    // Build sessions map by date
    const allMonthSessions = (monthSessions || []).map((s: Session) => ({
      ...s,
      dateKey: new Date(s.date).toISOString().split("T")[0],
    }));

    // Also need to fetch multiple weeks for the full month
    const sessionsByDate: Record<string, any[]> = {};
    allMonthSessions.forEach((s: any) => {
      if (!sessionsByDate[s.dateKey]) sessionsByDate[s.dateKey] = [];
      sessionsByDate[s.dateKey].push(s);
    });

    // Also use filteredSessions for current week data
    filteredSessions.forEach(s => {
      const col = currentWeekColumns.find(c => c.key === s.day);
      if (col?.fullDate) {
        const key = col.fullDate.toISOString().split("T")[0];
        if (!sessionsByDate[key]) sessionsByDate[key] = [];
        // Avoid duplicates
        if (!sessionsByDate[key].some((e: any) => e.id === s.id)) {
          sessionsByDate[key].push({ ...s, athlete: { name: s.athlete }, trainingType: { name: s.type }, coach: { name: s.coach } });
        }
      }
    });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    return (
      <div>
        <SurfaceCard>
          <CardContent className="p-0">
            {/* Header */}
            <div className="grid grid-cols-7 border-b border-white/10">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                <div key={d} className="px-2 py-2 text-center text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">{d}</div>
              ))}
            </div>
            {/* Weeks */}
            {Array.from({ length: cells.length / 7 }, (_, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 border-b border-white/5">
                {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((cell, cellIdx) => {
                  if (!cell.date || !cell.fullDate) return <div key={cellIdx} className="min-h-[100px] bg-white/[0.01] border-r border-white/5" />;
                  const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(cell.date).padStart(2, "0")}`;
                  const isToday = dateKey === todayStr;
                  const daySessions = sessionsByDate[dateKey] || [];

                  return (
                    <div key={cellIdx} className={cn("min-h-[100px] border-r border-white/5 p-1", isToday && "bg-primary/5")}>
                      <div className={cn("text-right text-xs font-bold pr-1 mb-1", isToday ? "text-primary" : "text-slate-500")}>{cell.date}</div>
                      <div className="space-y-0.5">
                        {daySessions.slice(0, 3).map((s: any, i: number) => {
                          const typeName = s.trainingType?.name || s.type || "Treino";
                          const coachName = s.coach?.name || s.coach || "";
                          const coachColor = getColor(coachName);
                          const done = s.completedAt || s.status === "Concluído";
                          const cancelled = s.status === "Cancelado";
                          const color = cancelled ? "#6B7280" : done ? "#FACC15" : coachColor;
                          return (
                            <div key={s.id || i} className={cn("rounded px-1.5 py-0.5 text-[9px] truncate cursor-pointer hover:brightness-110", cancelled && "opacity-50")} style={{ backgroundColor: `${color}25`, color }} onClick={() => {
                              if (s.athlete?.name) {
                                const sess: AgendaSession = { id: s.id, day: getDayKey(cell.fullDate!), time: s.startTime || s.time, endTime: s.endTime, athlete: s.athlete?.name || s.athlete, athleteId: s.athleteId || s.athlete?.id, type: typeName, coach: coachName, status: (s.status || "Confirmado") as SessionStatus, location: s.location || "Academia", intensity: "Média" as Intensity, pse: s.psePlanned || s.pse || 4 };
                                setSelectedSession(sess);
                              }
                            }}>
                              {s.startTime || s.time} - {typeName}
                            </div>
                          );
                        })}
                        {daySessions.length > 3 && <button onClick={() => { setDailyDate(cell.fullDate!); setView("diaria"); }} className="text-[9px] text-primary hover:text-primary-hover px-1 cursor-pointer font-bold">Ver mais ({daySessions.length})</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </CardContent>
        </SurfaceCard>
      </div>
    );
  };

  const renderKanbanView = () => {
    const statusColumns: SessionStatus[] = ["Confirmado", "Em andamento", "Concluído", "Pendente"];
    const statusColors: Record<string, string> = { Confirmado: "#3B82F6", "Em andamento": "#F59E0B", Concluído: "#84CC16", Pendente: "#6B7280" };

    function handleDragEnd(event: any) {
      const { active, over } = event;
      if (!over || !active) return;
      const sessionId = active.id as number;
      const newStatus = over.id as string;
      if (!statusColumns.includes(newStatus as SessionStatus)) return;
      const sess = weekSessions.find(s => s.id === sessionId);
      if (sess && sess.status !== newStatus) {
        // Update locally FIRST (instant feedback)
        setStatusOverrides(prev => ({ ...prev, [sessionId]: newStatus as SessionStatus }));
        setCompletedIds(prev => {
          const next = new Set(prev);
          if (newStatus === "Concluído") next.add(sessionId); else next.delete(sessionId);
          return next;
        });
        // Persist to DB in background (no refetch needed — local state is already correct)
        if (newStatus === "Concluído") {
          apiPost(`/api/sessions/${sessionId}/complete`, { pseActual: sess.pse || 4, duration: 50 }).catch(() => {});
        } else {
          apiPut(`/api/sessions/${sessionId}`, { status: newStatus }).catch(() => {});
        }
      }
    }

    return (
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid gap-4 xl:grid-cols-4">
          {statusColumns.map((status) => {
            const items = sessionsByStatus[status] || [];
            const colColor = statusColors[status] || "#6B7280";
            return (
              <DroppableColumn key={status} id={status} title={status} count={items.length} color={colColor}>
                {items.length ? items.map((s) => (
                  <DraggableCard key={s.id} id={s.id} session={s} getColor={getColor} isCompleted={isCompleted(s.id)} onClick={() => setSelectedSession(s)} />
                )) : <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-600">Sem cards</div>}
              </DroppableColumn>
            );
          })}
        </div>
      </DndContext>
    );
  };

  const renderCoachView = () => (
    <div className="grid gap-4 xl:grid-cols-3">
      {Object.entries(sessionsByCoach).map(([coach, items]) => (
        <SurfaceCard key={coach}>
          <CardHeader><CardTitle className="flex items-center justify-between text-base"><span>{coach}</span><span className="text-xs text-slate-500">{items.length} sessões</span></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.map((s) => {
              const color = getColor(s.coach);
              return (
                <div key={s.id} onClick={() => setSelectedSession(s)} className="rounded-lg border p-4 relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-all" style={{ borderColor: isCompleted(s.id) ? "#84CC1640" : `${color}30`, backgroundColor: isCompleted(s.id) ? "#84CC1610" : `${color}10` }}>
                  <div className="w-full h-[2px] rounded-full absolute top-0 left-0" style={{ backgroundColor: isCompleted(s.id) ? "#84CC16" : color }} />
                  <div className="text-[10px] font-mono text-slate-500">{s.day} · {s.time}</div>
                  <div className={cn("mt-1 text-sm font-medium text-white", isCompleted(s.id) && "opacity-60")}>{isCompleted(s.id) ? "✓ " : ""}{s.athlete}</div>
                  <div className="text-xs text-slate-500">{s.type}</div>
                </div>
              );
            })}
          </CardContent>
        </SurfaceCard>
      ))}
    </div>
  );

  return (
    <div>
      <SectionHeader title="Agenda" description="Visualizações alternativas para cada personal escolher o formato ideal." />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Clock3} label="Janela operacional" value="05:30–22:00" helper="Blocos de 50 minutos" tone="default" />
        <StatCard icon={Activity} label="Sessões filtradas" value={String(filteredSessions.length)} helper="Após filtros ativos" tone="info" />
        <StatCard icon={Users} label="Atletas da semana" value={String(new Set(filteredSessions.map((i) => i.athlete)).size)} helper="Distribuídos na agenda" tone="brand" />
        <StatCard icon={AlertTriangle} label="Pendências" value={String(filteredSessions.filter((i) => i.status === "Pendente").length)} helper="Sessões pendentes" tone="warning" />
        <StatCard icon={CheckCircle2} label="Concluídos" value={String(filteredSessions.filter((i) => i.status === "Concluído").length)} helper="Sessões concluídas" tone="success" />
      </div>
      <SurfaceCard className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            {view !== "diaria" && view !== "mensal" && <>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)} className="border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:text-white transition-colors"><ArrowLeft className="h-4 w-4" /></Button>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium font-mono">{formatWeekRange(baseMonday)}</div>
              <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)} className="border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:text-white transition-colors"><ArrowRight className="h-4 w-4" /></Button>
              {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} className="text-[10px] font-mono uppercase tracking-widest text-primary hover:text-primary-hover transition-colors ml-1">Hoje</button>}
            </>}
            {view === "diaria" && <>
              <Button variant="outline" size="icon" onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate() - 1); setDailyDate(d); }} className="border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:text-white transition-colors"><ArrowLeft className="h-4 w-4" /></Button>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium font-mono capitalize">{dailyDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
              <Button variant="outline" size="icon" onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate() + 1); setDailyDate(d); }} className="border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:text-white transition-colors"><ArrowRight className="h-4 w-4" /></Button>
              <button onClick={() => setDailyDate(new Date())} className="text-[10px] font-mono uppercase tracking-widest text-primary hover:text-primary-hover transition-colors ml-1">Hoje</button>
            </>}
            {view === "mensal" && <>
              <Button variant="outline" size="icon" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} className="border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:text-white transition-colors"><ArrowLeft className="h-4 w-4" /></Button>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium font-mono capitalize">{monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
              <Button variant="outline" size="icon" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} className="border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:text-white transition-colors"><ArrowRight className="h-4 w-4" /></Button>
              <button onClick={() => setMonthDate(new Date())} className="text-[10px] font-mono uppercase tracking-widest text-primary hover:text-primary-hover transition-colors ml-1">Hoje</button>
            </>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} className="w-[220px] border-white/10 bg-[#050505] text-slate-300 placeholder:text-slate-600 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 font-sans" placeholder="Filtrar atleta, treino ou personal" />
            <Select value={coachFilter} onValueChange={setCoachFilter}>
              <SelectTrigger className="w-[220px] border-white/10 bg-white/[0.03] text-white"><SelectValue placeholder="Filtrar colaborador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os personais</SelectItem>
                {coachOptions.map((coach) => <SelectItem key={coach} value={coach}>{coach}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={() => setShowNewSchedule(true)} className="flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] text-black uppercase hover:bg-primary-hover transition-all shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-glow">
              <Plus className="w-4 h-4" /> Novo agendamento
            </button>
          </div>
        </CardContent>
      </SurfaceCard>
      <div className="mb-6 flex flex-wrap gap-3">
        {agendaViewOptions.map((option) => <ViewPill key={option.value} active={view === option.value} icon={option.icon} label={option.label} onClick={() => setView(option.value)} />)}
      </div>
      {view === "timeline" && renderTimelineView()}
      {view === "diaria" && renderDailyView()}
      {view === "mensal" && renderMonthlyView()}
      {view === "semana" && renderWeekView()}
      {view === "tabela" && renderTableView()}
      {view === "lista" && renderListView()}
      {view === "kanban" && renderKanbanView()}
      {view === "personal" && renderCoachView()}
      {selectedSession && <SessionModal session={selectedSession} onClose={() => setSelectedSession(null)}
        weekColumns={currentWeekColumns}
        isCompleted={isCompleted(selectedSession.id)}
        onOpenAthlete={(name) => {
          // Find by athleteId from selected session first, then by exact name
          const sessAthleteId = selectedSession?.athleteId;
          const dbMatch = sessAthleteId ? cachedAthletes.find((a) => a.id === sessAthleteId) : cachedAthletes.find((a) => a.name === name);
          const athleteData = dbMatch || { id: sessAthleteId || 0, name, email: "", age: 25, position: null, isEnabled: true, coach: null, goal: null, phone: null, weight: null, height: null };
          if (athleteData.id) {
            const athlete: Athlete = {
              id: athleteData.id, name: athleteData.name, email: athleteData.email || "",
              age: athleteData.age || 25, position: athleteData.position || "—",
              status: "ativo" as Status, risk: "ok" as Risk,
              nextTraining: "—", coach: (athleteData as any).coach?.name || "—", objective: (athleteData as any).goal || "—",
              phone: athleteData.phone || "—", city: "—", state: "—", country: "Brasil",
              weight: athleteData.weight || "—", height: athleteData.height || "—",
              monitoring: generateDefaultMonitoring(athleteData.id),
              plannedTrainings: [], completedTrainings: [], pains: [], injuries: [],
            };
            setSelectedSession(null);
            openAthlete(athlete);
          }
        }}
        onOpenCollaborator={() => { setSelectedSession(null); goToCollaborators(); }}
        onComplete={async (id) => {
          const sess = selectedSession;
          setCompletedIds((prev) => new Set(prev).add(id));
          setSelectedSession(null);
          if (sess) {
            const col = currentWeekColumns.find((c) => c.key === sess.day);
            const dateStr = col ? formatDateBR(col.fullDate) : "";
            const newTraining: Athlete["completedTrainings"][0] = {
              day: dayFullNames[sess.day] || sess.day,
              date: dateStr,
              type: sess.type,
              duration: "50 min",
              pse: sess.pse,
              psr: 0,
              load: `${sess.pse * 50} U.A.`,
              summary: "",
              wellbeing: { sleepQuality: "", sleepHours: "", energy: "", stress: "", nutrition: "", water: "", pain: "", fatigue: "", mood: "", motivation: "" },
              pains: [],
              injuries: [],
            };
            // Build athlete from cached DB data
            const dbMatch = sess.athleteId ? cachedAthletes.find((a) => a.id === sess.athleteId) : cachedAthletes.find((a) => a.name === sess.athlete);
            const athlete: Athlete = {
              id: dbMatch?.id || sess.athleteId || (900 + id),
              name: dbMatch?.name || sess.athlete,
              email: dbMatch?.email || "—",
              age: dbMatch?.age || 25,
              position: dbMatch?.position || "—",
              status: "ativo" as Status,
              risk: "ok" as Risk,
              nextTraining: "—",
              coach: dbMatch?.coach?.name || sess.coach,
              objective: dbMatch?.goal || "—",
              phone: dbMatch?.phone || "—",
              city: "—", state: "—", country: "Brasil",
              weight: dbMatch?.weight || "—",
              height: dbMatch?.height || "—",
              monitoring: generateDefaultMonitoring(dbMatch?.id || sess.athleteId || id),
              plannedTrainings: [], completedTrainings: [], pains: [], injuries: [],
            };
            // Persist to DB first (don't refetch — that causes the page switch bug)
            apiPost(`/api/sessions/${id}/complete`, { pseActual: sess?.pse || 4, duration: 50 }).catch(() => {});
            // Navigate to athlete profile
            openAthlete(athlete, "completed", newTraining);
          }
        }}
        onEdit={async (id, data) => {
          setExtraSessions((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s));
          setSelectedSession(null);
          try {
            const updateData: any = {};
            if (data.time) updateData.startTime = data.time;
            if (data.endTime) updateData.endTime = data.endTime;
            if (data.location) updateData.location = data.location;
            if (data.pse !== undefined) updateData.psePlanned = data.pse;
            if ((data as any).summary !== undefined) updateData.summary = (data as any).summary;
            if (data.athlete) { const aid = findAthleteId(data.athlete); if (aid) updateData.athleteId = aid; }
            if (data.coach) { const cid = findCoachId(data.coach); if (cid) updateData.coachId = cid; }
            if (data.type) {
              let tid = findTypeId(data.type);
              if (!tid) {
                // Fallback: fetch types directly
                const tts = await fetch("/api/training-types").then(r => r.json()).catch(() => []);
                tid = tts.find((t: any) => t.name === data.type)?.id;
              }
              if (tid) updateData.trainingTypeId = tid;
            }
            await apiPut(`/api/sessions/${id}`, updateData);
            setTimeout(() => refetchWeekSessions(), 500);
          } catch {}
        }}
        onDelete={async (id) => {
          try {
            await apiDelete(`/api/sessions/${id}`);
            setSelectedSession(null);
            refetchWeekSessions();
          } catch {}
        }}
        onCancelSession={async (id) => {
          try {
            await apiPut(`/api/sessions/${id}`, { status: "Cancelado" });
            setSelectedSession(null);
            refetchWeekSessions();
          } catch {}
        }}
      />}
      {showNewSchedule && <NewScheduleModal onClose={() => { setShowNewSchedule(false); setNewScheduleSlot(null); }} onSave={async (session) => {
        setShowNewSchedule(false);
        setNewScheduleSlot(null);
        const newId = -Date.now();
        const localSession: AgendaSession = {
          ...session,
          id: newId,
          status: session.status || "Pendente",
          intensity: intensityFn(session.pse),
        };
        setExtraSessions(prev => [...prev, localSession]);
        try {
          const athleteId = findAthleteId(session.athlete);
          const coachId = findCoachId(session.coach);
          const typeId = findTypeId(session.type);
          if (athleteId && coachId && typeId) {
            let sessionDate: Date;
            const parsedDate = (session as any)._parsedDate;
            if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
              sessionDate = parsedDate;
            } else {
              const col = currentWeekColumns.find(c => c.key === session.day);
              sessionDate = col?.fullDate ? new Date(col.fullDate) : new Date();
            }
            sessionDate.setHours(12, 0, 0, 0);
            const y = sessionDate.getFullYear();
            const m = String(sessionDate.getMonth() + 1).padStart(2, "0");
            const d = String(sessionDate.getDate()).padStart(2, "0");
            await apiPost("/api/sessions", {
              date: `${y}-${m}-${d}T12:00:00.000Z`,
              startTime: session.time,
              endTime: session.endTime,
              athleteId, coachId, trainingTypeId: typeId,
              psePlanned: session.pse,
              duration: 50,
              location: session.location,
            });
            setExtraSessions(prev => prev.filter(s => s.id !== newId));
            refetchWeekSessions();
          }
        } catch {}
      }} onSaveBulk={async (sessions) => {
        setShowNewSchedule(false);
        setNewScheduleSlot(null);
        const localBase = Date.now();
        const localSessions: AgendaSession[] = sessions.map((s, i) => ({
          id: -(localBase + i),
          day: s.day,
          time: s.time,
          endTime: s.endTime,
          athlete: s.athlete,
          type: s.type,
          coach: s.coach,
          status: "Pendente",
          location: "Academia",
          intensity: intensityFn(s.pse),
          pse: s.pse,
        }));
        setExtraSessions(prev => [...prev, ...localSessions]);
        let created = 0;
        for (const s of sessions) {
          const athleteId = findAthleteId(s.athlete);
          const coachId = findCoachId(s.coach);
          const typeId = findTypeId(s.type);
          if (athleteId && coachId && typeId) {
            try {
              const y = s.date.getFullYear();
              const m = String(s.date.getMonth() + 1).padStart(2, "0");
              const d = String(s.date.getDate()).padStart(2, "0");
              await apiPost("/api/sessions", {
                date: `${y}-${m}-${d}T12:00:00.000Z`,
                startTime: s.time, endTime: s.endTime,
                athleteId, coachId, trainingTypeId: typeId,
                psePlanned: s.pse, duration: 50, location: "Academia",
              });
              created++;
            } catch {}
          }
        }
        if (created > 0) refetchWeekSessions();
      }} initialDate={newScheduleSlot?.date} initialTime={newScheduleSlot?.time} />}
    </div>
  );
}

function NewAthleteModal({ onClose, onSave }: { onClose: () => void; onSave: (a: Athlete) => void }) {
  const { isDark } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [objective, setObjective] = useState("");
  const inputCls = cn("w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white placeholder:text-slate-600 focus:border-primary/50" : "border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-gray-400");
  const labelCls = cn("text-[11px] font-bold uppercase tracking-wider mb-2", isDark ? "text-white" : "text-gray-900");

  function handleSave() {
    if (!name.trim()) return;
    const newAthlete: Athlete = {
      id: Date.now(), name: name.trim(), email: email.trim() || `${name.trim().toLowerCase().replace(/\s/g, '.')}@email.com`,
      age: +age || 25, position: position || "Atleta", status: "ativo", risk: "ok",
      nextTraining: "—", coach: "—", objective: objective || "—", phone: phone || "—",
      city: "—", state: "—", country: "Brasil",
      weight: weight ? `${weight} kg` : "—", height: height ? `${height} m` : "—",
      monitoring: generateDefaultMonitoring(999),
      plannedTrainings: [], completedTrainings: [], pains: [], injuries: [],
    };
    onSave(newAthlete);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className={cn("relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col", isDark ? "border-white/10 bg-[#0B0F14]" : "border-gray-200 bg-white")} onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/60" />
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between mb-5">
            <h2 className={cn("text-xl font-display font-bold", isDark ? "text-white" : "text-gray-900")}>Novo atleta</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] transition-colors text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-6 space-y-4">
          <div><div className={labelCls}>Nome *</div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo do atleta" className={inputCls} /></div>
          <div><div className={labelCls}>E-mail</div><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><div className={labelCls}>Telefone</div><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999" className={inputCls} /></div>
            <div><div className={labelCls}>Idade</div><input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" className={inputCls} /></div>
          </div>
          <div><div className={labelCls}>Posição</div>
            <SearchableDropdown label="" placeholder="Selecione a posição" options={["Goleiro","Lateral Direito","Lateral Esquerdo","Zagueiro","Volante","Meio-Campista","Meia Ofensivo","Ponta Direita","Ponta Esquerda","Centroavante","Atacante","Segundo Atacante"]} value={position} onChange={setPosition} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><div className={labelCls}>Peso (kg)</div><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80" className={inputCls} /></div>
            <div><div className={labelCls}>Altura (m)</div><input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="1.80" className={inputCls} /></div>
          </div>
          <div><div className={labelCls}>Objetivo</div><textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objetivo do atleta..." rows={2} className={cn(inputCls, "resize-none")} /></div>
          <div className="pt-2 space-y-3">
            <button onClick={handleSave} className="w-full py-3 rounded-xl bg-primary text-black text-sm font-bold uppercase tracking-[0.2em] hover:bg-primary-hover transition-all shadow-glow">Cadastrar atleta</button>
            <button onClick={onClose} className="w-full py-3 rounded-xl border border-white/20 text-white text-sm font-bold uppercase tracking-[0.2em] hover:bg-white/5 transition-colors">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AthletesPage({ openAthlete }: { openAthlete: (a: Athlete) => void }) {
  const { isDark } = useTheme();
  const { canCreate, canDelete, canEdit, isAdmin } = usePermissions();
  const { athletes: dbAthletesList, refetchAthletes } = useData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "inativo">("ativo");
  const [athletes, setAthletes] = useState(athletesMock);
  const [showNewAthlete, setShowNewAthlete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Athlete | null>(null);

  // Sync from DB
  useEffect(() => {
    if (dbAthletesList.length > 0) {
      setAthletes(dbAthletesList.map((a, idx) => ({
        id: a.id, name: a.name, email: a.email, age: a.age || 25,
        position: a.position || "—",
        status: (a.isEnabled ? "ativo" : "inativo") as Status,
        risk: (["ok", "atenção", "alto"][idx % 3]) as Risk,
        nextTraining: "—", coach: a.coach?.name || "—",
        objective: a.goal || "—", phone: a.phone || "—",
        city: a.city || "—", state: a.state || "—", country: a.country || "Brasil",
        weight: a.weight || "—", height: a.height || "—",
        monitoring: generateDefaultMonitoring(a.id),
        plannedTrainings: [], completedTrainings: [], pains: [], injuries: [],
      })));
    }
  }, [dbAthletesList]);

  const filtered = useMemo(() => athletes.filter((a) => {
    const matchQ = !query || a.name.toLowerCase().includes(query.toLowerCase()) || a.email.toLowerCase().includes(query.toLowerCase());
    const matchS = statusFilter === "todos" || a.status === statusFilter;
    return matchQ && matchS;
  }), [query, statusFilter, athletes]);
  const totalActive = useMemo(() => athletes.filter((a) => a.status === "ativo").length, [athletes]);
  const totalInactive = useMemo(() => athletes.filter((a) => a.status === "inativo").length, [athletes]);

  async function addAthlete(a: Athlete) {
    try {
      await apiPost("/api/athletes", {
        name: a.name, email: a.email, phone: a.phone !== "—" ? a.phone : null,
        age: a.age, position: a.position, goal: a.objective !== "—" ? a.objective : null,
        weight: a.weight !== "—" ? a.weight : null, height: a.height !== "—" ? a.height : null,
      });
      refetchAthletes();
    } catch {}
    setShowNewAthlete(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/athletes/${deleteTarget.id}`);
      setAthletes((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      refetchAthletes();
    } catch {}
    setDeleteTarget(null);
  }

  return (
    <div>
      <SectionHeader title="Atletas" description={`${athletes.length} atletas cadastrados · ${totalActive} ativos · ${totalInactive} inativos`} />
      <SurfaceCard className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" className={cn("w-full rounded-lg border pl-10 pr-4 py-2.5 text-sm outline-none transition-colors", isDark ? "border-white/10 bg-[#050505] text-white placeholder:text-slate-600 focus:border-primary/50" : "border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-gray-400")} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setStatusFilter("todos")} className={cn("px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] transition-all rounded-lg", statusFilter === "todos" ? "bg-primary text-black shadow-glow" : isDark ? "border border-white/10 text-slate-400 hover:bg-white/5" : "border border-gray-200 text-gray-500 hover:bg-gray-100")}>Todos ({athletes.length})</button>
              <button onClick={() => setStatusFilter("ativo")} className={cn("px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] transition-all rounded-lg", statusFilter === "ativo" ? "bg-emerald-500 text-black" : isDark ? "border border-white/10 text-slate-400 hover:bg-white/5" : "border border-gray-200 text-gray-500 hover:bg-gray-100")}>Ativos ({totalActive})</button>
              <button onClick={() => setStatusFilter("inativo")} className={cn("px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] transition-all rounded-lg", statusFilter === "inativo" ? "bg-red-500 text-white" : isDark ? "border border-white/10 text-slate-400 hover:bg-white/5" : "border border-gray-200 text-gray-500 hover:bg-gray-100")}>Inativos ({totalInactive})</button>
              {canCreate && <button onClick={() => setShowNewAthlete(true)} className="flex items-center gap-2 bg-primary px-5 py-2 text-[11px] font-bold tracking-[0.2em] text-black uppercase hover:bg-primary-hover transition-all shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-glow rounded-lg">
                <Plus className="w-4 h-4" /> Novo atleta
              </button>}
            </div>
          </div>
        </CardContent>
      </SurfaceCard>
      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map((athlete) => (
          <SurfaceCard key={athlete.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 border border-white/10"><AvatarFallback className="bg-white/10 text-white">{initials(athlete.name)}</AvatarFallback></Avatar>
                  <div>
                    <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{athlete.name}</h3><StatusBadge value={athlete.status} /></div>
                    <div className="mt-1 text-sm text-slate-500">{athlete.position} · {athlete.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <MetricMini label="ACWR" value={String(athlete.monitoring.acwr)} />
                  <MetricMini label="Bem-estar" value={`${athlete.monitoring.wellbeing}%`} />
                  <MetricMini label="Sono" value={`${athlete.monitoring.sleep}%`} />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <Button className="bg-primary text-black text-[11px] font-bold tracking-[0.15em] uppercase hover:bg-primary-hover shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-glow transition-all" onClick={() => openAthlete(athlete)}>Ver atleta</Button>
                {isAdmin && <button onClick={async () => {
                  const newStatus = athlete.status === "ativo" ? false : true;
                  try {
                    await apiPut(`/api/athletes/${athlete.id}`, { isEnabled: newStatus });
                    setAthletes((prev) => prev.map((a) => a.id === athlete.id ? { ...a, status: (newStatus ? "ativo" : "inativo") as Status } : a));
                    refetchAthletes();
                  } catch {}
                }} className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-colors", athlete.status === "ativo" ? "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20")} title={athlete.status === "ativo" ? "Inativar atleta" : "Ativar atleta"}>
                  {athlete.status === "ativo" ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </button>}
                {isAdmin && <button onClick={() => setDeleteTarget(athlete)} className="w-9 h-9 rounded-lg border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors" title="Excluir atleta">
                  <Trash2 className="w-4 h-4" />
                </button>}
              </div>
            </CardContent>
          </SurfaceCard>
        ))}
      </div>

      {/* New Athlete Modal */}
      {showNewAthlete && <NewAthleteModal onClose={() => setShowNewAthlete(false)} onSave={addAthlete} />}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setDeleteTarget(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className={cn("relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl", isDark ? "border-red-500/20 bg-[#0B0F14]" : "border-red-200 bg-white")} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
              <h3 className={cn("text-lg font-display font-bold", isDark ? "text-white" : "text-gray-900")}>Excluir atleta</h3>
            </div>
            <p className={cn("text-sm mb-2", isDark ? "text-slate-400" : "text-gray-500")}>Tem certeza que deseja excluir o atleta:</p>
            <p className={cn("text-sm font-bold mb-4", isDark ? "text-white" : "text-gray-900")}>{deleteTarget.name}</p>
            <p className={cn("text-xs mb-6", isDark ? "text-slate-500" : "text-gray-400")}>Esta ação não pode ser desfeita. Todos os dados do atleta serão removidos.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className={cn("flex-1 py-2.5 rounded-xl border text-[11px] font-bold tracking-[0.2em] uppercase transition-colors", isDark ? "border-white/20 text-white hover:bg-white/5" : "border-gray-200 text-gray-700 hover:bg-gray-100")}>Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-red-400 transition-all flex items-center justify-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Mini Bar Chart (CSS only) ─── */
function MiniBarChart({ data, maxVal, color = "primary", labels }: { data: number[]; maxVal?: number; color?: string; labels?: string[] }) {
  const max = maxVal || Math.max(...data, 1);
  const barColor = color === "primary" ? "bg-primary" : color === "emerald" ? "bg-emerald-400" : color === "amber" ? "bg-amber-400" : color === "red" ? "bg-red-400" : "bg-primary";
  const glowColor = color === "primary" ? "shadow-[0_0_8px_rgba(250,204,21,0.5)]" : "";
  return (
    <div className="flex items-end gap-1.5 h-[120px]">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full relative flex items-end" style={{ height: "100px" }}>
            <div className={cn("w-full rounded-t transition-all", barColor, i === data.length - 1 && glowColor)} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
          </div>
          {labels && <span className="text-[9px] font-mono text-slate-500">{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}

/* ─── Mini Line Sparkline (CSS/SVG) ─── */
function Sparkline({ data, color = "#F2C300", height = 60, filled = false }: { data: number[]; color?: string; height?: number; filled?: boolean }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 200;
  const points = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: height - ((v - min) / range) * (height - 8) - 4 }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fillD = `${pathD} L ${w} ${height} L 0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {filled && <path d={fillD} fill={`${color}15`} />}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} />
    </svg>
  );
}

/* ─── ACWR Gauge ─── */
/* ─── Radar Chart (SVG) ─── */
function RadarChart({ axes, datasets, size = 240 }: {
  axes: Array<{ label: string; max: number }>;
  datasets: Array<{ values: number[]; color: string; label: string }>;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 36;
  const n = axes.length;
  const angleStep = (Math.PI * 2) / n;
  const startAngle = -Math.PI / 2;

  function polarToXY(angle: number, radius: number) {
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  }

  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid rings */}
        {rings.map((pct) => (
          <polygon
            key={pct}
            points={Array.from({ length: n }, (_, i) => {
              const p = polarToXY(startAngle + i * angleStep, r * pct);
              return `${p.x},${p.y}`;
            }).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}
        {/* Axis lines */}
        {axes.map((_, i) => {
          const p = polarToXY(startAngle + i * angleStep, r);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
        })}
        {/* Data polygons */}
        {datasets.map((ds, di) => {
          const pts = ds.values.map((v, i) => {
            const max = axes[i]?.max || 1;
            const pct = Math.min(1, Math.max(0, (v || 0) / max));
            return polarToXY(startAngle + i * angleStep, r * (isNaN(pct) ? 0 : pct));
          });
          const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
          return (
            <g key={di}>
              <polygon points={pointsStr} fill={`${ds.color}20`} stroke={ds.color} strokeWidth="2" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={ds.color} />
              ))}
            </g>
          );
        })}
        {/* Labels */}
        {axes.map((axis, i) => {
          const p = polarToXY(startAngle + i * angleStep, r + 22);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-[11px] font-sans font-medium">
              {axis.label}
            </text>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-5 mt-3">
        {datasets.map((ds) => (
          <div key={ds.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: ds.color }} />
            <span className="text-[11px] text-slate-400">{ds.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AcwrGauge({ value }: { value: number }) {
  const zones = [
    { label: "Baixo", min: 0, max: 0.8, color: "#3B82F6" },
    { label: "Ideal", min: 0.8, max: 1.3, color: "#84CC16" },
    { label: "Atenção", min: 1.3, max: 1.5, color: "#F59E0B" },
    { label: "Risco", min: 1.5, max: 2.0, color: "#EF4444" },
  ];
  const currentZone = zones.find((z) => value >= z.min && value < z.max) || zones[zones.length - 1];
  const pct = Math.min(100, (value / 2.0) * 100);
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-4xl font-display font-bold" style={{ color: currentZone.color }}>{value.toFixed(2)}</span>
        <span className="text-sm font-mono uppercase tracking-wider px-2 py-0.5 rounded border" style={{ color: currentZone.color, borderColor: `${currentZone.color}30`, backgroundColor: `${currentZone.color}15` }}>{currentZone.label}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden flex">
        {zones.map((z) => (
          <div key={z.label} className="h-full" style={{ width: `${((z.max - z.min) / 2.0) * 100}%`, backgroundColor: `${z.color}30` }} />
        ))}
        <div className="absolute top-0 h-full w-1 rounded-full bg-white shadow-[0_0_8px_white]" style={{ left: `${pct}%`, transform: "translateX(-50%)" }} />
      </div>
      <div className="flex justify-between mt-2">
        {zones.map((z) => <span key={z.label} className="text-[9px] font-mono uppercase tracking-wider" style={{ color: z.color }}>{z.label}</span>)}
      </div>
    </div>
  );
}

/* ─── Monitoring Dashboard ─── */
function MonitoringDashboard({ athlete }: { athlete: Athlete }) {
  const { data: realMonitoring } = useApi<any>(`/api/monitoring/${athlete.id}`);
  const m = realMonitoring || athlete.monitoring;
  const weekLabels = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
  const adherence = realMonitoring ? (realMonitoring.adherence || 0) : (m.sessionsPlanned > 0 ? Math.round((m.sessionsCompleted / m.sessionsPlanned) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Row 1 — KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Carga Semanal</div>
          <div className="text-3xl font-display font-bold text-white">{m.weekLoad ?? m.completedLoad} <span className="text-base text-slate-500">U.A.</span></div>
          <Sparkline data={m.weeklyLoads || []} height={40} filled />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">PSE Médio</div>
          <div className="text-3xl font-display font-bold text-white">{m.avgPse ?? ((m.weeklyPse || []).length > 0 ? ((m.weeklyPse || []).reduce((a: number, b: number) => a + b, 0) / (m.weeklyPse || []).length).toFixed(1) : "0")}</div>
          <Sparkline data={m.weeklyPse || []} color="#8B5CF6" height={40} filled />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Minutos Totais</div>
          <div className="text-3xl font-display font-bold text-white">{m.totalMinutes} <span className="text-base text-slate-500">min</span></div>
          <div className="mt-3 text-xs text-slate-400">{m.completedCount ?? m.sessionsCompleted} sessões concluídas</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Adesão</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-display font-bold" style={{ color: adherence >= 80 ? "#84CC16" : adherence >= 60 ? "#F59E0B" : "#EF4444" }}>{adherence}%</span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all shadow-[0_0_10px_rgba(250,204,21,0.5)]" style={{ width: `${adherence}%`, backgroundColor: adherence >= 80 ? "#84CC16" : adherence >= 60 ? "#F59E0B" : "#EF4444" }} />
          </div>
          <div className="mt-2 text-xs text-slate-500">{m.completedCount ?? m.sessionsCompleted} / {m.totalSessions ?? m.sessionsPlanned} sessões</div>
        </div>
      </div>

      {/* Row 2 — ACWR + Load chart */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <SurfaceCard>
          <CardHeader>
            <CardTitle>Razão Aguda-Crônica (ACWR)</CardTitle>
            <CardDescription className="text-slate-500">Faixa ideal entre 0.8 e 1.3 — equilíbrio entre carga e recuperação.</CardDescription>
          </CardHeader>
          <CardContent>
            <AcwrGauge value={m.acwr} />
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Carga Aguda</div>
                <div className="mt-1 text-lg font-display font-bold text-white">{m.acuteLoad}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Carga Crônica</div>
                <div className="mt-1 text-lg font-display font-bold text-white">{m.chronicLoad}</div>
              </div>
            </div>
          </CardContent>
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader>
            <CardTitle>Evolução de Carga Semanal</CardTitle>
            <CardDescription className="text-slate-500">Distribuição das últimas 4 semanas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">Carga (U.A.)</div>
                <MiniBarChart data={m.weeklyLoads} labels={weekLabels} color="primary" />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-3">PSE Médio</div>
                <MiniBarChart data={m.weeklyPse} maxVal={10} labels={weekLabels} color="amber" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Monotonia</div>
                <div className="mt-1 text-lg font-display font-bold text-white">{m.monotony.toFixed(1)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Strain</div>
                <div className="mt-1 text-lg font-display font-bold text-white">{m.strain}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Risco</div>
                <div className="mt-1"><StatusBadge value={m.riskLevel} /></div>
              </div>
            </div>
          </CardContent>
        </SurfaceCard>
      </div>

      {/* Row 3 — Wellbeing: Radar + Cards */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        {/* Radar Chart */}
        <SurfaceCard>
          <CardHeader>
            <CardTitle>Perfil Físico</CardTitle>
            <CardDescription className="text-slate-500">Visualização multidimensional de bem-estar, sono, fadiga e desempenho do atleta.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <RadarChart
              size={280}
              axes={[
                { label: "Bem-estar", max: 100 },
                { label: "Sono", max: 100 },
                { label: "Recuperação", max: 100 },
                { label: "Adesão", max: 100 },
                { label: "Carga", max: 100 },
                { label: "Fadiga inv.", max: 100 },
              ]}
              datasets={[
                {
                  label: "Atual",
                  values: [m.wellbeing, m.sleep, Math.max(0, 100 - m.fatigue), m.sessionsPlanned > 0 ? Math.round((m.sessionsCompleted / m.sessionsPlanned) * 100) : 0, Math.min(100, (m.completedLoad / 5)), 100 - m.fatigue],
                  color: "#00E5FF",
                },
                {
                  label: "Ideal",
                  values: [80, 85, 80, 90, 75, 80],
                  color: "#8B5CF6",
                },
              ]}
            />
          </CardContent>
        </SurfaceCard>

        {/* Wellbeing detail cards */}
        <div className="grid gap-4 md:grid-cols-1">
          <SurfaceCard>
            <CardHeader><CardTitle>Bem-estar</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl font-display font-bold" style={{ color: m.wellbeing >= 70 ? "#84CC16" : m.wellbeing >= 50 ? "#F59E0B" : "#EF4444" }}>{m.wellbeing}%</span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border" style={{ color: m.wellbeing >= 70 ? "#84CC16" : m.wellbeing >= 50 ? "#F59E0B" : "#EF4444", borderColor: m.wellbeing >= 70 ? "#84CC1630" : m.wellbeing >= 50 ? "#F59E0B30" : "#EF444430", backgroundColor: m.wellbeing >= 70 ? "#84CC1615" : m.wellbeing >= 50 ? "#F59E0B15" : "#EF444415" }}>{m.wellbeing >= 70 ? "Bom" : m.wellbeing >= 50 ? "Atenção" : "Crítico"}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${m.wellbeing}%`, backgroundColor: m.wellbeing >= 70 ? "#84CC16" : m.wellbeing >= 50 ? "#F59E0B" : "#EF4444" }} />
              </div>
              <div className="mt-3 text-xs text-slate-500">Percepção subjetiva de bem-estar geral do atleta nesta semana.</div>
            </CardContent>
          </SurfaceCard>

          <SurfaceCard>
            <CardHeader><CardTitle>Qualidade do Sono</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl font-display font-bold" style={{ color: m.sleep >= 75 ? "#84CC16" : m.sleep >= 55 ? "#F59E0B" : "#EF4444" }}>{m.sleep}%</span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border" style={{ color: m.sleep >= 75 ? "#84CC16" : m.sleep >= 55 ? "#F59E0B" : "#EF4444", borderColor: m.sleep >= 75 ? "#84CC1630" : m.sleep >= 55 ? "#F59E0B30" : "#EF444430", backgroundColor: m.sleep >= 75 ? "#84CC1615" : m.sleep >= 55 ? "#F59E0B15" : "#EF444415" }}>{m.sleep >= 75 ? "Bom" : m.sleep >= 55 ? "Regular" : "Ruim"}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${m.sleep}%`, backgroundColor: m.sleep >= 75 ? "#84CC16" : m.sleep >= 55 ? "#F59E0B" : "#EF4444" }} />
              </div>
              <div className="mt-3 text-xs text-slate-500">Índice de qualidade e duração do sono reportada pelo atleta.</div>
            </CardContent>
          </SurfaceCard>

          <SurfaceCard>
            <CardHeader><CardTitle>Fadiga</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl font-display font-bold" style={{ color: m.fatigue <= 30 ? "#84CC16" : m.fatigue <= 55 ? "#F59E0B" : "#EF4444" }}>{m.fatigue}%</span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border" style={{ color: m.fatigue <= 30 ? "#84CC16" : m.fatigue <= 55 ? "#F59E0B" : "#EF4444", borderColor: m.fatigue <= 30 ? "#84CC1630" : m.fatigue <= 55 ? "#F59E0B30" : "#EF444430", backgroundColor: m.fatigue <= 30 ? "#84CC1615" : m.fatigue <= 55 ? "#F59E0B15" : "#EF444415" }}>{m.fatigue <= 30 ? "Baixa" : m.fatigue <= 55 ? "Moderada" : "Alta"}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${m.fatigue}%`, backgroundColor: m.fatigue <= 30 ? "#84CC16" : m.fatigue <= 55 ? "#F59E0B" : "#EF4444" }} />
              </div>
              <div className="mt-3 text-xs text-slate-500">Nível de fadiga percebida — valores altos indicam necessidade de recuperação.</div>
            </CardContent>
          </SurfaceCard>
        </div>
      </div>

      {/* Row 4 — Planned vs Completed */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <CardHeader>
            <CardTitle>Planejado vs Realizado</CardTitle>
            <CardDescription className="text-slate-500">Comparativo de carga semanal.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Carga Planejada</span>
                  <span className="text-sm font-display font-bold text-white">{m.plannedLoad} U.A.</span>
                </div>
                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/40 rounded-full" style={{ width: `${Math.min(100, (m.plannedLoad / Math.max(m.plannedLoad, m.completedLoad)) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Carga Realizada</span>
                  <span className="text-sm font-display font-bold text-white">{m.completedLoad} U.A.</span>
                </div>
                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)]" style={{ width: `${Math.min(100, (m.completedLoad / Math.max(m.plannedLoad, m.completedLoad)) * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Diferença: <span className={cn("font-bold", m.completedLoad >= m.plannedLoad ? "text-emerald-400" : "text-amber-400")}>{m.completedLoad >= m.plannedLoad ? "+" : ""}{m.completedLoad - m.plannedLoad} U.A.</span>
            </div>
          </CardContent>
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader>
            <CardTitle>Indicadores Compostos</CardTitle>
            <CardDescription className="text-slate-500">Métricas derivadas do controle de carga.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">ACWR</div>
                <div className="text-2xl font-display font-bold" style={{ color: m.acwr >= 0.8 && m.acwr <= 1.3 ? "#84CC16" : m.acwr > 1.3 ? "#EF4444" : "#3B82F6" }}>{m.acwr.toFixed(2)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">Monotonia</div>
                <div className="text-2xl font-display font-bold" style={{ color: m.monotony <= 1.5 ? "#84CC16" : m.monotony <= 2.0 ? "#F59E0B" : "#EF4444" }}>{m.monotony.toFixed(1)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">Strain</div>
                <div className="text-2xl font-display font-bold text-white">{m.strain}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">Nível de Risco</div>
                <div className="mt-1"><StatusBadge value={m.riskLevel} /></div>
              </div>
            </div>
          </CardContent>
        </SurfaceCard>
      </div>
    </div>
  );
}

/* ─── Wellbeing → Monitoring conversion ─── */
function wellbeingToScore(wellbeing: Athlete["completedTrainings"][0]["wellbeing"]): { wellbeing: number; sleep: number; fatigue: number } {
  // Map each field to a 0-100 scale
  const scaleMap: Record<string, Record<string, number>> = {
    sleepQuality: { "Péssima": 10, "Ruim": 30, "Normal": 50, "Boa": 75, "Excelente": 95 },
    sleepHours: { "Menos de 5h": 15, "5-6h": 45, "7-8h": 80, "Mais de 8h": 95 },
    energy: { "Muito baixo": 10, "Baixo": 30, "Moderado": 50, "Alto": 75, "Muito alto": 95 },
    stress: { "Muito baixo": 95, "Baixo": 75, "Moderado": 50, "Alto": 30, "Muito alto": 10 },
    nutrition: { "Muito ruim": 10, "Ruim": 30, "Regular": 50, "Boa": 75, "Muito boa": 95 },
    water: { "Menos de 1L": 15, "1-2L": 45, "2-3L": 75, "Mais de 3L": 95 },
    pain: { "Muito forte": 10, "Forte": 30, "Moderada": 50, "Leve": 75, "Sem dor": 95 },
    fatigue: { "Muito intensa": 10, "Intensa": 30, "Moderada": 50, "Leve": 75, "Sem fadiga": 95 },
    mood: { "Péssimo": 10, "Ruim": 30, "Regular": 50, "Bom": 75, "Excelente": 95 },
    motivation: { "Muito baixo": 10, "Baixo": 30, "Moderado": 50, "Alto": 75, "Muito alto": 95 },
  };

  function score(key: string, val: string): number {
    return scaleMap[key]?.[val] ?? 50;
  }

  const sleepScore = Math.round((score("sleepQuality", wellbeing.sleepQuality) + score("sleepHours", wellbeing.sleepHours)) / 2);
  const fatigueRaw = score("fatigue", wellbeing.fatigue);
  // fatigue in monitoring = how fatigued (inverted: high score = low fatigue, so invert)
  const fatigueScore = Math.round(100 - fatigueRaw);

  const allScores = [
    score("sleepQuality", wellbeing.sleepQuality), score("sleepHours", wellbeing.sleepHours),
    score("energy", wellbeing.energy), score("stress", wellbeing.stress),
    score("nutrition", wellbeing.nutrition), score("water", wellbeing.water),
    score("pain", wellbeing.pain), score("fatigue", wellbeing.fatigue),
    score("mood", wellbeing.mood), score("motivation", wellbeing.motivation),
  ];
  const filled = allScores.filter((s) => s !== 50 || true);
  const wellbeingScore = Math.round(filled.reduce((a, b) => a + b, 0) / filled.length);

  return { wellbeing: wellbeingScore, sleep: sleepScore, fatigue: fatigueScore };
}

function recalcMonitoring(athlete: Athlete, trainings: Athlete["completedTrainings"]): Athlete["monitoring"] {
  const m = { ...athlete.monitoring };
  if (!trainings.length) return m;

  // Use the most recent training's wellbeing for current scores
  const latest = trainings[0];
  const hasWellbeing = Object.values(latest.wellbeing).some((v) => v !== "");
  if (hasWellbeing) {
    const scores = wellbeingToScore(latest.wellbeing);
    m.wellbeing = scores.wellbeing;
    m.sleep = scores.sleep;
    m.fatigue = scores.fatigue;
  }

  // Recalc load metrics from all trainings
  m.sessionsCompleted = trainings.length;
  const totalLoad = trainings.reduce((sum, t) => sum + t.pse * parseInt(t.duration) || 0, 0);
  m.completedLoad = totalLoad;
  m.totalMinutes = trainings.reduce((sum, t) => sum + (parseInt(t.duration) || 0), 0);

  // Weekly PSE from trainings
  m.weeklyPse = trainings.slice(0, 4).map((t) => t.pse);
  m.weeklyLoads = trainings.slice(0, 4).map((t) => t.pse * (parseInt(t.duration) || 50));

  // Acute load = average of last 4 sessions × sessions
  const recentLoads = trainings.slice(0, 4).map((t) => t.pse * (parseInt(t.duration) || 50));
  m.acuteLoad = recentLoads.length ? Math.round(recentLoads.reduce((a, b) => a + b, 0) / recentLoads.length) : m.acuteLoad;
  m.chronicLoad = m.chronicLoad || m.acuteLoad;

  // ACWR
  m.acwr = m.chronicLoad > 0 ? +((m.acuteLoad / m.chronicLoad).toFixed(2)) : 1.0;
  m.riskLevel = (m.acwr > 1.3 ? "alto" : m.acwr < 0.8 ? "ok" : "atenção") as Risk;

  // Strain & monotony
  if (recentLoads.length > 1) {
    const mean = recentLoads.reduce((a, b) => a + b, 0) / recentLoads.length;
    const stdDev = Math.sqrt(recentLoads.reduce((sum, l) => sum + (l - mean) ** 2, 0) / recentLoads.length);
    m.monotony = stdDev > 0 ? +(mean / stdDev).toFixed(1) : 1.0;
    m.strain = Math.round(totalLoad * m.monotony);
  }

  return m;
}

/* ─── Pain & Injury Editors ─── */
type Pain = Athlete["completedTrainings"][0]["pains"][0];
type Injury = Athlete["completedTrainings"][0]["injuries"][0];

const painAreas = ["Ombro", "Cotovelo", "Punho", "Mão", "Coluna cervical", "Coluna torácica", "Coluna lombar", "Quadril", "Joelho", "Tornozelo", "Pé", "Coxa", "Panturrilha", "Abdômen", "Peito"];
const painIntensities = ["Leve", "Moderada", "Forte", "Muito forte"];
const painSides = ["Direito", "Esquerdo", "Bilateral", "Central"];
const painMoments = ["Antes do treino", "Durante o treino", "Após o treino", "Constante"];

const injuryTypes = ["Muscular", "Articular", "Ligamentar", "Tendinosa", "Óssea", "Contusão"];
const injuryGrades = ["Grau I (leve)", "Grau II (moderado)", "Grau III (grave)"];
const injuryAreas = painAreas;
const injurySides = ["Direito", "Esquerdo", "Bilateral", "Central"];

function PainEditor({ pains, onChange }: { pains: Pain[]; onChange: (p: Pain[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Pain>({ area: "", intensity: "", side: "", moment: "", description: "" });
  const selectClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer";
  const inputClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary/50 transition-colors resize-none";

  function addPain() {
    if (!draft.area) return;
    onChange([...pains, { ...draft }]);
    setDraft({ area: "", intensity: "", side: "", moment: "", description: "" });
    setAdding(false);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-display font-bold uppercase tracking-wider text-white">Dores</h4>
        <button type="button" onClick={() => setAdding(!adding)} className={cn("w-7 h-7 rounded-full border flex items-center justify-center transition-colors", adding ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20")}>
          {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">Informações sobre dores do atleta no dia do treino.</p>

      {adding && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 mb-3 space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Região</div>
            <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className={selectClass}>
              <option value="" disabled>Selecione a região...</option>
              {painAreas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Intensidade</div>
            <select value={draft.intensity} onChange={(e) => setDraft({ ...draft, intensity: e.target.value })} className={selectClass}>
              <option value="" disabled>Selecione...</option>
              {painIntensities.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Lado</div>
              <select value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value })} className={selectClass}>
                <option value="" disabled>Selecione...</option>
                {painSides.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Momento</div>
              <select value={draft.moment} onChange={(e) => setDraft({ ...draft, moment: e.target.value })} className={selectClass}>
                <option value="" disabled>Selecione...</option>
                {painMoments.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descrição</div>
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Descreva a dor..." rows={2} className={inputClass} />
          </div>
          <button type="button" onClick={addPain} disabled={!draft.area} className="w-full py-2.5 rounded-lg bg-amber-500 text-black text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-amber-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed">Adicionar dor</button>
        </div>
      )}

      {pains.length ? pains.map((p, pi) => (
        <div key={pi} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 mb-2 flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-400">{p.area}</div>
            <div className="text-[10px] text-slate-400 mt-1">{[p.intensity, p.side, p.moment].filter(Boolean).join(" · ")}</div>
            {p.description && <div className="text-[10px] text-slate-500 mt-0.5 italic">{p.description}</div>}
          </div>
          <button type="button" onClick={() => onChange(pains.filter((_, i) => i !== pi))} className="w-6 h-6 rounded-full border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0 mt-0.5">
            <X className="w-3 h-3" />
          </button>
        </div>
      )) : !adding && <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-slate-600">Nenhuma dor registrada neste treino.</div>}
    </div>
  );
}

function InjuryEditor({ injuries, onChange }: { injuries: Injury[]; onChange: (inj: Injury[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Injury>({ type: "", area: "", side: "", grade: "", description: "" });
  const selectClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer";
  const inputClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary/50 transition-colors resize-none";

  function addInjury() {
    if (!draft.type) return;
    onChange([...injuries, { ...draft }]);
    setDraft({ type: "", area: "", side: "", grade: "", description: "" });
    setAdding(false);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-display font-bold uppercase tracking-wider text-white">Lesões</h4>
        <button type="button" onClick={() => setAdding(!adding)} className={cn("w-7 h-7 rounded-full border flex items-center justify-center transition-colors", adding ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20")}>
          {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">Informações sobre lesões do atleta no dia do treino.</p>

      {adding && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 mb-3 space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Tipo de Lesão</div>
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={selectClass}>
              <option value="" disabled>Selecione o tipo...</option>
              {injuryTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Região</div>
            <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className={selectClass}>
              <option value="" disabled>Selecione a região...</option>
              {injuryAreas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Lado</div>
              <select value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value })} className={selectClass}>
                <option value="" disabled>Selecione...</option>
                {injurySides.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Gravidade</div>
              <select value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} className={selectClass}>
                <option value="" disabled>Selecione...</option>
                {injuryGrades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Descrição</div>
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Descreva a lesão..." rows={2} className={inputClass} />
          </div>
          <button type="button" onClick={addInjury} disabled={!draft.type} className="w-full py-2.5 rounded-lg bg-red-500 text-white text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-red-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed">Adicionar lesão</button>
        </div>
      )}

      {injuries.length ? injuries.map((inj, ii) => (
        <div key={ii} className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 mb-2 flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="text-sm font-medium text-red-400">{inj.type}</div>
            <div className="text-[10px] text-slate-400 mt-1">{[inj.grade, inj.area, inj.side].filter(Boolean).join(" · ")}</div>
            {inj.description && <div className="text-[10px] text-slate-500 mt-0.5 italic">{inj.description}</div>}
          </div>
          <button type="button" onClick={() => onChange(injuries.filter((_, i) => i !== ii))} className="w-6 h-6 rounded-full border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0 mt-0.5">
            <X className="w-3 h-3" />
          </button>
        </div>
      )) : !adding && <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-slate-600">Nenhuma lesão registrada neste treino.</div>}
    </div>
  );
}

/* ─── Single Training Evaluation Form (editable) ─── */
function WellbeingSelect({ label, options, value, onChange }: { label: string; options: Array<{ label: string; color: string }>; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const selected = options.find((o) => o.label === value);
  return (
    <div ref={ref} className="relative">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{label}</div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-all",
          open ? "border-primary/50 bg-[#050505]" : "border-white/10 bg-[#050505] hover:border-white/20",
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selected.color }} />
            <span style={{ color: selected.color }}>{selected.label}</span>
          </span>
        ) : (
          <span className="text-slate-500">Selecione...</span>
        )}
        <ChevronRight className={cn("w-4 h-4 text-slate-500 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#0B0F14] shadow-2xl overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => { onChange(opt.label); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                value === opt.label ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
              <span style={{ color: opt.color }}>{opt.label}</span>
              {value === opt.label && <CheckCircle2 className="w-3.5 h-3.5 ml-auto" style={{ color: opt.color }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScaleModal({ type, onClose }: { type: "psr" | "pse"; onClose: () => void }) {
  const psrScale = [
    { value: 0, label: "Nenhuma recuperação", color: "#EF4444" },
    { value: 1, label: "Muito pouco recuperado", color: "#EF4444" },
    { value: 2, label: "Pouco recuperado", color: "#F97316" },
    { value: 3, label: "Recuperação moderada", color: "#F59E0B" },
    { value: 4, label: "Boa recuperação", color: "#EAB308" },
    { value: 5, label: "Recuperação muito boa", color: "#84CC16" },
    { value: 6, label: "", color: "#84CC16" },
    { value: 7, label: "Recuperação extremamente boa", color: "#22C55E" },
    { value: 8, label: "", color: "#22C55E" },
    { value: 9, label: "", color: "#22C55E" },
    { value: 10, label: "Recuperado", color: "#22C55E" },
  ];
  const pseScale = [
    { value: 0, label: "Absolutamente nada", color: "#22C55E" },
    { value: 1, label: "Extremamente fraco", color: "#84CC16" },
    { value: 2, label: "Muito fraco", color: "#84CC16" },
    { value: 3, label: "Moderado", color: "#EAB308" },
    { value: 4, label: "Pouco forte", color: "#EAB308" },
    { value: 5, label: "Forte", color: "#F59E0B" },
    { value: 6, label: "", color: "#F97316" },
    { value: 7, label: "Muito forte", color: "#F97316" },
    { value: 8, label: "", color: "#EF4444" },
    { value: 9, label: "", color: "#EF4444" },
    { value: 10, label: "Máximo", color: "#EF4444" },
  ];
  const scale = type === "psr" ? psrScale : pseScale;
  const title = type === "psr" ? "Escala de Percepção Subjetiva de Recuperação" : "Escala de Percepção Subjetiva de Esforço";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B0F14] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-display font-bold text-white">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-1.5">
          {scale.map(s => (
            <div key={s.value} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: s.color }}>{s.value}</div>
              {s.label && <span className="text-sm text-slate-300">• {s.label}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrainingEvalForm({ training, onChange }: { training: Athlete["completedTrainings"][0]; onChange: (t: Athlete["completedTrainings"][0]) => void }) {
  const inputClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary/50 transition-colors";
  const sliderClass = "w-full mt-2 h-1.5 appearance-none bg-white/10 rounded-full cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black";
  const [showScale, setShowScale] = useState<"psr" | "pse" | null>(null);

  function updateWellbeing(key: string, val: string) {
    onChange({ ...training, wellbeing: { ...training.wellbeing, [key]: val } });
  }

  // Colors: red = bad, orange = poor, yellow = moderate, lime = good, green = excellent
  const c = { red: "#EF4444", orange: "#F97316", yellow: "#EAB308", lime: "#84CC16", green: "#22C55E" };

  const wellbeingFields: Array<{ key: keyof typeof training.wellbeing; label: string; options: Array<{ label: string; color: string }> }> = [
    { key: "sleepQuality", label: "Qualidade do Sono", options: [
      { label: "Péssima", color: c.red }, { label: "Ruim", color: c.orange }, { label: "Normal", color: c.yellow }, { label: "Boa", color: c.lime }, { label: "Excelente", color: c.green },
    ]},
    { key: "sleepHours", label: "Horas de Sono", options: [
      { label: "Menos de 5h", color: c.red }, { label: "5-6h", color: c.yellow }, { label: "7-8h", color: c.lime }, { label: "Mais de 8h", color: c.green },
    ]},
    { key: "energy", label: "Energia", options: [
      { label: "Muito baixo", color: c.red }, { label: "Baixo", color: c.orange }, { label: "Moderado", color: c.yellow }, { label: "Alto", color: c.lime }, { label: "Muito alto", color: c.green },
    ]},
    { key: "stress", label: "Nível de Stress", options: [
      { label: "Muito baixo", color: c.green }, { label: "Baixo", color: c.lime }, { label: "Moderado", color: c.yellow }, { label: "Alto", color: c.orange }, { label: "Muito alto", color: c.red },
    ]},
    { key: "nutrition", label: "Alimentação", options: [
      { label: "Muito ruim", color: c.red }, { label: "Ruim", color: c.orange }, { label: "Regular", color: c.yellow }, { label: "Boa", color: c.lime }, { label: "Muito boa", color: c.green },
    ]},
    { key: "water", label: "Ingestão de Água", options: [
      { label: "Menos de 1L", color: c.red }, { label: "1-2L", color: c.yellow }, { label: "2-3L", color: c.lime }, { label: "Mais de 3L", color: c.green },
    ]},
    { key: "pain", label: "Dor", options: [
      { label: "Muito forte", color: c.red }, { label: "Forte", color: c.orange }, { label: "Moderada", color: c.yellow }, { label: "Leve", color: c.lime }, { label: "Sem dor", color: c.green },
    ]},
    { key: "fatigue", label: "Fadiga", options: [
      { label: "Muito intensa", color: c.red }, { label: "Intensa", color: c.orange }, { label: "Moderada", color: c.yellow }, { label: "Leve", color: c.lime }, { label: "Sem fadiga", color: c.green },
    ]},
    { key: "mood", label: "Humor", options: [
      { label: "Péssimo", color: c.red }, { label: "Ruim", color: c.orange }, { label: "Regular", color: c.yellow }, { label: "Bom", color: c.lime }, { label: "Excelente", color: c.green },
    ]},
    { key: "motivation", label: "Motivação", options: [
      { label: "Muito baixo", color: c.red }, { label: "Baixo", color: c.orange }, { label: "Moderado", color: c.yellow }, { label: "Alto", color: c.lime }, { label: "Muito alto", color: c.green },
    ]},
  ];

  return (
    <>
    {showScale && <ScaleModal type={showScale} onClose={() => setShowScale(null)} />}
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        {/* Wellbeing */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-5">
            <h4 className="text-sm font-display font-bold uppercase tracking-wider text-white">Avaliação de Bem-Estar</h4>
            <span className="text-[10px] font-mono text-slate-500">Informações no dia do treinamento</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wellbeingFields.map(({ key, label, options }) => (
              <WellbeingSelect
                key={key}
                label={label}
                options={options}
                value={training.wellbeing[key]}
                onChange={(val) => updateWellbeing(key, val)}
              />
            ))}
          </div>
        </div>

        {/* Training details */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h4 className="text-sm font-display font-bold uppercase tracking-wider text-white mb-4">Editar Treino Concluído</h4>
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Data do Treino</div>
              <div className="rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-slate-300 flex items-center justify-between">{training.date}<CalendarIcon className="w-4 h-4 text-slate-500" /></div>
            </div>
            <SearchableDropdown label="Tipo de Treino" placeholder="Selecione o tipo" options={trainingTypesMock.filter((t) => t.status === "ativo").map((t) => t.name).sort()} value={training.type} onChange={(val) => onChange({ ...training, type: val })} />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Duração do treino (minutos)</div>
              <input type="number" value={training.duration.replace(" min", "")} onChange={(e) => onChange({ ...training, duration: `${e.target.value} min` })} className={inputClass} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Resumo do Treino</div>
              <textarea value={training.summary} onChange={(e) => onChange({ ...training, summary: e.target.value })} placeholder="Descreva o treinamento..." rows={3} className={cn(inputClass, "resize-none")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">PSR</div>
                <input type="number" min={0} max={10} value={training.psr} onChange={(e) => onChange({ ...training, psr: Number(e.target.value) })} className={inputClass} />
                <input type="range" min={0} max={10} value={training.psr} onChange={(e) => onChange({ ...training, psr: Number(e.target.value) })} className={sliderClass} />
                <button type="button" onClick={() => setShowScale("psr")} className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500 hover:text-white transition-colors"><Info className="w-3 h-3" /> Ver escala</button>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">PSE</div>
                <input type="number" min={0} max={10} value={training.pse} onChange={(e) => onChange({ ...training, pse: Number(e.target.value) })} className={inputClass} />
                <input type="range" min={0} max={10} value={training.pse} onChange={(e) => onChange({ ...training, pse: Number(e.target.value) })} className={sliderClass} />
                <button type="button" onClick={() => setShowScale("pse")} className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500 hover:text-white transition-colors"><Info className="w-3 h-3" /> Ver escala</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right column — Pain & Injury */}
      <div className="space-y-4">
        <PainEditor pains={training.pains} onChange={(pains) => onChange({ ...training, pains })} />
        <InjuryEditor injuries={training.injuries} onChange={(injuries) => onChange({ ...training, injuries })} />
      </div>
    </div>
    </>
  );
}

/* ─── Completed Trainings Tab ─── */
function CompletedTrainingsTab({ athlete, autoExpand = false, onSaveTrainings }: { athlete: Athlete; autoExpand?: boolean; onSaveTrainings?: (trainings: Athlete["completedTrainings"]) => void }) {
  const { canEdit, canDelete, isAdmin, user: currentUserPerm } = usePermissions();
  const { coaches: dbCoachesCompleted, trainingTypes: dbTypes } = useData();
  const myCoachName = useMemo(() => { if (isAdmin) return null; const match = dbCoachesCompleted.find(c => c.email.toLowerCase() === currentUserPerm.email.toLowerCase()); return match?.name || null; }, [isAdmin, currentUserPerm.email, dbCoachesCompleted]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [trainings, setTrainings] = useState(athlete.completedTrainings);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Fetch completed trainings from DB
  useEffect(() => {
    fetch(`/api/athletes/${athlete.id}`).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.sessions) {
        const completed = data.sessions
          .filter((s: any) => s.completedAt)
          .map((s: any) => ({
            _sessionId: s.id, _coachName: s.coach?.name || "",
            day: new Date(s.date).toLocaleDateString("pt-BR", { weekday: "long" }),
            date: new Date(s.date).toLocaleDateString("pt-BR"),
            type: s.trainingType?.name || "Livre",
            duration: `${s.duration || 50} min`,
            pse: s.pseActual || s.psePlanned || 4,
            psr: s.psr || 0,
            load: `${(s.pseActual || s.psePlanned || 4) * (s.duration || 50)} U.A.`,
            summary: s.summary || "",
            wellbeing: s.wellbeing ? {
              sleepQuality: s.wellbeing.sleepQuality || "",
              sleepHours: s.wellbeing.sleepHours || "",
              energy: s.wellbeing.energy || "",
              stress: s.wellbeing.stress || "",
              nutrition: s.wellbeing.nutrition || "",
              water: s.wellbeing.water || "",
              pain: s.wellbeing.pain || "",
              fatigue: s.wellbeing.fatigue || "",
              mood: s.wellbeing.mood || "",
              motivation: s.wellbeing.motivation || "",
            } : { sleepQuality: "", sleepHours: "", energy: "", stress: "", nutrition: "", water: "", pain: "", fatigue: "", mood: "", motivation: "" },
            pains: (s.pains || []).map((p: any) => ({ area: p.area, intensity: p.intensity || "", side: p.side || "", moment: p.moment || "", description: p.description || "" })),
            injuries: (s.injuries || []).map((i: any) => ({ type: i.type, area: i.area || "", side: i.side || "", grade: i.grade || "", description: i.description || "" })),
          }));
        if (completed.length > 0) {
          // Filter: personais see only their own completed trainings
          const filtered = myCoachName
            ? completed.filter((t: any) => t._coachName === myCoachName)
            : completed;
          setTrainings(filtered.length > 0 ? filtered : completed.slice(0, 0)); // empty if no match for personal
          if (isAdmin) setTrainings(completed); // admin sees all
          if (autoExpand && (isAdmin ? completed : filtered).length > 0) setExpandedIdx(0);
        }
      }
      setDbLoaded(true);
    }).catch(() => setDbLoaded(true));
  }, [athlete.id, autoExpand]);

  // Also sync from prop (for newly added via openAthleteWithTab)
  useEffect(() => {
    if (athlete.completedTrainings.length > 0 && !dbLoaded) {
      setTrainings(athlete.completedTrainings);
      if (autoExpand) setExpandedIdx(0);
    }
  }, [athlete.completedTrainings, autoExpand, dbLoaded]);

  function updateTraining(idx: number, updated: Athlete["completedTrainings"][0]) {
    setTrainings((prev) => prev.map((t, i) => i === idx ? { ...updated, _sessionId: (t as any)._sessionId, _coachName: (t as any)._coachName } as any : t));
  }

  function deleteTraining(idx: number) {
    setTrainings((prev) => prev.filter((_, i) => i !== idx));
    setExpandedIdx(null);
    setConfirmDeleteIdx(null);
  }

  if (!trainings.length) {
    return (
      <SurfaceCard>
        <CardHeader><CardTitle>Treinos concluídos</CardTitle></CardHeader>
        <CardContent><div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-600">Sem treinos concluídos</div></CardContent>
      </SurfaceCard>
    );
  }

  return (
    <>
    {confirmDeleteIdx !== null && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setConfirmDeleteIdx(null)}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#0B0F14] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
            <h3 className="text-lg font-display font-bold text-white">Confirmar exclusão</h3>
          </div>
          <p className="text-sm text-slate-400 mb-6">Tem certeza que deseja excluir este treino concluído? Esta ação não pode ser desfeita.</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDeleteIdx(null)} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-colors">Cancelar</button>
            <button onClick={() => deleteTraining(confirmDeleteIdx)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-red-400 transition-all flex items-center justify-center gap-2"><X className="w-3.5 h-3.5" /> Excluir</button>
          </div>
        </div>
      </div>
    )}
    <div className="space-y-4">
      {trainings.map((t, i) => {
        const isOpen = expandedIdx === i;
        return (
          <SurfaceCard key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <button onClick={() => setExpandedIdx(isOpen ? null : i)} className="flex-1 text-left">
                  <div>
                    <CardTitle className="text-base">{t.day} · {t.type}</CardTitle>
                    <CardDescription className="text-slate-500 mt-1">{t.date} · {t.duration} · PSE {t.pse} · {t.load}{(t as any)._coachName ? ` · ${(t as any)._coachName}` : ""}</CardDescription>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  {canDelete && <button onClick={() => setConfirmDeleteIdx(i)} className="w-8 h-8 rounded-full border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors" title="Excluir treino">
                    <X className="w-3.5 h-3.5" />
                  </button>}
                  <ChevronRight className={cn("w-5 h-5 text-slate-500 transition-transform cursor-pointer", isOpen && "rotate-90")} onClick={() => setExpandedIdx(isOpen ? null : i)} />
                </div>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent className="border-t border-white/10 pt-6">
                <TrainingEvalForm training={t} onChange={(updated) => { const coachMatch = isAdmin || !myCoachName || (t as any)._coachName === myCoachName; if (coachMatch) updateTraining(i, updated); }} />
                {(isAdmin || (myCoachName && (t as any)._coachName === myCoachName)) && <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setExpandedIdx(null)} className="px-5 py-2.5 border border-white/20 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-colors">Cancelar</button>
                    {canDelete && <button type="button" onClick={() => setConfirmDeleteIdx(i)} className="px-5 py-2.5 border border-red-500/30 text-red-400 text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-red-500/10 transition-colors flex items-center gap-2">
                      <X className="w-3.5 h-3.5" /> Excluir
                    </button>}
                  </div>
                  <button type="button" onClick={async () => {
                    // Save to DB via API
                    const training = trainings[expandedIdx!];
                    if (training) {
                      const sessionId = (training as any)._sessionId;
                      if (sessionId) {
                        try {
                          await apiPost(`/api/sessions/${sessionId}/complete`, {
                            pseActual: training.pse,
                            psr: training.psr,
                            duration: parseInt(training.duration) || 50,
                            summary: training.summary,
                            trainingTypeId: (() => { const m = dbTypes.find(t => t.name === training.type); return m?.id; })(),
                            wellbeing: training.wellbeing,
                            pains: training.pains,
                            injuries: training.injuries,
                          });
                        } catch {}
                      }
                    }
                    onSaveTrainings?.(trainings);
                    setExpandedIdx(null);
                  }} className="flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] text-black uppercase hover:bg-primary-hover transition-all shadow-glow">
                    <CheckCircle2 className="w-4 h-4" /> Salvar
                  </button>
                </div>}
              </CardContent>
            )}
          </SurfaceCard>
        );
      })}
    </div>
    </>
  );
}

/* ─── Pain History Tab ─── */
function PainHistoryTab({ athleteId }: { athleteId: number }) {
  const [pains, setPains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/athletes/${athleteId}`).then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        const allPains = (data.pains || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPains(allPains);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [athleteId]);

  if (loading) return <SurfaceCard><CardContent className="p-8 text-center text-slate-500">Carregando...</CardContent></SurfaceCard>;

  return (
    <SurfaceCard>
      <CardHeader><CardTitle>Histórico de dores</CardTitle><CardDescription className="text-slate-500">{pains.length} registros</CardDescription></CardHeader>
      <CardContent>
        {pains.length ? pains.map((p: any, i: number) => (
          <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-amber-400">{p.area}</div>
              <div className="text-[10px] text-slate-500">{new Date(p.date).toLocaleDateString("pt-BR")}</div>
            </div>
            <div className="text-xs text-slate-500 mt-1">{[p.intensity, p.side, p.moment].filter(Boolean).join(" · ")}</div>
          </div>
        )) : <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-600">O atleta ainda não possui histórico de dores.</div>}
      </CardContent>
    </SurfaceCard>
  );
}

/* ─── Injury History Tab ─── */
function InjuryHistoryTab({ athleteId }: { athleteId: number }) {
  const [injuries, setInjuries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/athletes/${athleteId}`).then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        const allInjuries = (data.injuries || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setInjuries(allInjuries);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [athleteId]);

  if (loading) return <SurfaceCard><CardContent className="p-8 text-center text-slate-500">Carregando...</CardContent></SurfaceCard>;

  return (
    <SurfaceCard>
      <CardHeader><CardTitle>Histórico de lesões</CardTitle><CardDescription className="text-slate-500">{injuries.length} registros</CardDescription></CardHeader>
      <CardContent>
        {injuries.length ? injuries.map((inj: any, i: number) => (
          <div key={i} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 mb-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-red-400">{inj.type}</div>
              <div className="text-[10px] text-slate-500">{new Date(inj.date).toLocaleDateString("pt-BR")}</div>
            </div>
            <div className="text-xs text-slate-500 mt-1">{[inj.grade, inj.area, inj.side].filter(Boolean).join(" · ")}</div>
          </div>
        )) : <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-600">O atleta ainda não possui histórico de lesões.</div>}
      </CardContent>
    </SurfaceCard>
  );
}

/* ─── Cancelled Trainings Tab ─── */
function CancelledTrainingsTab({ athleteId, athleteName }: { athleteId: number; athleteName: string }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/athletes/${athleteId}`).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.sessions) {
        const cancelled = data.sessions
          .filter((s: any) => s.status === "Cancelado")
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSessions(cancelled);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [athleteId]);

  if (loading) return <SurfaceCard><CardContent className="p-8 text-center text-slate-500">Carregando...</CardContent></SurfaceCard>;

  return (
    <SurfaceCard>
      <CardHeader>
        <CardTitle>Treinos cancelados</CardTitle>
        <CardDescription className="text-slate-500">{sessions.length} treinos cancelados para {athleteName}</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-600">Nenhum treino cancelado</div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s: any) => {
              const d = new Date(s.date);
              const dateStr = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
              return (
                <div key={s.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display font-medium text-white capitalize">{dateStr}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {s.startTime} - {s.endTime} · {s.trainingType?.name || "—"} · {s.location || "Academia"}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">Coach: {s.coach?.name || "—"} · PSE: {s.psePlanned || 4}</div>
                      {s.summary && <div className="text-xs text-slate-500 mt-1 italic">{s.summary}</div>}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10">
                      <CircleAlert className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Cancelado</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </SurfaceCard>
  );
}

/* ─── Planned Trainings Tab (future sessions from DB) ─── */
function PlannedTrainingsTab({ athleteId, athleteName }: { athleteId: number; athleteName: string }) {
  const { trainingTypes: dbTypes } = useData();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ startTime: "", endTime: "", type: "", location: "", pse: 4 });
  const inputClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-colors";
  const selectClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer";

  const typeNames = useMemo(() => dbTypes.filter(t => t.isEnabled).map(t => t.name).sort(), [dbTypes]);

  async function fetchSessions() {
    setLoading(true);
    try {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const res = await fetch(`/api/athletes/${athleteId}`);
      if (res.ok) {
        const data = await res.json();
        // Get future sessions from all sessions
        const futureSessions = (data.sessions || []).filter((s: any) => !s.completedAt && s.status !== "Cancelado" && new Date(s.date) >= today);
        setSessions(futureSessions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchSessions(); }, [athleteId]);

  function startEdit(s: any) {
    setEditForm({ startTime: s.startTime, endTime: s.endTime, type: s.trainingType?.name || "", location: s.location || "Academia", pse: s.psePlanned || 4 });
    setEditingId(s.id);
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      const updateData: any = { startTime: editForm.startTime, endTime: editForm.endTime, location: editForm.location, psePlanned: editForm.pse };
      if (editForm.type) {
        // Use cached types first, fallback to API
        let tid = dbTypes.find(t => t.name === editForm.type)?.id;
        if (!tid) {
          const tts = await fetch("/api/training-types").then(r => r.json()).catch(() => []);
          tid = tts.find((t: any) => t.name === editForm.type)?.id;
        }
        if (tid) updateData.trainingTypeId = tid;
      }
      // Always send trainingTypeId even if same — ensures it persists
      await apiPut(`/api/sessions/${editingId}`, updateData);
      // Update local state immediately
      setSessions(prev => prev.map(s => s.id === editingId ? { ...s, startTime: editForm.startTime, endTime: editForm.endTime, location: editForm.location, psePlanned: editForm.pse, trainingType: { ...s.trainingType, name: editForm.type } } : s));
      setEditingId(null);
    } catch {}
  }

  async function cancelSession(id: number) {
    try {
      await apiPut(`/api/sessions/${id}`, { status: "Cancelado" });
      fetchSessions();
    } catch {}
  }

  if (loading) return <SurfaceCard><CardContent className="p-8 text-center text-slate-500">Carregando treinos planejados...</CardContent></SurfaceCard>;

  return (
    <SurfaceCard>
      <CardHeader>
        <CardTitle>Treinos planejados</CardTitle>
        <CardDescription className="text-slate-500">Sessões futuras agendadas para {athleteName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-600">Sem treinos planejados</div>
        ) : sessions.map((s) => {
          const d = new Date(s.date);
          const dateStr = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
          const isEditing = editingId === s.id;

          return (
            <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="text-sm font-display font-medium text-white mb-2">{dateStr}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Início</div>
                      <input type="time" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} className={cn(inputClass, "[color-scheme:dark]")} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Fim</div>
                      <input type="time" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} className={cn(inputClass, "[color-scheme:dark]")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tipo de Treino</div>
                      <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className={selectClass}>
                        {typeNames.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Local</div>
                      <select value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className={selectClass}>
                        {["Academia", "Campo", "CT", "Home"].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">PSE</div>
                    <input type="number" min={0} max={10} value={editForm.pse} onChange={(e) => setEditForm({ ...editForm, pse: Number(e.target.value) })} className={inputClass} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditingId(null)} className="flex-1 py-2 rounded-lg border border-white/20 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-white/5 transition-colors">Cancelar</button>
                    <button onClick={saveEdit} className="flex-1 py-2 rounded-lg bg-primary text-black text-[11px] font-bold uppercase tracking-wider hover:bg-primary-hover transition-all shadow-glow">Salvar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display font-medium text-white">{dateStr}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.startTime} - {s.endTime} · {s.trainingType?.name || "Livre"} · {s.location || "Academia"} · PSE {s.psePlanned || 4}</div>
                    <div className="text-xs text-slate-600 mt-0.5">Coach: {s.coach?.name || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(s)} className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/10 transition-colors">Editar</button>
                    <button onClick={() => cancelSession(s.id)} className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/10 transition-colors">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </SurfaceCard>
  );
}

/* ─── Athlete Info Tab (editable for admin) ─── */
function countryFlag(iso: string): string {
  return [...iso.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}

function PhoneCountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = phoneCountries.find(c => c.code === value);
  return (
    <div ref={ref} className="relative w-[130px]">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 rounded-lg border border-white/10 bg-[#050505] px-3 py-3 text-sm text-white hover:border-white/20 transition-colors">
        <span className="text-base">{countryFlag(selected?.iso || "BR")}</span>
        <span>{value}</span>
        <ChevronRight className={cn("w-3 h-3 ml-auto text-slate-500 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-[220px] max-h-[250px] overflow-y-auto rounded-lg border border-white/10 bg-[#0B0F14] shadow-2xl">
          {phoneCountries.map(c => (
            <button key={c.code} type="button" onClick={() => { onChange(c.code); setOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors", value === c.code ? "bg-white/[0.06] text-white" : "text-slate-300 hover:bg-white/[0.04]")}>
              <span className="text-base">{countryFlag(c.iso)}</span>
              <span className="flex-1">{c.country}</span>
              <span className="text-slate-500 text-xs">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
const dfmt = (p: string) => p;
const brFmt = (p: string) => { const c = p.replace(/\D/g, ""); if (c.length === 11) return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`; if (c.length === 10) return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`; return p; };
const usFmt = (p: string) => { const c = p.replace(/\D/g, ""); if (c.length === 10) return `(${c.slice(0,3)}) ${c.slice(3,6)}-${c.slice(6)}`; return p; };
const ptFmt = (p: string) => { const c = p.replace(/\D/g, ""); return c.length === 9 ? `${c.slice(0,3)} ${c.slice(3,6)} ${c.slice(6)}` : p; };
const phoneCountries = [
  { code: "+55", country: "Brasil", iso: "BR", fmt: brFmt },
  { code: "+1", country: "EUA/Canada", iso: "US", fmt: usFmt },
  { code: "+351", country: "Portugal", iso: "PT", fmt: ptFmt },
  { code: "+34", country: "Espanha", iso: "ES", fmt: dfmt },
  { code: "+39", country: "Italia", iso: "IT", fmt: dfmt },
  { code: "+44", country: "Reino Unido", iso: "GB", fmt: dfmt },
  { code: "+33", country: "Franca", iso: "FR", fmt: dfmt },
  { code: "+49", country: "Alemanha", iso: "DE", fmt: dfmt },
  { code: "+54", country: "Argentina", iso: "AR", fmt: dfmt },
  { code: "+598", country: "Uruguai", iso: "UY", fmt: dfmt },
  { code: "+595", country: "Paraguai", iso: "PY", fmt: dfmt },
  { code: "+971", country: "Emirados Arabes", iso: "AE", fmt: dfmt },
  { code: "+81", country: "Japao", iso: "JP", fmt: dfmt },
  { code: "+52", country: "Mexico", iso: "MX", fmt: dfmt },
  { code: "+66", country: "Tailandia", iso: "TH", fmt: dfmt },
  { code: "+62", country: "Indonesia", iso: "ID", fmt: dfmt },
  { code: "+423", country: "Liechtenstein", iso: "LI", fmt: dfmt },
  { code: "+7", country: "Russia", iso: "RU", fmt: dfmt },
  { code: "+20", country: "Egito", iso: "EG", fmt: dfmt },
  { code: "+46", country: "Suecia", iso: "SE", fmt: dfmt },
  { code: "+968", country: "Oma", iso: "OM", fmt: dfmt },
  { code: "+40", country: "Romenia", iso: "RO", fmt: dfmt },
  { code: "+380", country: "Ucrania", iso: "UA", fmt: dfmt },
  { code: "+359", country: "Bulgaria", iso: "BG", fmt: dfmt },
  { code: "+972", country: "Israel", iso: "IL", fmt: dfmt },
  { code: "+966", country: "Arabia Saudita", iso: "SA", fmt: dfmt },
  { code: "+855", country: "Camboja", iso: "KH", fmt: dfmt },
  { code: "+880", country: "Bangladesh", iso: "BD", fmt: dfmt },
  { code: "+355", country: "Albania", iso: "AL", fmt: dfmt },
  { code: "+41", country: "Suica", iso: "CH", fmt: dfmt },
  { code: "+90", country: "Turquia", iso: "TR", fmt: dfmt },
  { code: "+973", country: "Bahrein", iso: "BH", fmt: dfmt },
  { code: "+86", country: "China", iso: "CN", fmt: dfmt },
  { code: "+56", country: "Chile", iso: "CL", fmt: dfmt },
  { code: "+57", country: "Colombia", iso: "CO", fmt: dfmt },
];
function fmtPhone(phone: string | null, cc: string | null): string { if (!phone) return "---"; const co = phoneCountries.find(x => x.code === (cc || "+55")); const f = co ? co.fmt(phone) : phone; return `${countryFlag(co?.iso || "BR")} ${cc || "+55"} ${f}`; }
function AthleteInfoTab({ athleteId, name, email, phone, age, height, weight, position, goal, phoneCountry, formatPhone }: { athleteId: number; name: string; email: string; phone: string | null; age: number | null; height: string | null; weight: string | null; position: string | null; goal: string | null; phoneCountry?: string | null; formatPhone: (p: string | null) => string }) {
  const { isAdmin } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name, email, phone: phone || "", phoneCountry: phoneCountry || "+55", age: String(age || ""), height: height || "", weight: weight || "", position: position || "", goal: goal || "" });
  const [saved, setSaved] = useState(false);
  const inputClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary/50 transition-colors";

  async function handleSave() {
    try {
      await apiPut(`/api/athletes/${athleteId}`, {
        name: form.name, email: form.email, phone: form.phone || null,
        age: form.age ? Number(form.age) : null,
        height: form.height || null, weight: form.weight || null,
        position: form.position || null, goal: form.goal || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } catch {}
  }

  if (editing) {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <CardHeader><CardTitle>Informações pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Nome</div><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></div>
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">E-mail</div><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} /></div>
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Telefone</div><div className="flex gap-2"><PhoneCountrySelect value={form.phoneCountry} onChange={v => setForm({ ...form, phoneCountry: v })} /><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Numero" className={inputClass} /></div></div>
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Idade</div><input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} className={inputClass} /></div>
          </CardContent>
        </SurfaceCard>
        <SurfaceCard>
          <CardHeader><CardTitle>Dados físicos e esportivos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Altura</div><input value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} placeholder="1.75" className={inputClass} /></div>
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Peso</div><input value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="78" className={inputClass} /></div>
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Posição</div><input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Lateral Direito" className={inputClass} /></div>
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Objetivo</div><textarea value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} rows={2} className={cn(inputClass, "resize-none")} /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-3 rounded-xl border border-white/20 text-white text-sm font-bold uppercase tracking-[0.15em] hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-primary text-black text-sm font-bold uppercase tracking-[0.15em] hover:bg-primary-hover transition-all shadow-glow">Salvar</button>
            </div>
          </CardContent>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 text-primary text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-primary/10 transition-colors">
            <Settings className="w-4 h-4" /> Editar informações
          </button>
          {saved && <span className="ml-3 text-sm text-emerald-400">Salvo!</span>}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard><CardHeader><CardTitle>Informações pessoais</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><InfoBlock label="Nome" value={name} /><InfoBlock label="E-mail" value={email} /><InfoBlock label="Telefone" value={fmtPhone(phone, phoneCountry || null)} /><InfoBlock label="Idade" value={age ? `${age} anos` : "—"} /></CardContent></SurfaceCard>
        <SurfaceCard><CardHeader><CardTitle>Dados físicos e esportivos</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><InfoBlock label="Altura" value={height ? `${height} m` : "—"} /><InfoBlock label="Peso" value={weight ? `${weight} kg` : "—"} /><InfoBlock label="Posição" value={position || "—"} /><InfoBlock label="Objetivo" value={goal || "—"} /></CardContent></SurfaceCard>
      </div>
    </div>
  );
}

function AthleteDetailPage({ athlete: athleteProp, initialTab = "overview" }: { athlete: Athlete; initialTab?: string }) {
  const [athlete, setAthlete] = useState(athleteProp);
  const [dbAthlete, setDbAthlete] = useState<any>(null);
  const athleteIdRef = useRef(athleteProp.id);
  const prevTrainingsCountRef = useRef(athleteProp.completedTrainings.length);
  useEffect(() => {
    const idChanged = athleteProp.id !== athleteIdRef.current;
    const trainingsChanged = athleteProp.completedTrainings.length !== prevTrainingsCountRef.current;
    if (idChanged || trainingsChanged) {
      athleteIdRef.current = athleteProp.id;
      prevTrainingsCountRef.current = athleteProp.completedTrainings.length;
      setAthlete(athleteProp);
      if (idChanged) setDbAthlete(null);
    }
  }, [athleteProp]);

  // Fetch real data from DB
  const [dbLoading, setDbLoading] = useState(true);
  const { data: realMon } = useApi<any>(`/api/monitoring/${athleteProp.id}`);
  useEffect(() => {
    setDbLoading(true);
    fetch(`/api/athletes/${athleteProp.id}`).then(r => r.ok ? r.json() : null).then(data => {
      if (data) setDbAthlete(data);
    }).catch(() => {}).finally(() => setDbLoading(false));
  }, [athleteProp.id]);

  // Use DB data only — no mock fallback to prevent name flash
  const db = dbAthlete;
  const realName = db?.name || athlete.name;
  const realEmail = db?.email || athlete.email;
  const realPhone = db?.phone || athlete.phone;
  const realAge = db?.age || athlete.age;
  const realPosition = db?.position || null;
  const realGoal = db?.goal || null;
  const realWeight = db?.weight ? `${db.weight} kg` : "—";
  const realHeight = db?.height ? `${db.height} m` : "—";
  const realCoach = db?.coach?.name || athlete.coach;
  const realCountry = db?.country || "Brasil";
  const realCity = db?.city || "—";
  const realState = db?.state || "—";

  function handleSaveTrainings(trainings: Athlete["completedTrainings"]) {
    const newMonitoring = recalcMonitoring(athlete, trainings);
    const allPains = trainings.flatMap((t) => t.pains.map((p) => ({ ...p, date: t.date })));
    const allInjuries = trainings.flatMap((t) => t.injuries.map((inj) => ({ ...inj, date: t.date })));
    setAthlete((prev) => ({
      ...prev,
      monitoring: newMonitoring,
      completedTrainings: trainings,
      pains: [...allPains, ...prev.pains.filter((p) => !allPains.some((ap) => ap.date === p.date && ap.area === p.area))],
      injuries: [...allInjuries, ...prev.injuries.filter((inj) => !allInjuries.some((ai) => ai.date === inj.date && ai.type === inj.type))],
      risk: (newMonitoring.acwr > 1.3 ? "alto" : newMonitoring.acwr < 0.8 ? "ok" : "atenção") as Risk,
    }));
  }

  const checks = [
    { label: "Sono", value: athlete.monitoring.sleep },
    { label: "Bem-estar", value: athlete.monitoring.wellbeing },
    { label: "Fadiga", value: athlete.monitoring.fatigue },
  ];
  const { isDark } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Format phone
  const formatPhone = (p: string | null) => {
    if (!p) return "—";
    const clean = p.replace(/\D/g, "");
    if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`;
    return p;
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-5">
        <div className="relative group">
          <div className={cn("w-16 h-16 rounded-full border-2 flex items-center justify-center overflow-hidden", isDark ? "border-white/10 bg-white/[0.05]" : "border-gray-200 bg-gray-100")}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={realName} className="w-full h-full object-cover" />
            ) : (
              <span className={cn("text-xl font-display font-bold", isDark ? "text-white" : "text-gray-900")}>{initials(realName)}</span>
            )}
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
            <Plus className="w-5 h-5 text-white" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setAvatarUrl(URL.createObjectURL(f)); }} />
        </div>
        <div>
          <h1 className={cn("text-3xl md:text-4xl font-display font-bold uppercase tracking-tight", isDark ? "text-white" : "text-gray-900")}>{realName}</h1>
          <p className={cn("mt-1 text-sm", isDark ? "text-slate-400" : "text-gray-500")}>{realPosition || "Atleta"} · acompanhamento individual do atleta</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Activity} label="Carga semanal" value={`${realMon?.weekLoad ?? athlete.monitoring.completedLoad} U.A.`} helper="Semana atual" tone="brand" />
        <StatCard icon={CheckCircle2} label="Sessões" value={`${realMon?.completedCount ?? athlete.monitoring.sessionsCompleted}/${realMon?.totalSessions ?? athlete.monitoring.sessionsPlanned}`} helper="Concluídas esta semana" tone="success" />
        <StatCard icon={HeartPulse} label="Bem-estar" value={`${realMon?.wellbeing ?? athlete.monitoring.wellbeing}%`} helper="Percepção semanal" tone="info" />
        <StatCard icon={AlertTriangle} label="ACWR" value={String(realMon?.acwr ?? athlete.monitoring.acwr)} helper="Razão aguda-crônica" tone={(realMon?.acwr ?? athlete.monitoring.acwr) > 1.3 ? "danger" : "success"} />
      </div>
      <Tabs defaultValue={initialTab} key={initialTab} className="mt-6 space-y-6">
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          {[["overview", "Visão geral"], ["monitoring", "Monitoramento"], ["info", "Informações"], ["planned", "Treinos planejados"], ["completed", "Treinos concluídos"], ["cancelled", "Treinos cancelados"], ["pains", "Histórico de dores"], ["injuries", "Histórico de lesões"], ["reports", "Relatórios"]].map(([value, label]) => <TabsTrigger key={value} value={value} className="px-5 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase border border-white/10 text-slate-400 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:border-primary/50 data-[state=active]:shadow-glow transition-all">{label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <SurfaceCard><CardHeader><CardTitle>Resumo técnico</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><InfoBlock label="Objetivo principal" value={realGoal || "—"} /><InfoBlock label="Preparador responsável" value={realCoach} /><InfoBlock label="Posição" value={realPosition || "—"} /><InfoBlock label="Status de risco" value={athlete.risk} /></CardContent></SurfaceCard>
            <SurfaceCard><CardHeader><CardTitle>Checklist rápido</CardTitle></CardHeader><CardContent className="space-y-4">{checks.map((item) => <KpiLine key={item.label} label={item.label} value={`${item.value}%`} progress={item.value} />)}</CardContent></SurfaceCard>
          </div>
        </TabsContent>
        <TabsContent value="monitoring">
          <MonitoringDashboard athlete={athlete} />
        </TabsContent>
        <TabsContent value="info"><AthleteInfoTab athleteId={athlete.id} name={realName} email={realEmail} phone={realPhone} age={realAge} height={db?.height} weight={db?.weight} position={realPosition} goal={realGoal} phoneCountry={db?.phoneCountry} formatPhone={formatPhone} /></TabsContent>
        <TabsContent value="planned"><PlannedTrainingsTab athleteId={athlete.id} athleteName={realName} /></TabsContent>
        <TabsContent value="completed"><CompletedTrainingsTab athlete={athlete} autoExpand={initialTab === "completed"} onSaveTrainings={handleSaveTrainings} /></TabsContent>
        <TabsContent value="cancelled"><CancelledTrainingsTab athleteId={athlete.id} athleteName={realName} /></TabsContent>
        <TabsContent value="pains"><PainHistoryTab athleteId={athlete.id} /></TabsContent>
        <TabsContent value="injuries"><InjuryHistoryTab athleteId={athlete.id} /></TabsContent>
        <TabsContent value="reports"><SavedReportsTab type="athlete" targetId={athlete.id} targetName={realName} /></TabsContent>
      </Tabs>
    </div>
  );
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.substring(0, 2), 16) || 0, g: parseInt(h.substring(2, 4), 16) || 0, b: parseInt(h.substring(4, 6), 16) || 0 };
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

function ColorPickerModal({ color, onClose, onSave }: { color: string; onClose: () => void; onSave: (c: string) => void }) {
  const { isDark } = useTheme();
  const [hex, setHex] = useState(color);
  const [rgb, setRgb] = useState(hexToRgb(color));
  const [mode, setMode] = useState<"hex" | "rgb">("hex");
  const inputCls = cn("w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors text-center font-mono", isDark ? "border-white/10 bg-[#050505] text-white focus:border-primary/50" : "border-gray-200 bg-gray-50 text-gray-900 focus:border-gray-400");

  function updateFromHex(h: string) {
    setHex(h);
    if (/^#[0-9a-fA-F]{6}$/.test(h)) setRgb(hexToRgb(h));
  }
  function updateFromRgb(r: number, g: number, b: number) {
    setRgb({ r, g, b });
    setHex(rgbToHex(r, g, b));
  }

  const presets = ["#444444", "#669c35", "#0433ff", "#e32400", "#ff6a00", "#624f96", "#f1ae1e", "#9a3c81", "#00BCD4", "#E91E63", "#4CAF50", "#FF9800", "#795548", "#607D8B", "#F44336", "#2196F3"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className={cn("relative w-full max-w-sm rounded-2xl border shadow-2xl p-6", isDark ? "border-white/10 bg-[#0B0F14]" : "border-gray-200 bg-white")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <h3 className={cn("text-lg font-display font-bold", isDark ? "text-white" : "text-gray-900")}>Cor do agendamento</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] transition-colors text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl border border-white/10 shadow-lg" style={{ backgroundColor: hex }} />
          <div>
            <div className={cn("text-sm font-mono font-bold", isDark ? "text-white" : "text-gray-900")}>{hex.toUpperCase()}</div>
            <div className={cn("text-xs font-mono", isDark ? "text-slate-500" : "text-gray-400")}>RGB({rgb.r}, {rgb.g}, {rgb.b})</div>
          </div>
        </div>

        {/* Mode toggle */}
        <div className={cn("flex border rounded-lg overflow-hidden mb-4", isDark ? "border-white/10" : "border-gray-200")}>
          <button onClick={() => setMode("hex")} className={cn("flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors", mode === "hex" ? "bg-primary text-black" : isDark ? "text-slate-400 hover:bg-white/5" : "text-gray-500 hover:bg-gray-100")}>HEX</button>
          <button onClick={() => setMode("rgb")} className={cn("flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors", mode === "rgb" ? "bg-primary text-black" : isDark ? "text-slate-400 hover:bg-white/5" : "text-gray-500 hover:bg-gray-100")}>RGB</button>
        </div>

        {mode === "hex" ? (
          <div className="mb-4">
            <div className={cn("text-[10px] font-mono uppercase tracking-widest mb-1", isDark ? "text-slate-500" : "text-gray-400")}>Hexadecimal</div>
            <input value={hex} onChange={(e) => updateFromHex(e.target.value)} placeholder="#000000" className={inputCls} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(["r", "g", "b"] as const).map((ch) => (
              <div key={ch}>
                <div className={cn("text-[10px] font-mono uppercase tracking-widest mb-1 text-center", isDark ? "text-slate-500" : "text-gray-400")}>{ch.toUpperCase()}</div>
                <input type="number" min={0} max={255} value={rgb[ch]} onChange={(e) => updateFromRgb(ch === "r" ? +e.target.value : rgb.r, ch === "g" ? +e.target.value : rgb.g, ch === "b" ? +e.target.value : rgb.b)} className={inputCls} />
              </div>
            ))}
          </div>
        )}

        {/* Native color picker */}
        <div className="mb-4">
          <div className={cn("text-[10px] font-mono uppercase tracking-widest mb-1", isDark ? "text-slate-500" : "text-gray-400")}>Seletor visual</div>
          <input type="color" value={hex} onChange={(e) => updateFromHex(e.target.value)} className="w-full h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
        </div>

        {/* Presets */}
        <div className="mb-5">
          <div className={cn("text-[10px] font-mono uppercase tracking-widest mb-2", isDark ? "text-slate-500" : "text-gray-400")}>Cores rápidas</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p} onClick={() => updateFromHex(p)} className={cn("w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110", hex.toLowerCase() === p.toLowerCase() ? "border-white scale-110" : "border-transparent")} style={{ backgroundColor: p }} />
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className={cn("flex-1 py-2.5 rounded-xl border text-[11px] font-bold tracking-[0.2em] uppercase transition-colors", isDark ? "border-white/20 text-white hover:bg-white/5" : "border-gray-200 text-gray-700 hover:bg-gray-100")}>Cancelar</button>
          <button onClick={() => onSave(hex)} className="flex-1 py-2.5 rounded-xl bg-primary text-black text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-primary-hover transition-all shadow-glow">Salvar cor</button>
        </div>
      </div>
    </div>
  );
}

function CollaboratorsPage() {
  const { isDark, setCoachColor: setGlobalCoachColor } = useTheme();
  const { canEdit, canDelete, canCreate } = usePermissions();
  const { coaches: dbCoaches, refetchCoaches } = useData();
  const [collaborators, setCollaborators] = useState(collaboratorsMock);
  const [editingColorId, setEditingColorId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "", status: "ativo" as Status });
  const editingCollaborator = collaborators.find((c) => c.id === editingColorId);
  const inputClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary/50 transition-colors";
  const selectClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-3 text-sm text-white outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer";

  // Sync from DB
  useEffect(() => {
    if (dbCoaches.length > 0) {
      setCollaborators(dbCoaches.map(c => ({
        id: c.id, name: c.name, email: c.email, role: c.role,
        status: (c.isEnabled ? "ativo" : "inativo") as Status,
        color: c.color, athletes: c._count?.athletes || 0,
      })));
    }
  }, [dbCoaches]);

  async function saveColor(id: number, color: string) {
    const collab = collaborators.find((c) => c.id === id);
    setCollaborators((prev) => prev.map((c) => c.id === id ? { ...c, color } : c));
    if (collab) setGlobalCoachColor(collab.name, color);
    setEditingColorId(null);
    try { await apiPut(`/api/coaches/${id}`, { color }); refetchCoaches(); } catch {}
  }

  function startEdit(c: Collaborator) {
    setEditForm({ name: c.name, email: c.email, role: c.role, status: c.status });
    setEditingId(c.id);
  }

  async function saveEdit() {
    if (!editingId) return;
    setCollaborators((prev) => prev.map((c) => c.id === editingId ? { ...c, ...editForm } : c));
    setEditingId(null);
    try {
      await apiPut(`/api/coaches/${editingId}`, { name: editForm.name, email: editForm.email, role: editForm.role, isEnabled: editForm.status === "ativo" });
      refetchCoaches();
    } catch {}
  }

  async function deleteCollaborator(id: number) {
    setCollaborators((prev) => prev.filter((c) => c.id !== id));
    setConfirmDeleteId(null);
    try { await apiDelete(`/api/coaches/${id}`); refetchCoaches(); } catch {}
  }

  return (
    <div>
      <SectionHeader title="Colaboradores" description="Cadastro e gestão dos profissionais vinculados ao painel." />

      {/* Edit modal */}
      {editingId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setEditingId(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0B0F14] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-white">Editar colaborador</h2>
              <button onClick={() => setEditingId(null)} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Nome</div>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">E-mail</div>
                <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Função</div>
                  <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className={selectClass}>
                    <option value="Personal Trainer">Personal Trainer</option>
                    <option value="Administrador">Administrador</option>
                    <option value="Preparador Físico">Preparador Físico</option>
                    <option value="Fisioterapeuta">Fisioterapeuta</option>
                    <option value="Nutricionista">Nutricionista</option>
                  </select>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-2">Status</div>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Status })} className={selectClass}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingId(null)} className="flex-1 py-3 rounded-xl border border-white/20 text-white text-sm font-bold uppercase tracking-[0.15em] hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={saveEdit} className="flex-1 py-3 rounded-xl bg-primary text-black text-sm font-bold uppercase tracking-[0.15em] hover:bg-primary-hover transition-all shadow-glow">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#0B0F14] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
              <h3 className="text-lg font-display font-bold text-white">Confirmar exclusão</h3>
            </div>
            <p className="text-sm text-slate-400 mb-2">Tem certeza que deseja excluir <span className="text-white font-semibold">&quot;{collaborators.find((c) => c.id === confirmDeleteId)?.name}&quot;</span>?</p>
            <p className="text-xs text-red-400/70 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={() => deleteCollaborator(confirmDeleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-red-400 transition-all flex items-center justify-center gap-2"><X className="w-3.5 h-3.5" /> Excluir</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {collaborators.map((c) => (
          <SurfaceCard key={c.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border border-white/10"><AvatarFallback className="bg-white/10 text-white">{initials(c.name)}</AvatarFallback></Avatar>
                  <div>
                    <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{c.name}</h3><StatusBadge value={c.status} /></div>
                    <div className="mt-1 text-sm text-slate-500">{c.email}</div>
                    <div className="mt-1 text-sm text-slate-500">{c.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button onClick={() => startEdit(c)} className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors" title="Editar">
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => setConfirmDeleteId(c.id)} className="w-9 h-9 rounded-lg border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors" title="Excluir">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setEditingColorId(c.id)} className="group relative" title="Alterar cor">
                    <div className="h-9 w-9 rounded-lg border border-white/10 transition-transform group-hover:scale-110" style={{ backgroundColor: c.color }} />
                  </button>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <MetricMini label="Atletas" value={String(c.athletes)} />
                <MetricMini label="Status" value={c.status} />
                <MetricMini label="Cor" value={c.color} />
              </div>
            </CardContent>
          </SurfaceCard>
        ))}
      </div>
      {editingCollaborator && <ColorPickerModal color={editingCollaborator.color} onClose={() => setEditingColorId(null)} onSave={(color) => saveColor(editingCollaborator.id, color)} />}
    </div>
  );
}

/* ─── Physical Alerts Page ─── */
function PhysicalAlertsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  const { data: alertData, loading } = useApi<any>(`/api/alerts?period=${period}`);
  const { athletes: cachedAthletes } = useData();

  const periodLabels = { week: "Esta semana", month: "Últimos 30 dias", all: "Todos" };

  return (
    <div>
      <SectionHeader title="Alertas Físicos" description="Monitoramento de dores e lesões dos atletas." />

      {/* Period filter */}
      <div className="flex gap-2 mb-6">
        {(["week", "month", "all"] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={cn("px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] rounded-lg transition-all", period === p ? "bg-primary text-black shadow-glow" : "border border-white/10 text-slate-400 hover:bg-white/5")}>
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard icon={CircleAlert} label="Total de alertas" value={String(alertData?.total || 0)} helper={`${alertData?.painCount || 0} dores · ${alertData?.injuryCount || 0} lesões`} tone="warning" />
        <StatCard icon={HeartPulse} label="Atletas afetados" value={String(alertData?.ranking?.length || 0)} helper="Com dores ou lesões" tone="danger" />
        <StatCard icon={Activity} label="Região mais afetada" value={alertData?.areas?.[0]?.area || "—"} helper={alertData?.areas?.[0] ? `${alertData.areas[0].count} ocorrências` : ""} tone="info" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Ranking de atletas */}
        <SurfaceCard>
          <CardHeader>
            <CardTitle>Ranking de atletas</CardTitle>
            <CardDescription className="text-slate-500">Quem mais reportou dores e lesões</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertData?.ranking?.length > 0 ? alertData.ranking.map((a: any, i: number) => (
              <div key={a.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold", i === 0 ? "bg-red-500/20 text-red-400" : i < 3 ? "bg-amber-500/20 text-amber-400" : "bg-white/10 text-slate-400")}>{i + 1}</div>
                  <div>
                    <div className="text-sm font-medium text-white">{a.name}</div>
                    <div className="text-[10px] text-slate-500">{a.pains} dores · {a.injuries} lesões</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-display font-bold text-primary">{a.total}</span>
                  <span className="text-[10px] text-slate-500">alertas</span>
                </div>
              </div>
            )) : <div className="text-sm text-slate-600 text-center py-4">{loading ? "Carregando..." : "Nenhum alerta no período"}</div>}
          </CardContent>
        </SurfaceCard>

        {/* Regiões mais afetadas */}
        <div className="space-y-6">
          <SurfaceCard>
            <CardHeader>
              <CardTitle>Regiões do corpo</CardTitle>
              <CardDescription className="text-slate-500">Áreas mais reportadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertData?.areas?.length > 0 ? alertData.areas.slice(0, 10).map((a: any) => (
                <div key={a.area} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5">
                  <span className="text-sm text-white">{a.area}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${(a.count / (alertData.areas[0]?.count || 1)) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-amber-400 w-6 text-right">{a.count}</span>
                  </div>
                </div>
              )) : <div className="text-sm text-slate-600 text-center py-4">Sem dados</div>}
            </CardContent>
          </SurfaceCard>
        </div>
      </div>

      {/* Lista completa */}
      <SurfaceCard className="mt-6">
        <CardHeader>
          <CardTitle>Histórico completo</CardTitle>
          <CardDescription className="text-slate-500">{alertData?.total || 0} registros</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left">
                {["Atleta", "Tipo", "Detalhe", "Data"].map(h => <th key={h} className="px-4 py-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {alertData?.athletes?.slice(0, 50).map((a: any, i: number) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white font-medium">{a.name}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", a.type === "dor" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400")}>{a.type}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{a.detail}</td>
                  <td className="px-4 py-3 text-slate-500">{a.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </SurfaceCard>
    </div>
  );
}

function TrainingTypesPage() {
  const { canCreate, canDelete } = usePermissions();
  const { trainingTypes: dbTypes, refetchTypes } = useData();
  const [types, setTypes] = useState(trainingTypesMock);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Geral");
  const [newStatus, setNewStatus] = useState<"ativo" | "inativo">("ativo");
  const inputClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-primary/50 transition-colors";
  const selectClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-3 text-sm text-white outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer";

  // Sync from DB
  useEffect(() => {
    if (dbTypes.length > 0) {
      setTypes(dbTypes.map(t => ({ id: t.id, name: t.name, category: t.category, status: (t.isEnabled ? "ativo" : "inativo") as Status, isDefault: t.isDefault })));
    }
  }, [dbTypes]);

  async function addType() {
    if (!newName.trim()) return;
    try {
      await apiPost("/api/training-types", { name: newName.trim(), category: newCategory, isEnabled: newStatus === "ativo" });
      refetchTypes();
    } catch {}
    setNewName("");
    setNewCategory("Geral");
    setNewStatus("ativo");
    setShowAdd(false);
  }

  async function deleteType(id: number) {
    try {
      await apiDelete(`/api/training-types/${id}`);
      setTypes((prev) => prev.filter((t) => t.id !== id));
      refetchTypes();
    } catch {}
    setConfirmDeleteId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <SectionHeader title="Tipos de treino" description="Biblioteca base para organização dos tipos de sessão." />
        {canCreate && <button type="button" onClick={() => setShowAdd(!showAdd)} className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.15em] transition-all", showAdd ? "border border-red-500/30 text-red-400 hover:bg-red-500/10" : "bg-primary text-black hover:bg-primary-hover shadow-glow")}>
          {showAdd ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo tipo</>}
        </button>}
      </div>

      {showAdd && (
        <SurfaceCard className="mb-6">
          <CardContent className="p-5">
            <h4 className="text-sm font-display font-bold uppercase tracking-wider text-white mb-4">Adicionar tipo de treino</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Nome</div>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do tipo de treino..." className={inputClass} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Categoria</div>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={selectClass}>
                  <option value="Geral">Geral</option>
                  <option value="Força">Força</option>
                  <option value="Cardio">Cardio</option>
                  <option value="Flexibilidade">Flexibilidade</option>
                  <option value="Reabilitação">Reabilitação</option>
                </select>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Status</div>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as "ativo" | "inativo")} className={selectClass}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            <button type="button" onClick={addType} disabled={!newName.trim()} className="mt-4 flex items-center gap-2 bg-primary px-5 py-2.5 rounded-xl text-[11px] font-bold tracking-[0.2em] text-black uppercase hover:bg-primary-hover transition-all shadow-glow disabled:opacity-30 disabled:cursor-not-allowed">
              <CheckCircle2 className="w-4 h-4" /> Adicionar
            </button>
          </CardContent>
        </SurfaceCard>
      )}

      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#0B0F14] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
              <h3 className="text-lg font-display font-bold text-white">Confirmar exclusão</h3>
            </div>
            <p className="text-sm text-slate-400 mb-2">Tem certeza que deseja excluir o tipo de treino <span className="text-white font-semibold">&quot;{types.find((t) => t.id === confirmDeleteId)?.name}&quot;</span>?</p>
            <p className="text-xs text-red-400/70 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={() => deleteType(confirmDeleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-red-400 transition-all flex items-center justify-center gap-2"><X className="w-3.5 h-3.5" /> Excluir</button>
            </div>
          </div>
        </div>
      )}

      <SurfaceCard>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left">
                {["Tipo do treino", "Categoria", "Status", "Padrão", ""].map((h, i) => <th key={i} className="px-5 py-4 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-b border-white/5 group hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-200">{t.name}</td>
                  <td className="px-5 py-4 text-slate-400">{t.category}</td>
                  <td className="px-5 py-4"><StatusBadge value={t.status} /></td>
                  <td className="px-5 py-4 text-slate-300">{t.isDefault ? "Sim" : "Não"}</td>
                  <td className="px-5 py-4 text-right">
                    {canDelete && <button type="button" onClick={() => setConfirmDeleteId(t.id)} className="w-8 h-8 rounded-full border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100" title="Excluir tipo">
                      <X className="w-3.5 h-3.5" />
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </SurfaceCard>
    </div>
  );
}

/* ─── Saved Reports Tab ─── */
function SavedReportsTab({ type, targetId, targetName }: { type: "athlete" | "coach"; targetId: number; targetName: string }) {
  const { canDelete } = usePermissions();
  const { data: reports, refetch } = useApi<Array<{ id: number; targetName: string; periodStart: string; periodEnd: string; createdAt: string }>>(`/api/reports/saved?type=${type}&targetId=${targetId}`);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [viewData, setViewData] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  async function viewReport(id: number) {
    try {
      const res = await fetch(`/api/reports/saved/${id}`);
      if (res.ok) { const d = await res.json(); setViewData(d.data); setViewingId(id); }
    } catch {}
  }

  async function deleteReport(id: number) {
    try { await apiDelete(`/api/reports/saved/${id}`); refetch(); } catch {}
    setConfirmDeleteId(null);
  }

  return (
    <div className="space-y-4">
      <SurfaceCard>
        <CardHeader>
          <CardTitle>Relatórios salvos</CardTitle>
          <CardDescription className="text-slate-500">Relatórios gerados anteriormente para {targetName}</CardDescription>
        </CardHeader>
        <CardContent>
          {!reports || reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-600">Nenhum relatório salvo</div>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors">
                  <button onClick={() => viewReport(r.id)} className="flex-1 text-left">
                    <div className="text-sm font-medium text-white">{new Date(r.periodStart).toLocaleDateString("pt-BR")} — {new Date(r.periodEnd).toLocaleDateString("pt-BR")}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Criado em {new Date(r.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => viewReport(r.id)} className="px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Ver</button>
                    {canDelete && <button onClick={() => setConfirmDeleteId(r.id)} className="w-7 h-7 rounded-full border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"><X className="w-3 h-3" /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </SurfaceCard>

      {/* View saved report modal */}
      {viewingId && viewData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => { setViewingId(null); setViewData(null); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0B0F14] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-bold text-white">Relatório salvo</h3>
              <button onClick={() => { setViewingId(null); setViewData(null); }} className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.02] flex items-center justify-center text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            {type === "athlete" ? <AthleteReport data={viewData} /> : <CoachReport data={viewData} />}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#0B0F14] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
              <h3 className="text-lg font-display font-bold text-white">Excluir relatório</h3>
            </div>
            <p className="text-sm text-slate-400 mb-6">Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={() => deleteReport(confirmDeleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-red-400 transition-all flex items-center justify-center gap-2"><X className="w-3.5 h-3.5" /> Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Reports Page ─── */
function ReportsPage() {
  const { athletes: dbAthletes, coaches: dbCoaches } = useData();
  const [reportType, setReportType] = useState<"athlete" | "coach">("athlete");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  async function downloadPDF() {
    if (!reportRef.current || !report) return;
    setSavingPdf(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");
      const element = reportRef.current;
      const canvas = await html2canvas(element, { backgroundColor: "#0B0F14", scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const imgW = canvas.width;
      const imgH = canvas.height;
      const pdfW = 210; // A4 width in mm
      const pdfH = (imgH * pdfW) / imgW;
      const pdf = new jsPDF("p", "mm", [pdfW, pdfH]);
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      const name = reportType === "athlete" ? report.athlete?.name : report.coach?.name;
      pdf.save(`relatorio-${name?.replace(/\s+/g, "-").toLowerCase()}-${startDate}-${endDate}.pdf`);
    } catch (e) { console.error(e); }
    setSavingPdf(false);
  }

  async function saveReport() {
    if (!report || !selectedId) return;
    setSaving(true);
    try {
      const name = reportType === "athlete" ? report.athlete?.name : report.coach?.name;
      await apiPost("/api/reports/saved", {
        type: reportType, targetId: selectedId, targetName: name || "—",
        periodStart: startDate, periodEnd: endDate, data: report,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  }

  const options = reportType === "athlete"
    ? dbAthletes.filter(a => a.isEnabled).map(a => ({ id: a.id, name: a.name }))
    : dbCoaches.filter(c => c.isEnabled).map(c => ({ id: c.id, name: c.name }));

  async function generateReport() {
    if (!selectedId) return;
    setLoading(true);
    try {
      const url = reportType === "athlete"
        ? `/api/reports/athlete/${selectedId}?start=${startDate}&end=${endDate}`
        : `/api/reports/coach/${selectedId}?start=${startDate}&end=${endDate}`;
      const res = await fetch(url);
      if (res.ok) setReport(await res.json());
    } catch {}
    setLoading(false);
  }

  const inputClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white outline-none focus:border-primary/50 transition-colors [color-scheme:dark]";
  const selectClass = "w-full rounded-lg border border-white/10 bg-[#050505] px-3 py-3 text-sm text-white outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer";

  return (
    <div>
      <SectionHeader title="Relatórios" description="Gere relatórios detalhados de atletas e personais." />

      {/* Filters */}
      <SurfaceCard className="mb-6">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Tipo</div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setReportType("athlete"); setSelectedId(null); setReport(null); }} className={cn("flex-1 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all", reportType === "athlete" ? "border-primary bg-primary/20 text-primary" : "border-white/10 text-slate-400 hover:border-white/20")}>Atleta</button>
                <button type="button" onClick={() => { setReportType("coach"); setSelectedId(null); setReport(null); }} className={cn("flex-1 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all", reportType === "coach" ? "border-primary bg-primary/20 text-primary" : "border-white/10 text-slate-400 hover:border-white/20")}>Personal</button>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{reportType === "athlete" ? "Atleta" : "Personal"}</div>
              <select value={selectedId || ""} onChange={(e) => setSelectedId(Number(e.target.value))} className={selectClass}>
                <option value="" disabled>Selecione...</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Data início</div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Data fim</div>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
            </div>
            <button type="button" onClick={generateReport} disabled={!selectedId || loading} className="py-3 rounded-xl bg-primary text-black text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-primary-hover transition-all shadow-glow disabled:opacity-30 disabled:cursor-not-allowed">
              {loading ? "Gerando..." : "Gerar relatório"}
            </button>
          </div>
        </CardContent>
      </SurfaceCard>

      {/* Action buttons */}
      {report && (
        <div className="flex gap-3 mb-6">
          <button type="button" onClick={downloadPDF} disabled={savingPdf} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-white text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-white/5 transition-colors disabled:opacity-50">
            <ArrowDown className="w-4 h-4" /> {savingPdf ? "Gerando PDF..." : "Baixar PDF"}
          </button>
          <button type="button" onClick={saveReport} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-[11px] font-bold uppercase tracking-[0.15em] hover:bg-primary-hover transition-all shadow-glow disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4" /> {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar relatório"}
          </button>
        </div>
      )}

      {/* Report content */}
      <div ref={reportRef}>
        {report && reportType === "athlete" && <AthleteReport data={report} />}
        {report && reportType === "coach" && <CoachReport data={report} />}
      </div>
    </div>
  );
}

function AthleteReport({ data }: { data: any }) {
  const s = data.summary;
  return (
    <div className="space-y-6">
      {/* Header */}
      <SurfaceCard>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-display font-bold text-white">{data.athlete.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{data.athlete.position || "Atleta"} · Coach: {data.athlete.coach || "—"} · {data.period.start} até {data.period.end}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-display font-bold text-primary">{s.completionRate}%</div>
              <div className="text-[10px] font-mono uppercase text-slate-500">Taxa de conclusão</div>
            </div>
          </div>
        </CardContent>
      </SurfaceCard>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Treinos realizados" value={`${s.totalCompleted}/${s.totalSessions}`} helper={`${s.totalPending} pendentes · ${s.totalCancelled} cancelados`} tone="brand" />
        <StatCard icon={Clock} label="Tempo total" value={`${s.totalHours}h`} helper={`${s.totalMinutes} minutos`} tone="success" />
        <StatCard icon={Activity} label="Carga total" value={`${s.totalLoad} U.A.`} helper={`PSE médio: ${s.avgPse}`} tone="info" />
        <StatCard icon={HeartPulse} label="Bem-estar registrado" value={`${data.wellbeingSummary.total}`} helper="Formulários preenchidos" tone="info" />
      </div>

      {/* Type breakdown + Weekly load */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <CardHeader><CardTitle>Tipos de treino</CardTitle><CardDescription className="text-slate-500">Distribuição por modalidade</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(data.typeBreakdown).sort((a: any, b: any) => b[1] - a[1]).map(([name, count]: any) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-white font-medium">{name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(count / s.totalCompleted) * 100}%` }} /></div>
                  <span className="text-sm font-bold text-primary w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(data.typeBreakdown).length === 0 && <div className="text-sm text-slate-600 text-center py-4">Sem dados no período</div>}
          </CardContent>
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader><CardTitle>Carga semanal</CardTitle><CardDescription className="text-slate-500">Evolução de carga por semana</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.weeklyData).map(([week, d]: any) => (
                <div key={week} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                  <span className="text-xs font-mono text-slate-400">{week}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">{d.sessions} treinos</span>
                    <span className="text-sm font-bold text-primary">{d.load} U.A.</span>
                  </div>
                </div>
              ))}
              {Object.keys(data.weeklyData).length === 0 && <div className="text-sm text-slate-600 text-center py-4">Sem dados no período</div>}
            </div>
          </CardContent>
        </SurfaceCard>
      </div>

      {/* Wellbeing summary */}
      {data.wellbeingSummary.total > 0 && (
        <SurfaceCard>
          <CardHeader><CardTitle>Resumo de Bem-Estar</CardTitle><CardDescription className="text-slate-500">{data.wellbeingSummary.total} avaliações no período</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Sono", data: data.wellbeingSummary.sleepQuality },
                { label: "Energia", data: data.wellbeingSummary.energy },
                { label: "Stress", data: data.wellbeingSummary.stress },
                { label: "Humor", data: data.wellbeingSummary.mood },
                { label: "Fadiga", data: data.wellbeingSummary.fatigue },
                { label: "Dor", data: data.wellbeingSummary.pain },
                { label: "Alimentação", data: data.wellbeingSummary.nutrition },
                { label: "Motivação", data: data.wellbeingSummary.motivation },
              ].map(({ label, data: d }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">{label}</div>
                  {Object.entries(d).length > 0 ? Object.entries(d).map(([val, count]: any) => (
                    <div key={val} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-400">{val}</span>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                  )) : <div className="text-[10px] text-slate-600">—</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </SurfaceCard>
      )}

      {/* Pains & Injuries */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <CardHeader><CardTitle>Dores reportadas</CardTitle><CardDescription className="text-slate-500">{data.pains.total} registros no período</CardDescription></CardHeader>
          <CardContent>
            {Object.entries(data.pains.byArea).length > 0 ? Object.entries(data.pains.byArea).sort((a: any, b: any) => b[1] - a[1]).map(([area, count]: any) => (
              <div key={area} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 mb-2">
                <span className="text-sm text-amber-400">{area}</span>
                <span className="text-sm font-bold text-amber-400">{count}x</span>
              </div>
            )) : <div className="text-sm text-slate-600 text-center py-4">Nenhuma dor registrada</div>}
          </CardContent>
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader><CardTitle>Lesões reportadas</CardTitle><CardDescription className="text-slate-500">{data.injuries.total} registros no período</CardDescription></CardHeader>
          <CardContent>
            {Object.entries(data.injuries.byType).length > 0 ? Object.entries(data.injuries.byType).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]: any) => (
              <div key={type} className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 mb-2">
                <span className="text-sm text-red-400">{type}</span>
                <span className="text-sm font-bold text-red-400">{count}x</span>
              </div>
            )) : <div className="text-sm text-slate-600 text-center py-4">Nenhuma lesão registrada</div>}
          </CardContent>
        </SurfaceCard>
      </div>

      {/* Session list */}
      <SurfaceCard>
        <CardHeader><CardTitle>Histórico de sessões</CardTitle><CardDescription className="text-slate-500">{data.sessions.length} sessões no período</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left">
                {["Data", "Horário", "Tipo", "Personal", "Status", "PSE", "Duração"].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s: any) => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-300">{new Date(s.date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-slate-400">{s.startTime} - {s.endTime}</td>
                  <td className="px-4 py-3 text-white font-medium">{s.type}</td>
                  <td className="px-4 py-3 text-slate-400">{s.coach}</td>
                  <td className="px-4 py-3"><StatusBadge value={s.status === "Concluído" ? "ativo" : s.status === "Cancelado" ? "inativo" : "ativo"} /></td>
                  <td className="px-4 py-3 text-primary font-bold">{s.pse}</td>
                  <td className="px-4 py-3 text-slate-400">{s.duration || 50} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </SurfaceCard>
    </div>
  );
}

function CoachReport({ data }: { data: any }) {
  const s = data.summary;
  return (
    <div className="space-y-6">
      {/* Header */}
      <SurfaceCard>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-display font-bold text-white">{data.coach.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{data.coach.role} · {data.period.start} até {data.period.end}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-display font-bold text-primary">{s.completionRate}%</div>
              <div className="text-[10px] font-mono uppercase text-slate-500">Taxa de conclusão</div>
            </div>
          </div>
        </CardContent>
      </SurfaceCard>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Treinos realizados" value={`${s.totalCompleted}/${s.totalSessions}`} helper={`${s.totalPending} pendentes`} tone="brand" />
        <StatCard icon={Clock} label="Horas trabalhadas" value={`${s.totalHours}h`} helper={`${s.totalMinutes} minutos`} tone="success" />
        <StatCard icon={Users} label="Atletas atendidos" value={String(s.uniqueAthletes)} helper="Atletas únicos" tone="info" />
        <StatCard icon={Activity} label="Média diária" value={`${s.totalCompleted > 0 ? (s.totalMinutes / s.totalCompleted).toFixed(0) : 0} min`} helper="Por sessão" tone="info" />
      </div>

      {/* Athletes + Types */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <CardHeader><CardTitle>Atletas atendidos</CardTitle><CardDescription className="text-slate-500">{s.uniqueAthletes} atletas no período</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {data.athletes.map((a: any) => (
              <div key={a.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-white font-medium">{a.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">{a.sessions} treinos</span>
                  <span className="text-xs text-slate-500">{Math.round(a.minutes / 60 * 10) / 10}h</span>
                </div>
              </div>
            ))}
            {data.athletes.length === 0 && <div className="text-sm text-slate-600 text-center py-4">Sem dados no período</div>}
          </CardContent>
        </SurfaceCard>

        <SurfaceCard>
          <CardHeader><CardTitle>Tipos de treino</CardTitle><CardDescription className="text-slate-500">Distribuição por modalidade</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(data.typeBreakdown).sort((a: any, b: any) => b[1] - a[1]).map(([name, count]: any) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-white font-medium">{name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(count / s.totalCompleted) * 100}%` }} /></div>
                  <span className="text-sm font-bold text-primary w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(data.typeBreakdown).length === 0 && <div className="text-sm text-slate-600 text-center py-4">Sem dados no período</div>}
          </CardContent>
        </SurfaceCard>
      </div>

      {/* Weekly breakdown */}
      <SurfaceCard>
        <CardHeader><CardTitle>Resumo semanal</CardTitle><CardDescription className="text-slate-500">Produtividade por semana</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[500px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left">
                {["Semana", "Sessões", "Horas", "Atletas"].map((h) => <th key={h} className="px-4 py-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.weeklyData).map(([week, d]: any) => (
                <tr key={week} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{week}</td>
                  <td className="px-4 py-3 text-white font-bold">{d.sessions}</td>
                  <td className="px-4 py-3 text-primary font-bold">{Math.round(d.minutes / 60 * 10) / 10}h</td>
                  <td className="px-4 py-3 text-slate-400">{d.athletes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </SurfaceCard>
    </div>
  );
}

function DesignSystemPage() {
  const checks = [
    `Slots gerados: ${timeSlots.length}`,
    `Primeiro slot: ${timeSlots[0]}`,
    `Último slot: ${timeSlots[timeSlots.length - 1]}`,
    `Sessões mockadas: ${agendaSessionsMock.length}`,
    `Teste de borda: ${generateTimeSlots("04:40", "05:30", 50).join(" | ")}`,
  ];
  return (
    <div>
      <SectionHeader title="Design System" description="Esqueleto visual simples para acelerar edição futura do projeto." />
      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <CardHeader><CardTitle>Paleta principal</CardTitle><CardDescription className="text-slate-500">Cores absorvidas do sistema atual.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Object.entries(palette).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="h-16 rounded-xl border border-white/10" style={{ background: value }} />
                <div className="mt-3 text-sm font-semibold capitalize">{key}</div>
                <div className="text-xs text-slate-500">{value}</div>
              </div>
            ))}
          </CardContent>
        </SurfaceCard>
        <SurfaceCard>
          <CardHeader><CardTitle>Checks básicos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"><Switch defaultChecked={true} /><span className="text-sm text-slate-300">Exibir treinos planejados</span></div>
            {checks.map((line) => <div key={line} className="text-sm text-slate-400">{line}</div>)}
          </CardContent>
        </SurfaceCard>
      </div>
    </div>
  );
}

export default function TeamZQDesignSystemSkeleton({ authUser }: { authUser?: { id: string; email: string; name: string; role: string; avatarUrl: string | null } | null }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(() => {
    if (authUser) {
      return { id: Number(authUser.id) || 1, name: authUser.name, email: authUser.email, role: (authUser.role === "admin" ? "admin" : "personal") as UserRole, avatarUrl: authUser.avatarUrl };
    }
    return { id: 1, name: "Admin", email: "admin@brainston.com", role: "admin", avatarUrl: null };
  });
  const permissions = resolvePermissions(currentUser.role, currentUser.email);

  const { athletes: dbAthletes, coaches: dbCoaches, trainingTypes: dbTypes, sessions: dbSessions, loading: dbLoading, refetchAthletes, refetchCoaches, refetchTypes, refetchSessions } = useData();

  // Convert DB data to component types, fallback to mock if DB is empty
  const athletesData: Athlete[] = useMemo(() => {
    if (dbAthletes.length === 0) return athletesMock;
    return dbAthletes.map((a, idx) => ({
      id: a.id, name: a.name, email: a.email, age: a.age || 25,
      position: a.position || "—",
      status: (a.isEnabled ? "ativo" : "inativo") as Status,
      risk: (["ok", "atenção", "alto"][idx % 3]) as Risk,
      nextTraining: "—", coach: a.coach?.name || "—",
      objective: a.goal || "—", phone: a.phone || "—",
      city: a.city || "—", state: a.state || "—", country: a.country || "Brasil",
      weight: a.weight || "—", height: a.height || "—",
      monitoring: generateDefaultMonitoring(a.id),
      plannedTrainings: [], completedTrainings: [], pains: [], injuries: [],
    }));
  }, [dbAthletes]);

  const collaboratorsData: Collaborator[] = useMemo(() => {
    if (dbCoaches.length === 0) return collaboratorsMock;
    return dbCoaches.map((c) => ({
      id: c.id, name: c.name, email: c.email, role: c.role,
      status: (c.isEnabled ? "ativo" : "inativo") as Status,
      color: c.color, athletes: c._count?.athletes || 0,
    }));
  }, [dbCoaches]);

  const typesData: TrainingType[] = useMemo(() => {
    if (dbTypes.length === 0) return trainingTypesMock;
    return dbTypes.map((t) => ({
      id: t.id, name: t.name, category: t.category,
      status: (t.isEnabled ? "ativo" : "inativo") as Status,
      isDefault: t.isDefault,
    }));
  }, [dbTypes]);

  // Convert DB sessions to AgendaSession format
  const dbAgendaSessions: AgendaSession[] = useMemo(() => {
    return dbSessions.map((s) => ({
      id: s.id,
      day: getDayKey(new Date(s.date)),
      time: s.startTime,
      endTime: s.endTime,
      athlete: s.athlete.name,
      type: s.trainingType.name,
      coach: s.coach.name,
      status: (s.status === "Concluído" ? "Concluído" : s.status === "Em andamento" ? "Em andamento" : s.status === "Confirmado" ? "Confirmado" : s.status === "Cancelado" ? "Cancelado" : "Pendente") as SessionStatus,
      location: s.location,
      intensity: (s.psePlanned >= 5 ? "Alta" : s.psePlanned >= 3 ? "Média" : "Baixa") as Intensity,
      pse: s.psePlanned,
    }));
  }, [dbSessions]);

  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard");
  const [currentAthlete, setCurrentAthlete] = useState<Athlete>(athletesData[0] || athletesMock[0]);
  const [athleteInitialTab, setAthleteInitialTab] = useState("overview");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [coachColors, setCoachColors] = useState<Record<string, string>>({ ...defaultCoachColors });
  function setCoachColor(name: string, color: string) {
    setCoachColors((prev) => ({ ...prev, [name]: color }));
  }

  useEffect(() => {
    if (theme === "light") {
      document.body.style.backgroundColor = "#F5F5F0";
      document.body.style.backgroundImage = "none";
      document.body.style.color = "#1a1a1a";
    } else {
      document.body.style.backgroundColor = "#0B0F14";
      document.body.style.backgroundImage = "radial-gradient(circle at top center, rgba(245, 245, 244, 0.06), transparent 30%), linear-gradient(180deg, #141414 0%, #0B0F14 34%, #050505 100%)";
      document.body.style.color = "#f5f5f4";
    }
  }, [theme]);

  const [extraCompleted, setExtraCompleted] = useState<Record<string, Athlete["completedTrainings"]>>({});

  function openAthleteWithTab(athlete: Athlete, tab?: string, newTraining?: Athlete["completedTrainings"][0]) {
    if (newTraining) {
      setExtraCompleted((prev) => {
        const updated = { ...prev, [athlete.name]: [newTraining, ...(prev[athlete.name] || [])] };
        const allExtra = updated[athlete.name] || [];
        const merged = { ...athlete, completedTrainings: [...allExtra, ...athlete.completedTrainings] };
        setCurrentAthlete(merged);
        return updated;
      });
    } else {
      const extra = extraCompleted[athlete.name] || [];
      const merged = extra.length > 0
        ? { ...athlete, completedTrainings: [...extra, ...athlete.completedTrainings] }
        : athlete;
      setCurrentAthlete(merged);
    }
    setAthleteInitialTab(tab || "overview");
    setCurrentPage("athlete-detail");
  }

  return (
    <PermissionsContext.Provider value={{ user: currentUser, setUser: setCurrentUser, ...permissions }}>
      <ThemeContext.Provider value={{ isDark: theme === "dark", coachColors, setCoachColor }}>
        <AppShell currentPage={currentPage} setCurrentPage={setCurrentPage} theme={theme} toggleTheme={() => setTheme((t) => t === "dark" ? "light" : "dark")}>
          {currentPage === "dashboard" && <DashboardPage openAthlete={(a) => openAthleteWithTab(a)} goAgenda={() => setCurrentPage("agenda")} />}
          {currentPage === "agenda" && <AgendaPage openAthlete={(a, tab, newTraining) => openAthleteWithTab(a, tab, newTraining)} goToCollaborators={() => setCurrentPage("collaborators")} />}
          {currentPage === "athletes" && <AthletesPage openAthlete={(a) => openAthleteWithTab(a)} />}
          {currentPage === "athlete-detail" && <AthleteDetailPage athlete={currentAthlete} initialTab={athleteInitialTab} />}
          {currentPage === "collaborators" && <CollaboratorsPage />}
          {currentPage === "physical-alerts" && <PhysicalAlertsPage />}
          {currentPage === "training-types" && <TrainingTypesPage />}
          {currentPage === "reports" && <ReportsPage />}
          {currentPage === "design-system" && <DesignSystemPage />}
        </AppShell>
      </ThemeContext.Provider>
    </PermissionsContext.Provider>
  );
}
