import rawMps from "./mps-merged.json";

export type Grade = "A" | "B" | "C" | "D" | "F" | "N/A";

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

// Deterministic hash so the same party always gets the same colour across
// sessions/builds, without maintaining a hand-curated list for 30+ parties.
function partyColor(party: string): string {
  let hash = 0;
  for (let i = 0; i < party.length; i++) {
    hash = (hash << 5) - hash + party.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 46%)`;
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

export function utilizationPct(mp: MP): number | null {
  return mp.fundsUtilizationPct !== null ? Math.round(mp.fundsUtilizationPct) : null;
}
