"use client";

import { useEffect, useState } from "react";
import TeamZQDesignSystemSkeleton from "@/components/TeamZQDesignSystemSkeleton";
import { DataProvider } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const [authUser, setAuthUser] = useState<{ id: string; email: string; name: string; role: string; avatarUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/profile");
        if (res.ok) {
          const profile = await res.json();
          setAuthUser({
            id: user.id,
            email: user.email || "",
            name: profile.name || user.email?.split("@")[0] || "Usuário",
            role: profile.role || "personal",
            avatarUrl: profile.avatar_url || null,
          });
        } else {
          setAuthUser({
            id: user.id,
            email: user.email || "",
            name: user.email?.split("@")[0] || "Usuário",
            role: "personal",
            avatarUrl: null,
          });
        }
      } catch {
        setAuthUser({
          id: user.id,
          email: user.email || "",
          name: user.email?.split("@")[0] || "Usuário",
          role: "personal",
          avatarUrl: null,
        });
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F14]"
        style={{ backgroundImage: "radial-gradient(circle at top center, rgba(245, 245, 244, 0.06), transparent 30%), linear-gradient(180deg, #141414 0%, #0B0F14 34%, #050505 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-sm bg-primary shadow-[0_0_15px_rgba(250,204,21,0.4)] animate-pulse" />
          <span className="text-lg font-display font-bold text-white uppercase tracking-tight">
            #Team<span className="text-primary">ZQ</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <DataProvider>
      <TeamZQDesignSystemSkeleton authUser={authUser} />
    </DataProvider>
  );
}
