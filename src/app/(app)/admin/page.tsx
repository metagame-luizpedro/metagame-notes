import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAllUsersWithStats } from "@/lib/db/admin";
import { AdminUserTable } from "@/components/admin-user-table";
import { InviteDialog } from "@/components/invite-dialog";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // OK pra service-role aqui: já validamos role do caller acima.
  const admin = createAdminClient();
  const users = await listAllUsersWithStats(admin);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administração</h1>
          <p className="text-muted-foreground text-sm">
            Membros do time, convites e roles.
          </p>
        </div>
        <InviteDialog />
      </div>

      <AdminUserTable users={users} currentUserId={user.id} />
    </div>
  );
}
