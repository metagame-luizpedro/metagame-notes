"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleUserRole } from "@/app/(app)/admin/actions";
import type { AdminUserRow } from "@/lib/db/admin";
import { cn } from "@/lib/utils";

type Props = {
  users: AdminUserRow[];
  currentUserId: string;
};

function initialOf(name: string): string {
  const t = (name ?? "").trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

export function AdminUserTable({ users, currentUserId }: Props) {
  const [pending, startTransition] = useTransition();

  function handleToggle(userId: string) {
    const fd = new FormData();
    fd.set("user_id", userId);
    startTransition(async () => {
      const result = await toggleUserRole(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Role atualizada.");
    });
  }

  if (users.length === 0) {
    return (
      <div className="text-muted-foreground border-border rounded-lg border border-dashed p-10 text-center text-sm">
        Nenhum membro ainda.
      </div>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Membro</th>
            <th className="px-3 py-2 text-left font-medium">Email</th>
            <th className="px-3 py-2 text-left font-medium">Role</th>
            <th className="px-3 py-2 text-right font-medium">Notas</th>
            <th className="px-3 py-2 text-right font-medium">Sessões</th>
            <th className="px-3 py-2 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <tr key={u.id} className="border-border border-t">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      aria-hidden
                    >
                      {initialOf(u.name)}
                    </div>
                    <span className="font-medium">{u.name}</span>
                    {isSelf && (
                      <span className="text-muted-foreground text-xs">(você)</span>
                    )}
                  </div>
                </td>
                <td className="text-muted-foreground px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      u.role === "admin"
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                  {u.notes_count}
                </td>
                <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                  {u.sessions_count}
                </td>
                <td className="px-3 py-2 text-right">
                  {isSelf ? (
                    <span className="text-muted-foreground text-xs">—</span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleToggle(u.id)}
                    >
                      {u.role === "admin" ? "Tornar player" : "Tornar admin"}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
