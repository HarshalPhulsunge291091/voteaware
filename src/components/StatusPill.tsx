type Tone = "good" | "warn" | "bad" | "neutral";

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: "var(--color-good-soft)", fg: "var(--color-good)" },
  warn: { bg: "var(--color-warn-soft)", fg: "var(--color-warn)" },
  bad: { bg: "var(--color-bad-soft)", fg: "var(--color-bad)" },
  neutral: { bg: "var(--color-ink-border)", fg: "var(--color-text-mid)" },
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const meta = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: meta.bg, color: meta.fg }}
    >
      {label}
    </span>
  );
}
