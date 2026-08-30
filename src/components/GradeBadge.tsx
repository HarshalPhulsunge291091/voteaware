import type { Grade } from "../data/mps";

const GRADE_STYLES: Record<Grade, { bg: string; fg: string; ring: string }> = {
  A: { bg: "var(--color-good-soft)", fg: "var(--color-good)", ring: "color-mix(in srgb, var(--color-good) 40%, transparent)" },
  B: { bg: "var(--color-good-soft)", fg: "var(--color-good)", ring: "color-mix(in srgb, var(--color-good) 40%, transparent)" },
  C: { bg: "var(--color-warn-soft)", fg: "var(--color-warn)", ring: "color-mix(in srgb, var(--color-warn) 40%, transparent)" },
  D: { bg: "var(--color-bad-soft)", fg: "var(--color-bad)", ring: "color-mix(in srgb, var(--color-bad) 40%, transparent)" },
  F: { bg: "var(--color-bad-soft)", fg: "var(--color-bad)", ring: "color-mix(in srgb, var(--color-bad) 40%, transparent)" },
  "N/A": {
    bg: "var(--color-ink-border)",
    fg: "var(--color-text-low)",
    ring: "color-mix(in srgb, var(--color-text-low) 40%, transparent)",
  },
};

export function GradeBadge({ grade, size = "md" }: { grade: Grade; size?: "sm" | "md" | "lg" }) {
  const s = GRADE_STYLES[grade];
  const dims =
    size === "lg" ? "size-16 text-3xl" : size === "sm" ? "size-8 text-xs" : "size-11 text-lg";
  const label = grade === "N/A" ? "—" : grade;
  return (
    <span
      className={`tabular inline-flex ${dims} shrink-0 items-center justify-center rounded-2xl font-display font-bold ring-1`}
      style={{ background: s.bg, color: s.fg, boxShadow: `0 0 0 1px ${s.ring}` }}
      aria-label={grade === "N/A" ? "Not enough data to grade" : `Grade ${grade}`}
    >
      {label}
    </span>
  );
}
