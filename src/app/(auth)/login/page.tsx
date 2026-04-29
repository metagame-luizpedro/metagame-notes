import Link from "next/link";
import { sendMagicLink, signIn } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { error, sent } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Metagame Notes</h1>
          <p className="text-muted-foreground text-sm">Entre na sua conta</p>
        </div>

        {sent && (
          <p
            className="rounded-md border border-green-600/40 bg-green-600/10 p-3 text-center text-sm text-green-700 dark:text-green-400"
            role="status"
          >
            Link enviado pro seu email. Cheque a caixa de entrada.
          </p>
        )}

        <form action={signIn} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Senha
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs uppercase tracking-wide">ou</span>
          <span className="bg-border h-px flex-1" />
        </div>

        <form action={sendMagicLink} className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="magic-email" className="text-sm font-medium">
              Esqueci a senha / primeiro acesso
            </label>
            <Input
              id="magic-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
            />
          </div>
          <Button type="submit" variant="outline" className="w-full">
            Receber link de acesso por email
          </Button>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Ainda não tem conta?{" "}
          <Link href="/signup" className="text-foreground font-medium underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  );
}
