"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VisibilityToggle } from "@/components/visibility-toggle";
import { PlayerTagger } from "@/components/player-tagger";
import { createClient } from "@/lib/supabase/client";
import { updateNoteWithMentions } from "@/lib/db/notes";
import type { NoteWithMentions } from "@/lib/db/notes";
import type { NoteVisibility } from "@/lib/types";

type Props = {
  note: NoteWithMentions | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

// Wrapper: força remount do form quando a nota alvo muda (via key), evitando
// o padrão antigo de useEffect para sincronizar prop → state.
export function NoteEditDialog({ note, open, onOpenChange, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {note && (
          <EditForm
            key={note.id}
            note={note}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  note,
  onClose,
  onSaved,
}: {
  note: NoteWithMentions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = useState(note.content);
  const [visibility, setVisibility] = useState<NoteVisibility>(note.visibility);
  const [playerIds, setPlayerIds] = useState<string[]>(
    note.mentions.map((m) => m.player_id),
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Nota vazia.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      await updateNoteWithMentions(supabase, note.id, {
        content: trimmed,
        visibility,
        playerIds,
      });
      toast.success("Nota atualizada.");
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar nota</DialogTitle>
        <DialogDescription>
          Alterações respeitam as permissões de visibilidade configuradas.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <VisibilityToggle value={visibility} onChange={setVisibility} />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          autoFocus
        />
        <PlayerTagger selectedIds={playerIds} onChange={setPlayerIds} />
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </>
  );
}
