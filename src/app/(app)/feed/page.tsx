import { createClient } from "@/lib/supabase/server";
import { TeamFeed } from "@/components/team-feed";
import {
  listTeamFeedNotes,
  listFeedAuthors,
  listAllStakes,
} from "@/lib/db/feed";

export const PAGE_SIZE = 20;

export default async function FeedPage() {
  const supabase = await createClient();

  const [authors, stakes, initialNotes] = await Promise.all([
    listFeedAuthors(supabase),
    listAllStakes(supabase),
    listTeamFeedNotes(
      supabase,
      { period: "today" },
      { limit: PAGE_SIZE },
    ),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feed do time</h1>
        <p className="text-muted-foreground text-sm">
          Notas team de todos os membros, em tempo real.
        </p>
      </div>

      <TeamFeed
        authors={authors}
        stakes={stakes}
        initialNotes={initialNotes}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
