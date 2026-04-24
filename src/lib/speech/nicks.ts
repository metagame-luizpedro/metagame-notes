// Detecção e highlight de nicks conhecidos no transcript.
// Suporta caracteres asiáticos/cirílicos via \p{L}\p{N} (Unicode property escapes).
// Funciona idêntico em texto final e interim — mesma função pura aplicada aos dois.

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type NickMatch = {
  nick: string;
  start: number;
  end: number;
  matched: string;
};

export function detectNicks(text: string, knownNicks: readonly string[]): NickMatch[] {
  if (!text || !knownNicks.length) return [];

  // Dedupe case-insensitive e ordena por comprimento desc pra priorizar matches
  // mais longos (ex: "Player123" antes de "Player").
  const unique = [...new Map(knownNicks.map((n) => [n.toLowerCase(), n])).values()];
  const sorted = unique.sort((a, b) => b.length - a.length);

  const matches: NickMatch[] = [];
  for (const nick of sorted) {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${escapeRegex(nick)})(?=$|[^\\p{L}\\p{N}])`,
      "giu",
    );
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const start = m.index + m[1].length;
      const end = start + m[2].length;
      if (!matches.some((x) => start < x.end && end > x.start)) {
        matches.push({ nick, start, end, matched: m[2] });
      }
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

export type HighlightPart =
  | { type: "text"; content: string }
  | { type: "nick"; content: string; nick: string };

export function highlightText(text: string, knownNicks: readonly string[]): HighlightPart[] {
  const matches = detectNicks(text, knownNicks);
  if (!matches.length) return [{ type: "text", content: text }];

  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (cursor < m.start) {
      parts.push({ type: "text", content: text.slice(cursor, m.start) });
    }
    parts.push({ type: "nick", content: text.slice(m.start, m.end), nick: m.nick });
    cursor = m.end;
  }
  if (cursor < text.length) {
    parts.push({ type: "text", content: text.slice(cursor) });
  }
  return parts;
}
