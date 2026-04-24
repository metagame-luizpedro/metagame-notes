"use client";

import { useState } from "react";
import { NoteComposer } from "@/components/note-composer";
import { RecentNotes } from "@/components/recent-notes";

export function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Capturar nota</h1>
        <p className="text-muted-foreground text-sm">
          Aperte espaço ou clique no microfone pra começar.
        </p>
      </div>

      <NoteComposer onSaved={() => setRefreshKey((k) => k + 1)} />

      <RecentNotes refreshKey={refreshKey} />
    </div>
  );
}
