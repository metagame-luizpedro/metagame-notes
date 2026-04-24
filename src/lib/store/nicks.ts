// Cache dos nicks conhecidos pra auto-detecção no transcript.
// Carregado uma vez na entrada do app (via AppProvider) e atualizado após
// criar/editar/deletar player.

import { create } from "zustand";
import type { Player } from "@/lib/types";

type NicksState = {
  players: Player[];
  nicks: string[]; // derivado de `players` pra evitar recalcular a cada render
  setPlayers: (players: Player[]) => void;
  upsertPlayer: (player: Player) => void;
  removePlayer: (id: string) => void;
};

export const useNicksStore = create<NicksState>((set) => ({
  players: [],
  nicks: [],
  setPlayers: (players) =>
    set({
      players,
      nicks: players.map((p) => p.nick),
    }),
  upsertPlayer: (player) =>
    set((state) => {
      const existing = state.players.findIndex((p) => p.id === player.id);
      const next =
        existing >= 0
          ? state.players.map((p, i) => (i === existing ? player : p))
          : [...state.players, player];
      return { players: next, nicks: next.map((p) => p.nick) };
    }),
  removePlayer: (id) =>
    set((state) => {
      const next = state.players.filter((p) => p.id !== id);
      return { players: next, nicks: next.map((p) => p.nick) };
    }),
}));
