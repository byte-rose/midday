import { isProduction } from "./env";

function parsePositiveInt(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function toQueueEnvSuffix(queueName: string) {
  return queueName.replaceAll("-", "_").toUpperCase();
}

export function getQueueConcurrency(opts: {
  queueName: string;
  productionDefault: number;
  developmentDefault: number;
}) {
  const envVar = `WORKER_CONCURRENCY_${toQueueEnvSuffix(opts.queueName)}`;
  const override = parsePositiveInt(process.env[envVar]);

  if (override !== null) return override;

  return isProduction() ? opts.productionDefault : opts.developmentDefault;
}

