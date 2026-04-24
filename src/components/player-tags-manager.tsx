"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addPlayerTagAction, removePlayerTagAction } from "@/app/(app)/players/[id]/actions";
import { OFFICIAL_TAGS, type PlayerTag } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  playerId: string;
  tags: PlayerTag[];
  globalCustomTags: string[];
};

export function PlayerTagsManager({ playerId, tags, globalCustomTags }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const existingTagNames = new Set(tags.map((t) => t.tag.toLowerCase()));
  const officialAvailable = OFFICIAL_TAGS.filter(
    (t) => !existingTagNames.has(t.toLowerCase()),
  );
  const customAvailable = globalCustomTags.filter(
    (t) => !existingTagNames.has(t.toLowerCase()),
  );

  function handleAdd(rawTag: string) {
    const trimmed = rawTag.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const res = await addPlayerTagAction(playerId, trimmed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Tag "${trimmed}" adicionada.`);
      setQuery("");
      setOpen(false);
    });
  }

  function handleRemove(tagRow: PlayerTag) {
    startTransition(async () => {
      const res = await removePlayerTagAction(playerId, tagRow.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Tag "${tagRow.tag}" removida.`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <TagChip key={t.id} tag={t} onRemove={() => handleRemove(t)} removing={pending} />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1" disabled={pending}>
            <Plus className="size-3.5" />
            Adicionar tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command shouldFilter>
            <CommandInput
              placeholder="Digite uma tag…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>
                {query.trim() ? (
                  <button
                    type="button"
                    onClick={() => handleAdd(query)}
                    disabled={pending}
                    className="hover:bg-muted w-full px-3 py-2 text-left text-sm"
                  >
                    {pending ? "Criando…" : `Criar "${query.trim()}"`}
                  </button>
                ) : (
                  <span className="text-muted-foreground block px-3 py-2 text-sm">
                    Digite pra criar.
                  </span>
                )}
              </CommandEmpty>
              {officialAvailable.length > 0 && (
                <CommandGroup heading="Oficiais">
                  {officialAvailable.map((t) => (
                    <CommandItem key={t} value={t} onSelect={() => handleAdd(t)}>
                      <span className="size-2 shrink-0 rounded-full bg-[#C5A547]" />
                      {t}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {customAvailable.length > 0 && (
                <CommandGroup heading="Já usadas no time">
                  {customAvailable.map((t) => (
                    <CommandItem key={t} value={t} onSelect={() => handleAdd(t)}>
                      {t}
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

// Chip de tag renderizado. Exportado pra reuso na tabela /players.
export function TagChip({
  tag,
  onRemove,
  removing,
  compact,
}: {
  tag: PlayerTag;
  onRemove?: () => void;
  removing?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        compact ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-0.5 text-xs",
        tag.is_official
          ? "border-[#C5A547]/40 bg-[#C5A547]/10 text-[#8B7530] dark:text-[#C5A547]"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {tag.tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="hover:text-foreground disabled:opacity-50"
          aria-label={`Remover ${tag.tag}`}
        >
          <X className={compact ? "size-2.5" : "size-3"} />
        </button>
      )}
    </span>
  );
}
