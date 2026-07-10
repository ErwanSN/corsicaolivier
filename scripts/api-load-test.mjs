import { performance } from "node:perf_hooks";

const targetUrl = process.env.LOAD_TARGET_URL ?? "http://localhost:3001/api/health";
const durationSeconds = readPositiveNumber("LOAD_DURATION_SECONDS", 60);
const concurrency = readPositiveInteger("LOAD_CONCURRENCY", 10);
const requestTimeoutMilliseconds = readPositiveInteger("LOAD_REQUEST_TIMEOUT_MS", 5_000);
const p95BudgetMilliseconds = readPositiveNumber("LOAD_P95_BUDGET_MS", 500);
const maximumErrorRate = readRatio("LOAD_MAX_ERROR_RATE", 0.01);
const deadline = performance.now() + durationSeconds * 1_000;
const durations = [];
let requests = 0;
let failures = 0;

await Promise.all(Array.from({ length: concurrency }, runWorker));

const sorted = durations.toSorted((left, right) => left - right);
const report = {
  concurrency,
  durationSeconds,
  errorRate: requests === 0 ? 1 : failures / requests,
  failures,
  p50Milliseconds: percentile(sorted, 0.5),
  p95Milliseconds: percentile(sorted, 0.95),
  p99Milliseconds: percentile(sorted, 0.99),
  requests,
  requestsPerSecond: requests / durationSeconds,
  targetUrl
};
console.log(JSON.stringify(report, null, 2));

if (report.errorRate > maximumErrorRate || report.p95Milliseconds > p95BudgetMilliseconds) {
  console.error(
    `Load budgets exceeded: errorRate <= ${String(maximumErrorRate)}, p95 <= ${String(p95BudgetMilliseconds)}ms.`
  );
  process.exitCode = 1;
}

async function runWorker() {
  while (performance.now() < deadline) {
    const startedAt = performance.now();
    try {
      const response = await fetch(targetUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMilliseconds)
      });
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch {
      failures += 1;
    } finally {
      requests += 1;
      durations.push(performance.now() - startedAt);
    }
  }
}

function percentile(sortedValues, ratio) {
  if (sortedValues.length === 0) return Number.POSITIVE_INFINITY;
  return sortedValues[Math.max(0, Math.ceil(sortedValues.length * ratio) - 1)];
}

function readPositiveInteger(name, fallback) {
  const value = readPositiveNumber(name, fallback);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

function readPositiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive.`);
  return value;
}

function readRatio(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
  return value;
}
