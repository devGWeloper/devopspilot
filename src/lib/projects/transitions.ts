import type { ProjectStatus } from "../types";

export const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: [],
  SUPPLEMENT: [],
  SUBMITTED: ["REVIEW", "SUPPLEMENT"],
  REVIEW: ["SUPPLEMENT", "SELECTED", "RESERVE", "EXCLUDED"],
  SELECTED: ["REVIEW", "RESERVE", "EXCLUDED"],
  RESERVE: ["REVIEW", "SELECTED", "EXCLUDED"],
  EXCLUDED: ["REVIEW"],
};

const NOTE_REQUIRED: ProjectStatus[] = ["SUPPLEMENT", "EXCLUDED"];

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function noteRequired(to: ProjectStatus): boolean {
  return NOTE_REQUIRED.includes(to);
}
