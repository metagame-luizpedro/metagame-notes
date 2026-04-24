"use client";

import { useEffect } from "react";
import { useNicksStore } from "@/lib/store/nicks";
import { useUserStore } from "@/lib/store/user";
import type { Player, UserProfile } from "@/lib/types";

type Props = {
  profile: UserProfile;
  initialPlayers: Player[];
  children: React.ReactNode;
};

export function AppProvider({ profile, initialPlayers, children }: Props) {
  const setProfile = useUserStore((s) => s.setProfile);
  const setPlayers = useNicksStore((s) => s.setPlayers);

  // Hydrate stores once when the layout mounts. Re-runs only if the
  // server-rendered values change between navigations.
  useEffect(() => {
    setProfile(profile);
  }, [profile, setProfile]);

  useEffect(() => {
    setPlayers(initialPlayers);
  }, [initialPlayers, setPlayers]);

  return <>{children}</>;
}
