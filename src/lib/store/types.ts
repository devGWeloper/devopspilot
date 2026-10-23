import type { HistoryEntry, HistoryTarget, Project, Role, UserRecord } from "../types";

export type MeasKind = "EFFORT" | "CONF" | "AIUSE" | "NOTE" | "VOC";

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

// 10/15 역할 개편 전 코드가 저장소에 남아 있으면 세션 검증에서 거부돼 로그인 직후 로그인 화면으로 되돌아온다.
// 관리자 외에는 권한이 커지지 않게 열람자로 내리고, 테스트 담당만 TS 단계 공수를 넣도록 개발자로 둔다.
const LEGACY_ROLE: Record<string, Role> = { AX_ADMIN: "ADMIN", HX_REVIEWER: "VIEWER", PM: "VIEWER", TESTER: "DEVELOPER" };

/** 계정 항목이 늘기 전에 저장된 행도 같은 모양으로 */
export function normalizeUser(u: UserRecord): UserRecord {
  return { ...u, role: LEGACY_ROLE[u.role] ?? u.role, hqNm: u.hqNm ?? "", aiAcct: u.aiAcct ?? "", deptNm: u.deptNm ?? "" };
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
