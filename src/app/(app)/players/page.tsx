import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerForm } from "@/components/player-form";
import { PlayerTable } from "@/components/player-table";

export default function PlayersPage() {
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

      <PlayerTable />
    </div>
  );
}
