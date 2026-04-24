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

export type Session = {
  id: string;
  user_id: string;
  stake: string;
  tables: string[];
  started_at: string;
  ended_at: string | null;
  created_at: string;
};
