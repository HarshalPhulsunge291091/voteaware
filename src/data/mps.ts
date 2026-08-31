import rawMps from "./mps-merged.json";
import { partyColor } from "./party-colors";

export type Grade = "A" | "B" | "C" | "D" | "F" | "N/A";

export interface Candidate {
  candidateId: number;
  sourceUrl: string;
  name: string;
  isWinner: boolean;
  party: string | null;
  criminalCases: number;
  education: string | null;
  age: number | null;
  totalAssetsRs: number | null;
  liabilitiesRs: number | null;
}

interface MergedRecord {
  id: string;
  name: string;
  constituency: string;
  state: string;
  party: string;
  status: string | null;
  termsServed: string | null;
  attendancePct: number | null;
  debates: number | null;
  questions: number | null;
  privateMemberBills: number | null;
  prsSourceUrl: string | null;
  criminalCases: number | null;
  education: string | null;
  totalAssetsRs: number | null;
  liabilitiesRs: number | null;
  mynetaSourceUrl: string | null;
  fundsDataTerm: string | null;
  fundsEntitledCr: number | null;
  fundsReceivedCr: number | null;
  fundsSpentCr: number | null;
  fundsUnspentCr: number | null;
  fundsUtilizationPct: number | null;
}

export interface MP extends MergedRecord {
  partyColor: string;
  photoInitials: string;
  grade: Grade;
  gradeNote: string;
}

function photoInitials(name: string): string {
  const words = name.replace(/[.,]/g, "").split(/\s+/).filter(Boolean);
  const letters = [words[0]?.[0], words[words.length - 1]?.[0]].filter(Boolean);
  return letters.join("").toUpperCase() || "MP";
}

function scoreToGrade(score: number): Grade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

// Grades from whichever of the two real signals are actually available for
// this MP (PRS attendance, MPLADS utilization) — never fabricated for MPs
// with no matching source data.
function computeGrade(mp: MergedRecord): { grade: Grade; gradeNote: string } {
  const signals: number[] = [];
  if (mp.attendancePct !== null) signals.push(mp.attendancePct);
  if (mp.fundsUtilizationPct !== null) signals.push(Math.min(100, mp.fundsUtilizationPct));

  if (signals.length === 0) {
    return {
      grade: "N/A",
      gradeNote:
        "No public attendance or MPLADS utilization record matched this constituency yet — not enough data to grade.",
    };
  }

  const score = signals.reduce((a, b) => a + b, 0) / signals.length;
  const grade = scoreToGrade(score);

  const parts: string[] = [];
  if (mp.attendancePct !== null) parts.push(`attended ${mp.attendancePct}% of sittings (PRS)`);
  if (mp.fundsUtilizationPct !== null) {
    parts.push(
      `used ${mp.fundsUtilizationPct.toFixed(0)}% of released MPLADS funds (${mp.fundsDataTerm ?? "term unknown"})`,
    );
  } else {
    parts.push("no MPLADS fund record matched for this constituency");
  }

  return { grade, gradeNote: `Based on public records: ${parts.join("; ")}.` };
}

export const MPS: MP[] = (rawMps as MergedRecord[]).map((mp) => {
  const { grade, gradeNote } = computeGrade(mp);
  return {
    ...mp,
    partyColor: partyColor(mp.party),
    photoInitials: photoInitials(mp.name),
    grade,
    gradeNote,
  };
});

export function getMPById(id: string): MP | undefined {
  return MPS.find((mp) => mp.id === id);
}

export function gradeColor(grade: Grade): string {
  switch (grade) {
    case "A":
    case "B":
      return "var(--color-good)";
    case "C":
      return "var(--color-warn)";
    case "D":
    case "F":
      return "var(--color-bad)";
    case "N/A":
      return "var(--color-text-low)";
  }
}

export function unspentCr(mp: MP): number {
  return mp.fundsUnspentCr ?? 0;
}

/**
 * Constituency name with a redundant trailing "(State)" trimmed for display —
 * some source names carry it ("Tripura East (ST) (Tripura)"), which then reads
 * twice wherever the state is shown alongside. Only an exact match on the
 * given state is removed, so meaningful parentheticals like the (SC)/(ST)
 * reservation markers survive. Display only; the stored record is untouched.
 */
export function constituencyLabel(constituency: string, state: string): string {
  const suffix = ` (${state})`;
  return constituency.endsWith(suffix) ? constituency.slice(0, -suffix.length) : constituency;
}

/**
 * The source's own reported utilisation figure — spending measured against
 * funds *released*, not against entitlement. Passed through untouched.
 */
export function utilizationPct(mp: MP): number | null {
  return mp.fundsUtilizationPct !== null ? Math.round(mp.fundsUtilizationPct) : null;
}

/**
 * How much of the MP's full MPLADS entitlement actually got spent.
 *
 * This is the figure a voter is really asking about — "of the money meant for
 * my constituency, how much became something?" — and it is computed here from
 * two numbers in the same source row, so the arithmetic is exact.
 *
 * Deliberately NOT derived from the source's `fundsUtilizationPct`, and not
 * interchangeable with it. Those columns do not reconcile with each other:
 * `unspent` equals `received − spent` for only 3 of 511 records, and the
 * reported utilisation matches `spent/received` for only 71 of 511 — the
 * figures appear to cover different accounting windows (carry-over balances,
 * interest, and releases conditional on utilisation certificates). Only
 * entitled-vs-spent divides cleanly, which is why it is the one ratio this
 * app computes itself. Keep the two labelled distinctly in the UI.
 *
 * Across the 508 MPs with both figures: median 44%, range 0–102%.
 */
export function spentPctOfEntitlement(mp: MP): number | null {
  if (mp.fundsEntitledCr === null || mp.fundsSpentCr === null || mp.fundsEntitledCr <= 0) {
    return null;
  }
  return Math.round((mp.fundsSpentCr / mp.fundsEntitledCr) * 100);
}

// Candidates (winner + everyone who lost, per constituency) live in their
// own file, not embedded per-MP in mps-merged.json — 7,441 records across
// 463 constituencies would otherwise bloat the eagerly-loaded bundle every
// page pays for. Loaded on demand, only when an MP's page is opened.
export async function loadCandidates(mpId: string): Promise<Candidate[]> {
  const all = (await import("./mp-candidates.json")).default as Record<string, Candidate[]>;
  return all[mpId] ?? [];
}
