import { hashPassword } from "../auth/password";
import { defaultCodes, defaultCriteria } from "../criteria/defaults";
import { sampleProjects } from "../criteria/samples";
import type { Criteria, OrgCd, Role, UserRecord } from "../types";
import type { Store } from "./types";

export const SEED_ADMIN = { userId: "admin", password: "admin123!" };
export const DEMO_PASSWORD = "demo1234!";

const DEMO_USERS: [string, string, OrgCd, string, Role][] = [
  ["hx01", "이현우", "SKHYNIX", "DT추진팀", "HX_REVIEWER"],
  ["pm01", "김지훈", "SKAX", "제조DT팀", "PM"],
  ["pm02", "박서연", "SKAX", "경영DT팀", "PM"],
  ["dev01", "최민준", "SKAX", "제조DT팀", "DEVELOPER"],
  ["dev02", "정다은", "SKAX", "경영DT팀", "DEVELOPER"],
  ["qa01", "한예린", "SKAX", "품질보증팀", "TESTER"],
  ["view01", "오세훈", "SKHYNIX", "IT기획팀", "VIEWER"],
];

function user(userId: string, userNm: string, orgCd: OrgCd, deptNm: string, role: Role, pwd: string, now: string): UserRecord {
  const { hash, salt } = hashPassword(pwd);
  return { userId, userNm, orgCd, deptNm, role, useYn: true, pwdHash: hash, pwdSalt: salt, lastLoginAt: null, regAt: now, updAt: now };
}

export async function ensureSeed(store: Store, opts: { samples: boolean }): Promise<void> {
  const now = new Date().toISOString();
  const users = await store.users.list();
  if (users.length === 0) {
    await store.users.insert(user(SEED_ADMIN.userId, "AX 관리자", "SKAX", "AI혁신팀", "AX_ADMIN", SEED_ADMIN.password, now));
  }

  let criteria = (await store.config.get<Criteria>("CRITERIA"))?.value;
  if (!criteria) {
    criteria = { ...defaultCriteria(), publishedAt: now, publishedBy: SEED_ADMIN.userId };
    await store.config.set("CRITERIA", criteria, criteria.version, SEED_ADMIN.userId);
    await store.config.set(`CRITERIA@${criteria.version}`, criteria, criteria.version, SEED_ADMIN.userId);
  }
  if (!(await store.config.get("CODES"))) {
    await store.config.set("CODES", defaultCodes(), 1, SEED_ADMIN.userId);
  }

  if (!opts.samples) return;
  // 운영 DB 에 데모 계정이 생기면 안 되므로 샘플은 과제가 하나도 없을 때(첫 기동)만 넣는다.
  if ((await store.projects.list()).length > 0) return;
  const existing = new Set((await store.users.list()).map((u) => u.userId));
  for (const [id, nm, org, dept, role] of DEMO_USERS) {
    if (!existing.has(id)) await store.users.insert(user(id, nm, org, dept, role, DEMO_PASSWORD, now));
  }
  for (const p of sampleProjects(criteria, now)) await store.projects.insert(p);
}
