import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import type { ActorFull } from "@/lib/auth/permissions";
import { defaultCriteria } from "@/lib/criteria/defaults";
import {
  addReview,
  changeStatus,
  confirmFit,
  createProject,
  reevaluateAll,
  submitProject,
  toView,
  updateProject,
  type ProjectInput,
} from "@/lib/projects/service";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { Store } from "@/lib/store/types";
import type { Criteria, Level, UserRecord } from "@/lib/types";
import { filledBase } from "./helpers";

const admin: ActorFull = { userId: "admin", role: "AX_ADMIN", userNm: "AX 관리자", orgCd: "SKAX" };
const pm: ActorFull = { userId: "pm01", role: "PM", userNm: "김지훈", orgCd: "SKAX" };
const pm2: ActorFull = { userId: "pm02", role: "PM", userNm: "박서연", orgCd: "SKAX" };
const hx: ActorFull = { userId: "hx01", role: "HX_REVIEWER", userNm: "이현우", orgCd: "SKHYNIX" };

const crit = defaultCriteria();
const majors = crit.areas.flatMap((a) => a.indicators).filter((i) => i.tier === "MAJOR");
const allH = () => Object.fromEntries(crit.areas.flatMap((a) => a.indicators).map((i) => [i.id, i.options.find((o) => o.level === "H")!.id]));

function input(over: Partial<ProjectInput> = {}): ProjectInput {
  return {
    prjNm: "테스트 과제",
    sysNm: "SYS",
    base: filledBase(),
    answers: allH(),
    notes: {},
    ...over,
  };
}

function user(userId: string, role: UserRecord["role"]): UserRecord {
  return { userId, userNm: userId, orgCd: "SKAX", deptNm: "", role, useYn: true, pwdHash: "x", pwdSalt: "y", lastLoginAt: null, regAt: "", updAt: "" };
}

let store: Store;
beforeEach(async () => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-svc-")));
  await ensureSeed(store, { samples: false });
  await store.users.insert({ ...user("pm01", "PM"), userNm: "김지훈" });
  await store.users.insert(user("pm02", "PM"));
});

async function created(actor = pm, over: Partial<ProjectInput> = {}) {
  const r = await createProject(store, actor, input(over));
  if (!r.ok) throw new Error(r.message);
  return r.value;
}

describe("createProject", () => {
  it("PM 이 만들면 PM 은 본인, 작성중, 제안 적합도 계산", async () => {
    const p = await created(pm, { pmUserId: "pm02" });
    expect(p).toMatchObject({ prjId: "PRJ-0001", pmUserId: "pm01", pmUserNm: "김지훈", status: "DRAFT", suggestFit: "H", finalFit: "NA" });
  });

  it("AX 관리자는 PM 을 지정해야 한다", async () => {
    const r = await createProject(store, admin, input());
    expect(r.ok).toBe(false);
    const ok = await createProject(store, admin, input({ pmUserId: "pm02" }));
    expect(ok.ok && ok.value.pmUserId).toBe("pm02");
  });

  it("PM 역할이 아닌 사람을 PM 으로 지정할 수 없다", async () => {
    const r = await createProject(store, admin, input({ pmUserId: "admin" }));
    expect(r).toMatchObject({ ok: false, status: 422 });
  });

  it("HX 는 등록 불가", async () => {
    expect(await createProject(store, hx, input())).toMatchObject({ ok: false, status: 403 });
  });

  it("과제명이 비면 422", async () => {
    expect(await createProject(store, pm, input({ prjNm: "  " }))).toMatchObject({ ok: false, status: 422 });
  });

  it("이력이 남는다", async () => {
    await created();
    expect((await store.history.list({ targetId: "PRJ-0001" }))[0].actionCd).toBe("CREATE");
  });
});

describe("updateProject", () => {
  it("남의 과제는 403", async () => {
    const p = await created(pm);
    expect(await updateProject(store, pm2, p.prjId, input(), p.updAt)).toMatchObject({ ok: false, status: 403 });
  });

  it("제출된 과제는 PM 이 고칠 수 없다", async () => {
    const p = await created(pm);
    const s = await submitProject(store, pm, p.prjId, p.updAt);
    if (!s.ok) throw new Error(s.message);
    expect(await updateProject(store, pm, p.prjId, input(), s.value.updAt)).toMatchObject({ ok: false, status: 403 });
  });

  it("updAt 이 다르면 409 이고 덮어쓰지 않는다", async () => {
    const p = await created(pm);
    const r = await updateProject(store, pm, p.prjId, input({ prjNm: "바뀜" }), "2000-01-01T00:00:00.000Z");
    expect(r).toMatchObject({ ok: false, status: 409, code: "CONFLICT" });
    expect((await store.projects.get(p.prjId))?.prjNm).toBe("테스트 과제");
  });

  it("응답을 바꾸면 제안 적합도 갱신, 사라진 지표 응답은 버린다", async () => {
    const p = await created(pm);
    const answers = allH();
    answers[majors[0].id] = majors[0].options.find((o) => o.level === "L")!.id;
    answers[majors[1].id] = majors[1].options.find((o) => o.level === "L")!.id;
    answers.ghost = "x";
    const r = await updateProject(store, pm, p.prjId, input({ answers }), p.updAt);
    expect(r.ok && r.value.suggestFit).toBe("L");
    expect(r.ok && r.value.eval.answers.ghost).toBeUndefined();
  });

  it("없는 과제는 404", async () => {
    expect(await updateProject(store, admin, "PRJ-9999", input(), "x")).toMatchObject({ ok: false, status: 404 });
  });
});

describe("submitProject", () => {
  it("Major 미응답이면 422 와 필드 목록", async () => {
    const answers = allH();
    delete answers[majors[0].id];
    const p = await created(pm, { answers });
    const r = await submitProject(store, pm, p.prjId, p.updAt);
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(!r.ok && JSON.stringify(r.details)).toContain(majors[0].id);
  });

  it("Minor 지표·양식 필수 항목·실적도 비면 422", async () => {
    const answers = allH();
    const minor = crit.areas.flatMap((a) => a.indicators).find((i) => i.tier === "MINOR")!;
    delete answers[minor.id];
    const base = { ...input().base, sysGradeCd: "", pmFitReason: "", aiAccounts: null, baseline: { ...input().base.baseline, totalMm: null } };
    const p = await created(pm, { answers, base });
    const r = await submitProject(store, pm, p.prjId, p.updAt);
    const fields = !r.ok ? (r.details as { field: string }[]).map((d) => d.field) : [];
    expect(fields).toEqual(expect.arrayContaining([`answer.${minor.id}`, "sysGradeCd", "pmFitReason", "aiAccounts", "baseline.totalMm"]));
  });

  it("WBS 실적 없음이면 기간·총 공수 없이 제출, 기타 선택 시 비고 필수", async () => {
    const base = { ...input().base, aiToolCd: "ETC", baseline: { ...input().base.baseline, startDate: null, endDate: null, totalMm: null } };
    const p = await created(pm, { base, answers: { ...allH(), wbs: "no" } });
    const r = await submitProject(store, pm, p.prjId, p.updAt);
    const fields = !r.ok ? (r.details as { field: string }[]).map((d) => d.field) : [];
    expect(fields).toEqual(["remark"]);
    const p2 = await updateProject(store, pm, p.prjId, input({ base: { ...base, remark: "사내 도구 X" }, answers: { ...allH(), wbs: "no" } }), p.updAt);
    expect(p2.ok).toBe(true);
    const r2 = await submitProject(store, pm, p.prjId, p2.ok ? p2.value.updAt : "");
    expect(r2.ok && r2.value.status).toBe("SUBMITTED");
  });

  it("필수값이 차면 제출", async () => {
    const p = await created(pm);
    const r = await submitProject(store, pm, p.prjId, p.updAt);
    expect(r.ok && r.value.status).toBe("SUBMITTED");
  });
});

describe("changeStatus", () => {
  it("보완요청은 사유 필수", async () => {
    const p = await created(pm);
    const s1 = await submitProject(store, pm, p.prjId, p.updAt);
    const s2 = s1.ok ? await changeStatus(store, admin, p.prjId, "REVIEW", null, s1.value.updAt) : s1;
    if (!s2.ok) throw new Error(s2.message);
    expect(await changeStatus(store, admin, p.prjId, "SUPPLEMENT", " ", s2.value.updAt)).toMatchObject({ ok: false, status: 422 });
    const ok = await changeStatus(store, admin, p.prjId, "SUPPLEMENT", "문서 보완", s2.value.updAt);
    expect(ok.ok && ok.value).toMatchObject({ status: "SUPPLEMENT", statusNote: "문서 보완" });
  });

  it("허용되지 않는 전이는 409", async () => {
    const p = await created(pm);
    expect(await changeStatus(store, admin, p.prjId, "SELECTED", null, p.updAt)).toMatchObject({
      ok: false,
      status: 409,
      code: "INVALID_TRANSITION",
    });
  });

  it("PM 은 상태 변경 불가", async () => {
    const p = await created(pm);
    expect(await changeStatus(store, pm, p.prjId, "REVIEW", null, p.updAt)).toMatchObject({ ok: false, status: 403 });
  });
});

describe("confirmFit", () => {
  it("제안과 다르면 사유 필수, 확정 후 finalFit 반영", async () => {
    const p = await created(pm);
    expect(p.suggestFit).toBe("H");
    expect(await confirmFit(store, admin, p.prjId, "L", "", p.updAt)).toMatchObject({ ok: false, status: 422 });
    const r = await confirmFit(store, admin, p.prjId, "L", "레거시 표본 필요", p.updAt);
    expect(r.ok && r.value.finalFit).toBe("L");
    expect(r.ok && r.value.eval.confirm).toMatchObject({ fit: "L", reason: "레거시 표본 필요", by: "admin" });
  });

  it("제안과 같으면 사유 없이 확정", async () => {
    const p = await created(pm);
    const r = await confirmFit(store, admin, p.prjId, "H" as Level, "", p.updAt);
    expect(r.ok && r.value.finalFit).toBe("H");
  });
});

describe("addReview / toView", () => {
  it("HX 의견은 HX 측으로, 동의 상태 갱신", async () => {
    const p = await created(pm);
    const r = await addReview(store, hx, p.prjId, { agree: "AGREE", text: "좋습니다", context: "SELECTION" });
    expect(r.ok && r.value.hxAgree).toBe("AGREE");
    expect(r.ok && r.value.reviews[0]).toMatchObject({ side: "HX", userId: "hx01", text: "좋습니다" });
  });

  it("PM 은 의견 불가, 빈 의견 불가", async () => {
    const p = await created(pm);
    expect(await addReview(store, pm, p.prjId, { agree: "AGREE", text: "x", context: "SELECTION" })).toMatchObject({ ok: false, status: 403 });
    expect(await addReview(store, hx, p.prjId, { agree: "AGREE", text: " ", context: "SELECTION" })).toMatchObject({ ok: false, status: 422 });
  });

  it("AX 관리자가 아니면 AI 필드를 숨긴다", async () => {
    const p = await created(pm);
    const withAi = { ...p, aiFit: "H" as const, ai: { grade: "H" } as never };
    expect(toView(withAi, hx)).toMatchObject({ ai: null, aiFit: null });
    expect(toView(withAi, admin).aiFit).toBe("H");
  });
});

describe("reevaluateAll", () => {
  it("새 기준에서 지표가 사라지면 응답을 정리하고 확정은 유지, 버전 갱신", async () => {
    const p = await created(pm);
    await confirmFit(store, admin, p.prjId, "H", "", p.updAt);
    const v2: Criteria = {
      ...crit,
      version: 2,
      areas: crit.areas.map((a) => ({ ...a, indicators: a.indicators.filter((i) => i.id !== "tracker") })),
    };
    await store.config.set("CRITERIA", v2, 2, "admin");
    const r = await reevaluateAll(store, admin);
    expect(r.ok && r.value.changed).toBe(1);
    const after = await store.projects.get(p.prjId);
    expect(after).toMatchObject({ critVer: 2, indicatorCnt: 7, finalFit: "H" });
    expect(after?.eval.answers.tracker).toBeUndefined();
  });

  it("관리자만", async () => {
    expect(await reevaluateAll(store, pm)).toMatchObject({ ok: false, status: 403 });
  });
});
