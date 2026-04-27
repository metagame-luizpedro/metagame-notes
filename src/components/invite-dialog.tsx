"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inviteUser } from "@/app/(app)/admin/actions";

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await inviteUser(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Convite enviado para ${email}.`);
      setEmail("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Convidar membro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Convidar novo membro</DialogTitle>
            <DialogDescription>
              Um magic link vai ser enviado pro email. Quem receber acessa direto sem
              senha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="invite-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-border bg-background h-9 w-full rounded-md border px-3 text-sm"
              placeholder="email@time.com"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending ? "Enviando…" : "Enviar convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
