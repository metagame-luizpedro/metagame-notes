import { WhisperTestPanel } from "@/components/whisper-test-panel";

export default function TestWhisperPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">POC — Whisper</h1>
        <p className="text-muted-foreground text-sm">
          Página isolada pra avaliar qualidade e custo do Whisper antes de migrar o composer.
          Cap de 60s por gravação.
        </p>
      </div>

      <WhisperTestPanel />
    </div>
  );
}
