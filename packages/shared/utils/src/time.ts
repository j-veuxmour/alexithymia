export type UnixMs = number;
export type DurationMs = number;

export const now = (): UnixMs => Date.now();

const DURATION_UNITS: Readonly<Record<string, number>> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const DURATION_RE = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/;

/**
 * Parse a human-readable duration string like "5m" or "750ms" to milliseconds.
 * Accepts decimals and the units: ms, s, m, h, d.
 */
export const parseDuration = (input: string): DurationMs => {
  const m = DURATION_RE.exec(input.trim());
  if (!m) throw new RangeError(`parseDuration: invalid format "${input}"`);
  const value = Number(m[1]);
  const unit = m[2] as keyof typeof DURATION_UNITS;
  const factor = DURATION_UNITS[unit];
  if (factor === undefined) throw new RangeError(`parseDuration: unknown unit "${unit}"`);
  return value * factor;
};

export const formatDuration = (ms: DurationMs): string => {
  if (!Number.isFinite(ms)) throw new RangeError('formatDuration: ms must be finite');
  const abs = Math.abs(ms);
  if (abs < 1_000) return `${Math.round(ms)}ms`;
  if (abs < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  if (abs < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (abs < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
};

export const isExpired = (deadline: UnixMs, current: UnixMs = now()): boolean =>
  current >= deadline;
