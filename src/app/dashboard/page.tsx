import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, email, role")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Bem-vindo{profile?.name ? `, ${profile.name}` : ""}.
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </header>

      <section className="border-border rounded-lg border p-6">
        <h2 className="mb-2 font-semibold">Sua conta</h2>
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt>Email</dt>
          <dd>{profile?.email ?? user.email}</dd>
          <dt>Role</dt>
          <dd>{profile?.role ?? "—"}</dd>
        </dl>
      </section>

      <section className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-center text-sm">
        M1 concluído. Próximas funcionalidades chegam no M2 (captura de nota por voz).
      </section>
    </main>
  );
}
