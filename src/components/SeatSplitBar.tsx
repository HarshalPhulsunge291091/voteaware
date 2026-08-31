import type { SeatSplitEntry } from "../data/seat-split";

/**
 * A state's seats laid out proportionally, in the same colours as the map.
 * Purely a visual companion to the text split beside it — the numbers are
 * always written out too, so this is aria-hidden rather than a chart a screen
 * reader has to narrate.
 */
export function SeatSplitBar({ split }: { split: SeatSplitEntry[] }) {
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-ink-border)]"
      aria-hidden="true"
    >
      {split.map((entry) => (
        <span
          key={entry.party}
          // flexGrow rather than a percentage width: a single-seat party in a
          // 47-seat state still renders as a visible sliver instead of
          // rounding away to nothing.
          style={{ flexGrow: entry.seats, background: entry.color, minWidth: 2 }}
        />
      ))}
    </div>
  );
}
