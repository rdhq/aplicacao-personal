"use client";
import { createContext, useContext } from "react";

export type UserRole = "admin" | "personal";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
};

export type PermissionsContextType = {
  user: CurrentUser;
  setUser: (u: CurrentUser) => void;
  isAdmin: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageSettings: boolean;
  canManageCoaches: boolean;
  canManageAthletes: boolean;
  canManageTrainingTypes: boolean;
  canCompleteTraining: boolean;
};

export const PermissionsContext = createContext<PermissionsContextType>({
  user: { id: 1, name: "Admin", email: "admin@brainston.com", role: "admin", avatarUrl: null },
  setUser: () => {},
  isAdmin: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canManageSettings: true,
  canManageCoaches: true,
  canManageAthletes: true,
  canManageTrainingTypes: true,
  canCompleteTraining: true,
});

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function resolvePermissions(role: UserRole, email?: string): Omit<PermissionsContextType, "user" | "setUser"> {
  if (role === "admin") {
    return {
      isAdmin: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManageSettings: true,
      canManageCoaches: true,
      canManageAthletes: true,
      canManageTrainingTypes: true,
      canCompleteTraining: true,
    };
  }

  // Pepo has special permissions to create/edit athletes
  const isPepo = email?.toLowerCase() === "schmittfelipe5@gmail.com";

  // personal = can view, edit sessions/forms, complete/cancel trainings, but not create/delete entities
  return {
    isAdmin: false,
    canCreate: isPepo,
    canEdit: true,
    canDelete: false,
    canManageSettings: false,
    canManageCoaches: false,
    canManageAthletes: isPepo,
    canManageTrainingTypes: false,
    canCompleteTraining: true,
  };
}
