// Session ativa do user (no máximo uma). Fonte da verdade é o DB — este
// store só cacheia pro client. Hidratado no server via AppProvider.

import { create } from "zustand";
import type { Session } from "@/lib/types";

type SessionState = {
  active: Session | null;
  setActive: (session: Session | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  active: null,
  setActive: (session) => set({ active: session }),
}));
