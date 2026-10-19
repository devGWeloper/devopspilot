import { hashPassword } from "../auth/password";
import { defaultSettings, SETTINGS_KEY } from "../measure/defaults";
import { buildIndex, daySnap } from "../measure/metrics";
import { reqKey } from "../measure/units";
import type { OrgCd, Role, UserRecord } from "../types";
import { DEMO_DEVS, sampleData } from "./sampleData";
import type { MeasRow, Store } from "./types";

export const SEED_ADMIN = { userId: "admin", password: "admin123!" };
export const DEMO_PASSWORD = "demo1234!";

function user(userId: string, userNm: string, orgCd: OrgCd, deptNm: string, role: Role, pwd: string, now: string, extra: Partial<UserRecord> = {}): UserRecord {
  const { hash, salt } = hashPassword(pwd);
  return { userId, userNm, orgCd, hqNm: "", deptNm, role, aiAcct: "", useYn: true, pwdHash: hash, pwdSalt: salt, lastLoginAt: null, regAt: now, updAt: now, ...extra };
}

export async function ensureSeed(store: Store, opts: { samples: boolean }): Promise<void> {
  const now = new Date().toISOString();
  if ((await store.users.list()).length === 0) {
    await store.users.insert(user(SEED_ADMIN.userId, "관리자", "SKAX", "AI혁신팀", "ADMIN", SEED_ADMIN.password, now));
  }
  if (!(await store.config.get(SETTINGS_KEY))) await store.config.set(SETTINGS_KEY, defaultSettings(), 1, SEED_ADMIN.userId);

  if (!opts.samples) return;
  // 운영 DB 에 데모 계정이 생기면 안 되므로 샘플은 과제가 하나도 없을 때(첫 기동)만 넣는다.
  if ((await store.projects.list()).length > 0) return;
  const existing = new Set((await store.users.list()).map((u) => u.userId));
  for (const [id, nm, team, hq] of DEMO_DEVS) {
    if (!existing.has(id)) await store.users.insert(user(id, nm, "SKAX", team, "DEVELOPER", DEMO_PASSWORD, now, { hqNm: hq, aiAcct: `${id}@skax.demo` }));
  }
  if (!existing.has("view01")) await store.users.insert(user("view01", "오열람", "SKHYNIX", "IT기획팀", "VIEWER", DEMO_PASSWORD, now));

  const d = sampleData();
  for (const p of d.projects) await store.projects.insert(p);
  const settings = { ...defaultSettings(), measureStart: d.days[0] };
  await store.config.set(SETTINGS_KEY, settings, 1, SEED_ADMIN.userId);

  const sessions = d.sessions.map((s) => ({ ...s, datId: `A|${s.src}|${s.sessionId}|${s.workDt}` }));
  // 확정 스냅샷은 실제 값으로 채워야 '확정 후 값 변경'으로 오인되지 않는다.
  const ix = buildIndex({ projects: d.projects, efforts: d.efforts, confs: [], sessions, settings });
  const reqByKey = new Map(ix.data.projects.flatMap((p) => p.reqs.map((r) => [reqKey(p.prjId, r.reqId), r] as const)));
  const confs = d.confs.map((c) => ({ ...c, snap: daySnap(ix, c.userId, reqByKey.get(reqKey(c.prjId, c.reqId))!, c.workDt) }));

  const base = (datId: string, kind: MeasRow["kind"], x: { prjId?: string; reqId?: string; workDt: string; userId: string }, data: unknown, src: string): MeasRow => ({
    datId,
    kind,
    prjId: x.prjId ?? "-",
    reqId: x.reqId ?? null,
    workDt: x.workDt,
    userId: x.userId,
    srcCd: src,
    data,
    regUserId: x.userId,
    regAt: now,
    updAt: now,
  });
  await store.meas.upsert([
    ...d.efforts.map((e) => base(`E|${e.unit}|${e.workDt}`, "EFFORT", e, e, "MANUAL")),
    ...confs.map((c) => base(`C|${c.userId}|${reqKey(c.prjId, c.reqId)}|${c.workDt}`, "CONF", c, c, "MANUAL")),

    ...sessions.map(({ datId, ...s }) => base(datId, "AIUSE", s, s, s.src)),
  ]);
}
