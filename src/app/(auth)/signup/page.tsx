import Link from "next/link";
import { signUp } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Metagame Notes</h1>
          <p className="text-muted-foreground text-sm">Crie sua conta</p>
        </div>

        <form action={signUp} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Nome
            </label>
            <Input id="name" name="name" type="text" required autoComplete="name" />
          </div>

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
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full">
            Criar conta
          </Button>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Já tem conta?{" "}
          <Link href="/login" className="text-foreground font-medium underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
