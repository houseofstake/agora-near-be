export function formatTimeRemaining(deadline: Date | null): string | null {
  if (!deadline) return null;
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";

  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(" ") || "< 1m";
}

export function progressFraction(start: Date, deadline: Date | null): number {
  if (!deadline) return 0;
  const total = deadline.getTime() - start.getTime();
  if (total <= 0) return 1;
  const elapsed = Date.now() - start.getTime();
  return Math.min(Math.max(elapsed / total, 0), 1);
}

function compactNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

export function formatVotesSummary(
  forPower: { toFixed: () => string } | null | undefined,
  againstPower: { toFixed: () => string } | null | undefined,
): string {
  const f = forPower ? compactNumber(parseFloat(forPower.toFixed())) : "0";
  const a = againstPower
    ? compactNumber(parseFloat(againstPower.toFixed()))
    : "0";
  return `${f} For — ${a} Against`;
}
