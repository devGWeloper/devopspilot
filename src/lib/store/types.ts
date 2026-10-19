import type { HistoryEntry, HistoryTarget, Project, UserRecord } from "../types";

export type MeasKind = "EFFORT" | "CONF" | "AIUSE" | "NOTE";

export interface MeasRow {
  datId: string;
  kind: MeasKind;
  prjId: string;
  reqId: string | null;
  workDt: string | null;
  userId: string | null;
  srcCd: string;
  data: unknown;
  regUserId: string;
  regAt: string;
  updAt: string;
}

export interface HistoryFilter {
  targetTyp?: HistoryTarget;
  targetId?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface ConfigValue<T> {
  value: T;
  verNo: number;
  updAt: string;
  updUserId: string;
}

export interface Store {
  kind: "oracle" | "json";
  users: {
    list(): Promise<UserRecord[]>;
    get(id: string): Promise<UserRecord | null>;
    insert(u: UserRecord): Promise<void>;
    update(id: string, patch: Partial<UserRecord>): Promise<void>;
  };
  projects: {
    list(): Promise<Project[]>;
    get(id: string): Promise<Project | null>;
    insert(p: Project): Promise<void>;
    update(p: Project, expectedUpdAt: string): Promise<boolean>;
    remove(id: string): Promise<void>;
    nextId(): Promise<string>;
  };
  config: {
    get<T>(key: string): Promise<ConfigValue<T> | null>;
    set(key: string, value: unknown, verNo: number, userId: string): Promise<void>;
  };
  history: {
    add(e: Omit<HistoryEntry, "histId">): Promise<void>;
    list(f: HistoryFilter): Promise<HistoryEntry[]>;
  };
  meas: {
    get(datId: string): Promise<MeasRow | null>;
    listAll(kind?: MeasKind): Promise<MeasRow[]>;
    upsert(rows: MeasRow[]): Promise<void>;
    remove(datId: string): Promise<void>;
  };
}

export class DuplicateKeyError extends Error {
  constructor(key: string) {
    super(`DUPLICATE: ${key}`);
    this.name = "DuplicateKeyError";
  }
}

export function formatPrjId(n: number): string {
  return `PRJ-${String(n).padStart(4, "0")}`;
}

export function prjNumber(id: string): number {
  const m = /^PRJ-(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

export function filterHistory(rows: HistoryEntry[], f: HistoryFilter): HistoryEntry[] {
  return rows
    .filter(
      (h) =>
        (!f.targetTyp || h.targetTyp === f.targetTyp) &&
        (!f.targetId || h.targetId === f.targetId) &&
        (!f.userId || h.userId === f.userId) &&
        (!f.from || h.regAt >= f.from) &&
        (!f.to || h.regAt <= f.to),
    )
    .sort((a, b) => b.histId - a.histId)
    .slice(0, f.limit ?? 200);
}
