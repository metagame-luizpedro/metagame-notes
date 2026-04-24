"use client";

import { Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteVisibility } from "@/lib/types";

type Props = {
  value: NoteVisibility;
  onChange: (v: NoteVisibility) => void;
};

export function VisibilityToggle({ value, onChange }: Props) {
  return (
    <div className="border-border inline-flex rounded-md border p-0.5" role="radiogroup">
      <button
        type="button"
        role="radio"
        aria-checked={value === "personal"}
        onClick={() => onChange("personal")}
        className={cn(
          "flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors",
          value === "personal"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Lock className="size-3.5" />
        Pessoal
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "team"}
        onClick={() => onChange("team")}
        className={cn(
          "flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors",
          value === "team"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Users className="size-3.5" />
        Time
      </button>
    </div>
  );
}
