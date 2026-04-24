import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { AppProvider } from "@/components/app-provider";
import { listPlayers } from "@/lib/db/players";
import { getActiveSession, listUserStakes } from "@/lib/db/sessions";
import { listAllDistinctTags } from "@/lib/db/player-tags";
import type { UserProfile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profileRow }, players, activeSession, allTags, userStakes] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, email, name, role, wpt_nicks, avatar_url")
        .eq("id", user.id)
        .single(),
      listPlayers(supabase),
      getActiveSession(supabase, user.id),
      listAllDistinctTags(supabase),
      listUserStakes(supabase, user.id),
    ]);

  const profile: UserProfile = profileRow ?? {
    id: user.id,
    email: user.email ?? "",
    name: user.email?.split("@")[0] ?? "",
    role: "player",
    wpt_nicks: [],
    avatar_url: null,
  };

  return (
    <AppProvider profile={profile} initialPlayers={players} initialActiveSession={activeSession}>
      <AppNav userName={profile.name} allTags={allTags} userStakes={userStakes} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</div>
    </AppProvider>
  );
}
