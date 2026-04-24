import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Limites Whisper-style (gpt-4o-transcribe usa o mesmo endpoint).
const MAX_BYTES = 25 * 1024 * 1024;
const MIN_BYTES = 1024;

// Preço por minuto por modelo (USD).
const PRICING_PER_MINUTE: Record<string, number> = {
  "gpt-4o-transcribe": 0.006,
  "gpt-4o-mini-transcribe": 0.003,
  "whisper-1": 0.006,
};

const PRIMARY_MODEL = "gpt-4o-transcribe";
const FALLBACK_MODEL = "gpt-4o-mini-transcribe";

// Whisper/gpt-4o-transcribe tem limite de ~224 tokens no prompt — acima disso
// trunca silenciosamente. Mantemos em inglês (documentado como mais eficaz
// mesmo pra áudio em PT-BR) e compacto, em formato CSV-like.
const BASE_CONTEXT_PROMPT =
  "Poker cash game notes. Jargon: 3bet, 4bet, cbet, donk bet, overbet, underbet, check-raise, float, bluff catch, thin value, BTN, SB, BB, CO, UTG, HJ, squeeze, isolate, fold, call, raise, check, bluff, villain, hero, nit, reg, fish, whale, LAG, TAG, calling station, tilt, fold equity, blockers, ranges, equity, board texture, polarized, merged, overpair, top pair, set, flush, straight.";

// Limite conservador de tokens do Whisper (224 tokens). Avisamos antes disso
// pra termos margem — o `length/4` é uma estimativa grossa.
const PROMPT_TOKEN_WARN = 200;
function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

// Cache in-memory dos nicks. TTL curto pra refletir cadastros novos rápido,
// mas longo o suficiente pra evitar bater no banco a cada request.
// Vive por instância de função — em Fluid Compute, várias requisições
// concorrentes na mesma instância compartilham. Aceitável pro M2.
const NICKS_CACHE_TTL_MS = 60_000;
const NICKS_CACHE_LIMIT = 500;
let nicksCache: { nicks: string[]; expiresAt: number } | null = null;

async function getKnownNicks(supabase: SupabaseClient): Promise<string[]> {
  const now = Date.now();
  if (nicksCache && nicksCache.expiresAt > now) {
    return nicksCache.nicks;
  }
  const { data, error } = await supabase
    .from("players")
    .select("nick")
    .order("created_at", { ascending: false })
    .limit(NICKS_CACHE_LIMIT);

  if (error) {
    // Em caso de falha, devolve o cache antigo (mesmo expirado) ou vazio.
    return nicksCache?.nicks ?? [];
  }

  const nicks = (data ?? []).map((r) => r.nick as string);
  nicksCache = { nicks, expiresAt: now + NICKS_CACHE_TTL_MS };
  return nicks;
}

function buildPrompt(nicks: readonly string[]): string {
  if (!nicks.length) return BASE_CONTEXT_PROMPT;
  const list = nicks.join(", ");
  return `${BASE_CONTEXT_PROMPT} Player nicknames: ${list}. Use these exact spellings.`;
}

type TranscribeOk = {
  text: string;
  model: string;
};

async function transcribe(
  openai: OpenAI,
  file: File,
  model: string,
  prompt: string,
): Promise<TranscribeOk> {
  const result = await openai.audio.transcriptions.create({
    file,
    model,
    language: "pt",
    prompt,
    response_format: "json",
  });
  return { text: result.text ?? "", model };
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  // Auth: precisa estar logado pra ler players via RLS.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field." }, { status: 400 });
  }
  if (file.size < MIN_BYTES) {
    return NextResponse.json({ error: "Audio too short." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio exceeds 25MB limit." }, { status: 413 });
  }

  // Cliente envia a duração medida via MediaRecorder. Os modelos novos
  // (gpt-4o-*-transcribe) não retornam `duration` no response, então
  // dependemos do client pra cálculo de custo.
  const clientDurationRaw = formData.get("durationSec");
  const clientDurationSec = clientDurationRaw ? Number(clientDurationRaw) : 0;
  const durationSec =
    Number.isFinite(clientDurationSec) && clientDurationSec > 0 ? clientDurationSec : 0;

  const knownNicks = await getKnownNicks(supabase);
  const prompt = buildPrompt(knownNicks);

  const estimatedTokens = estimateTokens(prompt);
  if (estimatedTokens > PROMPT_TOKEN_WARN) {
    console.warn(
      `[transcribe] prompt ~${estimatedTokens} tokens (${prompt.length} chars) — Whisper trunca em ~224. Considere reduzir jargão ou nicks.`,
    );
  } else {
    console.log(`[transcribe] prompt ~${estimatedTokens} tokens (${prompt.length} chars)`);
  }

  const openai = new OpenAI();

  let result: TranscribeOk;
  try {
    result = await transcribe(openai, file, PRIMARY_MODEL, prompt);
  } catch (primaryErr) {
    const message = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    const looksLikeModelIssue = /model|permission|not.*found|invalid_request/i.test(message);
    if (!looksLikeModelIssue) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    try {
      result = await transcribe(openai, file, FALLBACK_MODEL, prompt);
    } catch (fallbackErr) {
      const fbMessage =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      return NextResponse.json(
        { error: `Primary failed: ${message}. Fallback failed: ${fbMessage}` },
        { status: 502 },
      );
    }
  }

  const pricePerMinute =
    PRICING_PER_MINUTE[result.model] ?? PRICING_PER_MINUTE[PRIMARY_MODEL];
  const costUsd = (durationSec / 60) * pricePerMinute;

  return NextResponse.json({
    text: result.text,
    model: result.model,
    durationSec,
    costUsd,
    bytes: file.size,
    pricePerMinute,
    promptUsed: prompt,
    nicksInPrompt: knownNicks.length,
  });
}
