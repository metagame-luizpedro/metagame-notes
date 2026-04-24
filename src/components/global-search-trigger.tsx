"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearchDialog } from "@/components/global-search-dialog";

type Props = {
  allTags: string[];
  userStakes: string[];
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function GlobalSearchTrigger({ allTags, userStakes }: Props) {
  const [open, setOpen] = useState(false);
  // Lazy init: roda só na primeira render do client. Guarda contra SSR.
  const [isMac] = useState(
    () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform),
  );

  // Atalho global: Cmd+K (Mac) / Ctrl+K (Windows/Linux). Sempre abre — mesmo
  // se o foco estiver em input/textarea (é a exceção à regra: busca é
  // global-first, diferente de Espaço/Enter que são do composer).
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      const modPressed = e.metaKey || e.ctrlKey;
      if (modPressed && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // Além do Cmd+K, "/" também abre (padrão GitHub/Notion) — só quando
      // não está escrevendo.
      if (e.key === "/" && !isEditableTarget(e.target) && !e.repeat) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-muted-foreground gap-2"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="bg-muted ml-1 hidden rounded px-1 py-0.5 text-[10px] font-normal sm:inline">
          {isMac ? "⌘K" : "Ctrl+K"}
        </kbd>
      </Button>

      <GlobalSearchDialog
        open={open}
        onOpenChange={setOpen}
        allTags={allTags}
        userStakes={userStakes}
      />
    </>
  );
}
