import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Fetch profile from profiles table
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    // Profile doesn't exist yet — create default one
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        name: user.user_metadata?.name || user.email?.split("@")[0] || "Usuário",
        email: user.email,
        role: "personal",
      })
      .select()
      .single();

    return NextResponse.json(newProfile || {
      id: user.id,
      name: user.email?.split("@")[0] || "Usuário",
      email: user.email,
      role: "personal",
      avatar_url: null,
    });
  }

  return NextResponse.json(profile);
}
