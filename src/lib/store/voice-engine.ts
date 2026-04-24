// Preferência do engine de voz (Whisper vs Web Speech), persistida em
// localStorage. Default: Whisper.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VoiceEngineKind } from "@/lib/voice/engine";

type VoiceEngineStore = {
  kind: VoiceEngineKind;
  setKind: (kind: VoiceEngineKind) => void;
};

export const useVoiceEngineStore = create<VoiceEngineStore>()(
  persist(
    (set) => ({
      kind: "whisper",
      setKind: (kind) => set({ kind }),
    }),
    { name: "mg-voice-engine" },
  ),
);
