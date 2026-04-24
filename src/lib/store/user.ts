// Perfil do usuário logado, hidratado pelo layout protegido (server)
// e disponível para client components via hook.

import { create } from "zustand";
import type { UserProfile } from "@/lib/types";

type UserState = {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
};

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}));
