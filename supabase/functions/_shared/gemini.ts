import { corsHeaders } from "./cors.ts";

export type GroundingSource = {
  title: string;
  uri: string;
};

const DEFAULT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite",
];

function normalizeModels(preferredModels?: unknown): string[] {
  if (!Array.isArray(preferredModels)) return DEFAULT_MODELS;
  const models = preferredModels.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return models.length ? models : DEFAULT_MODELS;
}

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 4) {
  const delays = [800, 1500, 3000, 6000];

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const response = await fetch(url, init);
    if (response.ok) {
      return await response.json();
    }

    const body = await response.text().catch(() => "");
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxRetries - 1) {
      throw new Error(`Gemini request failed (${response.status}) ${body}`);
    }

    await new Promise((resolve) => setTimeout(resolve, delays[attempt] ?? delays[delays.length - 1]));
  }

  throw new Error("Gemini request failed after retries");
}

function getSources(data: any): GroundingSource[] {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();

  return chunks
    .map((chunk: any) => chunk?.web)
    .filter((web: any) => web?.uri && web?.title)
    .filter((web: any) => {
      if (seen.has(web.uri)) return false;
      seen.add(web.uri);
      return true;
    })
    .map((web: any) => ({ title: web.title, uri: web.uri }));
}

function extractText(data: any): string {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text ?? "")
    .join("")
    .trim() ?? "";
}

export function extractJsonObject(text: string) {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in Gemini response");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function callGemini(params: {
  preferredModels?: unknown;
  prompt: string;
  systemInstruction: string;
  useSearch?: boolean;
}) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY secret");
  }

  const models = normalizeModels(params.preferredModels);
  let lastError: unknown = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload: Record<string, unknown> = {
      contents: [{ parts: [{ text: params.prompt }] }],
      systemInstruction: { parts: [{ text: params.systemInstruction }] },
    };

    if (params.useSearch !== false) {
      payload.tools = [{ google_search: {} }];
    }

    try {
      const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return {
        model,
        text: extractText(data),
        sources: getSources(data),
        raw: data,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No Gemini model available");
}

export function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

