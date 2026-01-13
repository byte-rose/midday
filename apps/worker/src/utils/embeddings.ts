import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

const DEFAULT_DIMENSIONS = 768;

function getEmbeddingDimensions(): number {
  const raw = process.env.EMBEDDINGS_DIMENSIONS;
  if (!raw) return DEFAULT_DIMENSIONS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DIMENSIONS;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }
  return hash >>> 0;
}

function xorshift32(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}

function generateLocalEmbedding(text: string, dimensions: number): number[] {
  const next = xorshift32(fnv1a32(text));
  const embedding = new Array<number>(dimensions);
  for (let i = 0; i < dimensions; i++) {
    const v = next() / 0xffffffff; // 0..1
    embedding[i] = v * 2 - 1; // -1..1
  }
  return embedding;
}

const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const provider =
  process.env.EMBEDDINGS_PROVIDER ??
  (GOOGLE_API_KEY ? "google" : "local");

const google =
  provider === "google" && GOOGLE_API_KEY
    ? createGoogleGenerativeAI({ apiKey: GOOGLE_API_KEY })
    : null;

const EMBEDDING_CONFIG = google
  ? {
      model: google.textEmbedding("gemini-embedding-001"),
      providerOptions: {
        google: {
          outputDimensionality: getEmbeddingDimensions(),
          taskType: "SEMANTIC_SIMILARITY",
        },
      },
      modelName: "gemini-embedding-001",
    }
  : null;

export async function generateEmbedding(text: string): Promise<{
  embedding: number[];
  model: string;
}> {
  if (!EMBEDDING_CONFIG) {
    const dimensions = getEmbeddingDimensions();
    return {
      embedding: generateLocalEmbedding(text, dimensions),
      model: `local-fnv1a-xorshift-${dimensions}`,
    };
  }

  const { embedding } = await embed({
    model: EMBEDDING_CONFIG.model,
    value: text,
    providerOptions: EMBEDDING_CONFIG.providerOptions,
  });

  return {
    embedding,
    model: EMBEDDING_CONFIG.modelName,
  };
}

/**
 * Generate multiple embeddings with our standard configuration
 */
export async function generateEmbeddings(texts: string[]): Promise<{
  embeddings: number[][];
  model: string;
}> {
  if (!EMBEDDING_CONFIG) {
    const dimensions = getEmbeddingDimensions();
    return {
      embeddings: texts.map((t) => generateLocalEmbedding(t, dimensions)),
      model: `local-fnv1a-xorshift-${dimensions}`,
    };
  }

  const { embeddings } = await embedMany({
    model: EMBEDDING_CONFIG.model,
    values: texts,
    providerOptions: EMBEDDING_CONFIG.providerOptions,
  });

  return {
    embeddings,
    model: EMBEDDING_CONFIG.modelName,
  };
}
