import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerForm } from "@/components/player-form";
import { PlayerTable } from "@/components/player-table";
import { createClient } from "@/lib/supabase/server";
import { listPlayers, listPlayersByTag } from "@/lib/db/players";
import { listTagsForPlayers } from "@/lib/db/player-tags";

type Props = {
  searchParams: Promise<{ tag?: string }>;
};

export default async function PlayersPage({ searchParams }: Props) {
  const { tag } = await searchParams;
  const activeTag = tag?.trim() || null;

  const supabase = await createClient();
  const players = activeTag
    ? await listPlayersByTag(supabase, activeTag)
    : await listPlayers(supabase);
  const tagsByPlayer = await listTagsForPlayers(
    supabase,
    players.map((p) => p.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jogadores</h1>
          <p className="text-muted-foreground text-sm">
            Pool compartilhado do time. Edições afetam o que todo mundo vê.
          </p>
        </div>
        <PlayerForm
          trigger={
            <Button>
              <Plus className="size-4" />
              Novo jogador
            </Button>
          }
        />
      </div>

      {activeTag && (
        <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span>
            Filtrando por tag: <strong className="font-semibold">{activeTag}</strong>
          </span>
          <Link
            href="/players"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <X className="size-3.5" />
            Limpar filtro
          </Link>
        </div>
      )}

      {activeTag && players.length === 0 ? (
        <div className="text-muted-foreground border-border rounded-lg border border-dashed p-10 text-center text-sm">
          Nenhum jogador com a tag <strong>{activeTag}</strong>.{" "}
          <Link href="/players" className="underline">
            Limpar filtro
          </Link>
        </div>
      ) : (
        <PlayerTable
          tagsByPlayer={tagsByPlayer}
          players={activeTag ? players : undefined}
        />
      )}
    </div>
  );
}
