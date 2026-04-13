"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos"
        : error.message
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F14] px-4"
      style={{ backgroundImage: "radial-gradient(circle at top center, rgba(245, 245, 244, 0.06), transparent 30%), linear-gradient(180deg, #141414 0%, #0B0F14 34%, #050505 100%)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-sm bg-primary shadow-[0_0_15px_rgba(250,204,21,0.4)]" />
            <h1 className="text-2xl font-display font-black tracking-tight text-white uppercase">
              brain<span className="text-primary">ston</span>
            </h1>
          </div>
          <p className="text-sm text-slate-500">Acesse sua conta para continuar</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur p-8 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white mb-2 block">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-white mb-2 block">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-lg border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-primary text-black text-sm font-bold uppercase tracking-[0.2em] hover:bg-[hsl(47,100%,55%)] transition-all shadow-[0_0_25px_rgba(250,204,21,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-8">
          brainston &copy; {new Date().getFullYear()} · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
