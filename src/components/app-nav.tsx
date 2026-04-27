"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SessionBadge } from "@/components/session-badge";
import { GlobalSearchTrigger } from "@/components/global-search-trigger";
import { cn } from "@/lib/utils";

type Props = {
  userName: string;
  allTags: string[];
  userStakes: string[];
};

const LINKS = [
  { href: "/dashboard", label: "Capturar" },
  { href: "/feed", label: "Feed" },
  { href: "/players", label: "Jogadores" },
];

export function AppNav({ userName, allTags, userStakes }: Props) {
  const pathname = usePathname();

  return (
    <header className="border-border bg-background sticky top-0 z-10 border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Metagame Notes
          </Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <GlobalSearchTrigger allTags={allTags} userStakes={userStakes} />
          <SessionBadge />
          <span className="text-muted-foreground hidden text-sm sm:inline">{userName}</span>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
