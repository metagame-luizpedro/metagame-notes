// Detecta speech triggers de visibilidade no INÍCIO do transcript.
// Remove o trigger do texto e retorna a visibility inferida.
// Exemplo: "nota pessoal o vilão dá 3bet demais"
//   → { visibility: "personal", cleanedText: "o vilão dá 3bet demais" }

import type { NoteVisibility } from "@/lib/types";

const PERSONAL_TRIGGERS = ["nota pessoal", "note pessoal", "pessoal:", "anotação pessoal"];

const TEAM_TRIGGERS = [
  "nota time",
  "note time",
  "nota compartilhada",
  "nota do time",
  "nota pro time",
  "compartilhada:",
  "time:",
];

type TriggerResult = {
  visibility: NoteVisibility | null;
  cleanedText: string;
};

export function detectVisibilityTrigger(text: string): TriggerResult {
  if (!text) return { visibility: null, cleanedText: text };

  const t = text.trimStart();
  const lower = t.toLowerCase();

  // Testa triggers mais longos primeiro (ex: "nota do time" antes de "time:").
  const all = [
    ...PERSONAL_TRIGGERS.map((k) => ({ trigger: k, visibility: "personal" as const })),
    ...TEAM_TRIGGERS.map((k) => ({ trigger: k, visibility: "team" as const })),
  ].sort((a, b) => b.trigger.length - a.trigger.length);

  for (const { trigger, visibility } of all) {
    if (lower.startsWith(trigger)) {
      const rest = t.slice(trigger.length).trimStart();
      const cleaned = rest.replace(/^[,.:;\-\s]+/, "");
      return { visibility, cleanedText: cleaned };
    }
  }

  return { visibility: null, cleanedText: text };
}
