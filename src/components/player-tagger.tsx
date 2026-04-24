"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createPlayer } from "@/lib/db/players";
import { useNicksStore } from "@/lib/store/nicks";
import type { Player } from "@/lib/types";

type Props = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function PlayerTagger({ selectedIds, onChange }: Props) {
  const players = useNicksStore((s) => s.players);
  const upsertPlayer = useNicksStore((s) => s.upsertPlayer);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = players.filter((p) => selectedIds.includes(p.id));
  const available = players.filter((p) => !selectedIds.includes(p.id));

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function quickCreate() {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Se um jogador com esse nick exato (case-insensitive) já existe, só seleciona.
    const existing = players.find((p) => p.nick.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!selectedIds.includes(existing.id)) onChange([...selectedIds, existing.id]);
      setQuery("");
      setOpen(false);
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const created = await createPlayer(supabase, trimmed);
        upsertPlayer(created);
        onChange([...selectedIds, created.id]);
        toast.success(`Jogador "${created.nick}" criado.`);
        setQuery("");
        setOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao criar jogador.";
        toast.error(message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.map((p) => (
        <span
          key={p.id}
          className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
        >
          {p.nick}
          <button
            type="button"
            onClick={() => toggle(p.id)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remover ${p.nick}`}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Plus className="size-3.5" />
            Adicionar jogador
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command shouldFilter>
            <CommandInput placeholder="Buscar nick…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                {query.trim() ? (
                  <button
                    type="button"
                    onClick={quickCreate}
                    disabled={pending}
                    className="hover:bg-muted w-full px-3 py-2 text-left text-sm"
                  >
                    {pending ? "Criando…" : `Criar "${query.trim()}"`}
                  </button>
                ) : (
                  <span className="text-muted-foreground block px-3 py-2 text-sm">
                    Digite um nick.
                  </span>
                )}
              </CommandEmpty>
              {available.length > 0 && (
                <CommandGroup heading="Existentes">
                  {available.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.nick}
                      onSelect={() => {
                        toggle(p.id);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      {p.nick}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Helper exported for the composer: given a transcript and the known players,
// returns the IDs of mentioned ones (auto-tag).
export function detectMentionedPlayerIds(text: string, players: readonly Player[]): string[] {
  if (!text || !players.length) return [];
  const lower = text.toLowerCase();
  const ids = new Set<string>();
  for (const p of players) {
    const nickLower = p.nick.toLowerCase();
    // Reaproveita boundary loose: precedido/seguido por não-letra/dígito.
    const re = new RegExp(
      `(^|[^\\p{L}\\p{N}])${nickLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`,
      "iu",
    );
    if (re.test(lower)) ids.add(p.id);
  }
  return [...ids];
}
