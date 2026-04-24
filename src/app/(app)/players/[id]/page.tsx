import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPlayerById } from "@/lib/db/players";
import { listNotesForPlayer } from "@/lib/db/notes";
import { listTagsForPlayer, listGlobalCustomTags } from "@/lib/db/player-tags";
import { PlayerProfile, PAGE_SIZE } from "@/components/player-profile";
import { PlayerTagsManager } from "@/components/player-tags-manager";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PlayerProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const player = await getPlayerById(supabase, id);
  if (!player) notFound();

  // Primeira página da aba "Todas". As outras abas fazem fetch sob demanda
  // no client — evita 3 queries desnecessárias no SSR quando o user talvez
  // nem troque de aba.
  const [initialNotes, tags, globalCustomTags] = await Promise.all([
    listNotesForPlayer(supabase, id, {
      visibility: "all",
      limit: PAGE_SIZE,
      offset: 0,
    }),
    listTagsForPlayer(supabase, id),
    listGlobalCustomTags(supabase),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/players"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Jogadores
      </Link>

      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{player.nick}</h1>
        <p className="text-muted-foreground text-sm">
          Criado em {new Date(player.created_at).toLocaleDateString("pt-BR")}
        </p>
      </div>

      <PlayerTagsManager
        playerId={player.id}
        tags={tags}
        globalCustomTags={globalCustomTags}
      />

      <PlayerProfile playerId={player.id} initialNotes={initialNotes} />
    </div>
  );
}
