"use client";

import { useEffect } from "react";
import { useNicksStore } from "@/lib/store/nicks";
import { useSessionStore } from "@/lib/store/session";
import { useUserStore } from "@/lib/store/user";
import type { Player, Session, UserProfile } from "@/lib/types";

type Props = {
  profile: UserProfile;
  initialPlayers: Player[];
  initialActiveSession: Session | null;
  children: React.ReactNode;
};

export function AppProvider({ profile, initialPlayers, initialActiveSession, children }: Props) {
  const setProfile = useUserStore((s) => s.setProfile);
  const setPlayers = useNicksStore((s) => s.setPlayers);
  const setActiveSession = useSessionStore((s) => s.setActive);

  // Hydrate stores once when the layout mounts. Re-runs only if the
  // server-rendered values change between navigations.
  useEffect(() => {
    setProfile(profile);
  }, [profile, setProfile]);

  useEffect(() => {
    setPlayers(initialPlayers);
  }, [initialPlayers, setPlayers]);

  useEffect(() => {
    setActiveSession(initialActiveSession);
  }, [initialActiveSession, setActiveSession]);

  return <>{children}</>;
}
