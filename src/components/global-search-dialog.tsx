"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, Hash, Lock, Users, User, FileText } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { searchPlayers } from "@/lib/db/players";
import { searchTags, searchNotes, type GlobalSearchResult } from "@/lib/db/search";
import { useUserStore } from "@/lib/store/user";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTags: string[];
  userStakes: string[];
};

type Visibility = "all" | "team" | "personal";

type Filters = {
  authorId: string | null;
  stake: string | null;
  tag: string | null;
  visibility: Visibility;
};

const DEFAULT_FILTERS: Filters = {
  authorId: null,
  stake: null,
  tag: null,
  visibility: "all",
};

const DEBOUNCE_MS = 200;
const RESULT_LIMIT_SMALL = 10;
const RESULT_LIMIT_NOTES = 20;

export function GlobalSearchDialog({ open, onOpenChange, allTags, userStakes }: Props) {
  const router = useRouter();
  const profile = useUserStore((s) => s.profile);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult>({
    players: [],
    tags: [],
    notes: [],
  });
  const [loading, setLoading] = useState(false);

  // Debounce da query. Filtros não passam por debounce — dispara imediato.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const hasFilter = useMemo(() => {
    return (
      filters.authorId !== null ||
      filters.stake !== null ||
      filters.tag !== null ||
      filters.visibility !== "all"
    );
  }, [filters]);

  const hasAnyInput = debounced.trim().length > 0 || hasFilter;

  useEffect(() => {
    if (!open) return;
    if (!hasAnyInput) return;

    let cancelled = false;

    // Tudo dentro do IIFE async — sem setState síncrono no body do effect.
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const q = debounced.trim();
        const [players, tags, notes] = await Promise.all([
          q ? searchPlayers(supabase, q, RESULT_LIMIT_SMALL) : Promise.resolve([]),
          q ? searchTags(supabase, q, RESULT_LIMIT_SMALL) : Promise.resolve([]),
          searchNotes(
            supabase,
            {
              q: q || undefined,
              authorId: filters.authorId,
              stake: filters.stake,
              tag: filters.tag,
              visibility: filters.visibility === "all" ? null : filters.visibility,
            },
            { limit: RESULT_LIMIT_NOTES, offset: 0 },
          ),
        ]);
        if (!cancelled) setResults({ players, tags, notes });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, debounced, filters, hasAnyInput]);

  // Reseta ao fechar pra próxima abertura começar limpa. Feito no handler
  // (não em useEffect) pra evitar cascading renders.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setQuery("");
        setDebounced("");
        setFilters(DEFAULT_FILTERS);
        setShowFilters(false);
        setResults({ players: [], tags: [], notes: [] });
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const go = useCallback(
    (href: string) => {
      handleOpenChange(false);
      router.push(href);
    },
    [handleOpenChange, router],
  );

  const totalResults =
    results.players.length + results.tags.length + results.notes.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b px-3">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar notas, jogadores ou tags…"
              className="flex-1 border-0 shadow-none focus:ring-0"
            />
            <Button
              type="button"
              variant={showFilters || hasFilter ? "default" : "ghost"}
              size="sm"
              className="gap-1"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="size-3.5" />
              Filtros
              {hasFilter && <span className="bg-background/30 rounded px-1 text-xs">•</span>}
            </Button>
          </div>

          {showFilters && (
            <FiltersBar
              filters={filters}
              onChange={setFilters}
              allTags={allTags}
              userStakes={userStakes}
              selfId={profile?.id ?? null}
              selfName={profile?.name ?? "Você"}
            />
          )}

          <CommandList className="max-h-[60vh]">
            {!hasAnyInput && (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                Digite pra buscar, ou use filtros pra listar notas por autor / stake / tag.
              </div>
            )}

            {hasAnyInput && loading && totalResults === 0 && (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                Buscando…
              </div>
            )}

            {hasAnyInput && !loading && totalResults === 0 && (
              <CommandEmpty>Nada encontrado.</CommandEmpty>
            )}

            {results.players.length > 0 && (
              <CommandGroup heading="Jogadores">
                {results.players.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`player-${p.id}`}
                    onSelect={() => go(`/players/${p.id}`)}
                  >
                    <User className="size-3.5" />
                    {p.nick}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.tags.length > 0 && (
              <CommandGroup heading="Tags">
                {results.tags.map((t) => (
                  <CommandItem
                    key={t.tag}
                    value={`tag-${t.tag}`}
                    onSelect={() => go(`/players?tag=${encodeURIComponent(t.tag)}`)}
                  >
                    <Hash className="size-3.5" />
                    <span className="flex-1">{t.tag}</span>
                    <span className="text-muted-foreground text-xs">
                      {t.count} {t.count === 1 ? "jogador" : "jogadores"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.notes.length > 0 && (
              <CommandGroup heading="Notas">
                {results.notes.map((n) => {
                  const firstMention = n.mentions[0];
                  const href = firstMention
                    ? `/players/${firstMention.player_id}`
                    : "/dashboard";
                  return (
                    <CommandItem
                      key={n.id}
                      value={`note-${n.id}`}
                      onSelect={() => go(href)}
                      className="flex items-start gap-2"
                    >
                      <div className="mt-0.5">
                        {n.visibility === "personal" ? (
                          <Lock className="size-3.5" />
                        ) : (
                          <Users className="size-3.5" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="line-clamp-2 text-sm">{n.content}</span>
                        <span className="text-muted-foreground flex gap-2 text-xs">
                          {n.mentions.length > 0 && (
                            <span>{n.mentions.map((m) => m.nick).join(", ")}</span>
                          )}
                          <span className="ml-auto">
                            {new Date(n.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>

          <div className="text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-xs">
            <span>
              <FileText className="mr-1 inline size-3" />
              Busca respeita RLS — notas pessoais só aparecem pra você
            </span>
            <span>
              <kbd className="bg-muted rounded px-1 py-0.5">Esc</kbd> fechar
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function FiltersBar({
  filters,
  onChange,
  allTags,
  userStakes,
  selfId,
  selfName,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  allTags: string[];
  userStakes: string[];
  selfId: string | null;
  selfName: string;
}) {
  const setVisibility = (v: Visibility) => onChange({ ...filters, visibility: v });
  const setStake = (s: string | null) => onChange({ ...filters, stake: s });
  const setTag = (t: string | null) => onChange({ ...filters, tag: t });
  const setAuthor = (a: string | null) => onChange({ ...filters, authorId: a });

  return (
    <div className="border-b px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          label="Visibilidade"
          options={[
            { value: "all", label: "Todas" },
            { value: "team", label: "Time" },
            { value: "personal", label: "Pessoais" },
          ]}
          value={filters.visibility}
          onChange={(v) => setVisibility(v as Visibility)}
        />

        <FilterDropdown
          label="Autor"
          options={selfId ? [{ value: selfId, label: selfName }] : []}
          value={filters.authorId}
          onChange={setAuthor}
          placeholder="Qualquer"
        />

        <FilterDropdown
          label="Stake"
          options={userStakes.map((s) => ({ value: s, label: s }))}
          value={filters.stake}
          onChange={setStake}
          placeholder="Qualquer"
        />

        <FilterDropdown
          label="Tag"
          options={allTags.map((t) => ({ value: t, label: t }))}
          value={filters.tag}
          onChange={setTag}
          placeholder="Qualquer"
        />

        {(filters.visibility !== "all" ||
          filters.authorId ||
          filters.stake ||
          filters.tag) && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}

function FilterPill<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="border-border flex items-center gap-0 overflow-hidden rounded-md border text-xs">
      <span className="bg-muted text-muted-foreground px-2 py-1 font-medium">{label}:</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2 py-1 transition-colors",
            value === o.value
              ? "bg-foreground text-background font-medium"
              : "hover:bg-muted text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterDropdown({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
}) {
  return (
    <label className="border-border flex items-center gap-1 overflow-hidden rounded-md border text-xs">
      <span className="bg-muted text-muted-foreground px-2 py-1 font-medium">{label}:</span>
      <select
        className="bg-background cursor-pointer px-2 py-1 outline-none"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
