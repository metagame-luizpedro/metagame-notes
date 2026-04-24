// Shared domain types used across client, server, and DB helpers.

export type NoteVisibility = "personal" | "team";

export type UserRole = "player" | "admin";

export type Player = {
  id: string;
  nick: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  author_id: string | null;
  session_id: string | null;
  visibility: NoteVisibility;
  content: string;
  created_at: string;
  updated_at: string;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  wpt_nicks: string[];
  avatar_url: string | null;
};

export type PlayerTag = {
  id: string;
  player_id: string;
  tag: string;
  is_official: boolean;
  created_by: string | null;
  created_at: string;
};

export const OFFICIAL_TAGS = ["Bot", "Nit", "Recreativo", "Reg", "Whale"] as const;
export type OfficialTag = (typeof OFFICIAL_TAGS)[number];

// Case-insensitive — "Nit", "nit", "NIT" são todos reconhecidos como oficial.
export function isOfficialTag(tag: string): tag is OfficialTag {
  const lower = tag.toLowerCase();
  return OFFICIAL_TAGS.some((t) => t.toLowerCase() === lower);
}

// Normaliza input do user: tags oficiais voltam pra capitalização canônica
// ("nit" → "Nit"), custom viram lowercase ("Fish" → "fish"). Isso garante
// que "Fish"/"fish"/"FISH" não viram 3 tags diferentes e promove reuso
// cross-player no autocomplete.
export function canonicalizeTag(rawTag: string): string {
  const trimmed = rawTag.trim();
  const lower = trimmed.toLowerCase();
  const official = OFFICIAL_TAGS.find((t) => t.toLowerCase() === lower);
  return official ?? lower;
}

export type Session = {
  id: string;
  user_id: string;
  stake: string;
  tables: string[];
  started_at: string;
  ended_at: string | null;
  created_at: string;
};
