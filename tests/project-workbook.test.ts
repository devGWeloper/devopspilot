import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { defaultSettings } from "@/lib/measure/defaults";
import { getSettings } from "@/lib/measure/service";
import { mergeWorkbook } from "@/lib/projects/service";
import { buildWorkbook, parseWorkbook, readWorkbookGrids, workbookTables, type SheetKey } from "@/lib/projects/workbook";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { Store } from "@/lib/store/types";
import { importWorkbook } from "@/lib/projects/service";
import { admin, mkProject, mkReq, mkStage, mkUser } from "./helpers";

const none = { prjIds: new Set<string>(), tags: new Set<string>(), userIds: new Set<string>() };
// 원본 엑셀처럼 B2 부터 — 앞 열·줄이 비어 있다
const at = (...rows: string[][]) => [[], ...rows.map((r) => ["", ...r])];

const PRJ = at(
  ["과제 ID", "하이닉스 과제명", "PROMIS 코드", "구분", "대상 시스템명", "하이닉스 담당", "하이닉스 담당 팀", "SK AX 소속 본부", "SK AX 소속 팀", "과제 PM", "시스템 등급", "배포 형식", "과제 영역", "버전 관리 도구", "작업 관리 도구"],
  ["DAE01", "설비 이벤트 수신 고도화", "", "개발", "smartMES", "MES", "FAB MOS", "", "", "홍PM", "L2", "", "", "GitHub", "Jira"],
  ["LMS03", "물류 조회 개선", "", "운영", "smartMES", "MES", "FAB MOS", "", "", "이PM", "L2", "", "", "GitHub", "Jira"],
);
const TAG_HEAD = ["공수 태그", "과제 ID", "요구사항 ID", "단계", "구현 난이도", "필요 개발자 등급", "기준 공수(M/D)", "공수 출처", "측정 상태", "측정 완료일", "예상 기대효과", " 명세 명확성", "맥락 주입 가능성", "생성 패턴"];
const tagRow = (tag: string, prj: string, req: string, st: string, md = "5", status = "완료", doneAt = "2026-11-06") => [tag, prj, req, st, "상", "고급", md, "과거 실적", status, doneAt, "상", "상", "중", "하"];
const TAG = at(TAG_HEAD, tagRow("DAE01-REQ0047-DV", "DAE01", "REQ0047", "DV"), tagRow("DAE01-REQ0047-TS", "DAE01", "REQ0047", "TS", "5", "측정 중", ""));
const MAP = at(
  ["공수 태그 - 개발자 Mapping"],
  ["공수 태그", "사번"],
  ["DAE01-REQ0047-DV", "s1001"],
  ["DAE01-REQ0047-TS", ""],
  [],
  ["개발자 권한 관리"],
  ["사번", "성명", "SK AX 본부", "SK AX 팀", "권한", "AI 도구 계정"],
  ["", "", "", "", "개발자/관리자", "oTel 계정 Key"],
  ["s1001", "김개발", "제조본부", "MES팀", "개발자", "kim@corp.com"],
);
const BASE = at(
  ["인건비 단가 표 "],
  ["등급", "단가(원/MM)", "단가(원/MD)"],
  ["특급", "15,000,000", "750000"],
  ["고급", "", ""],
  [],
  ["토큰 단가 표 "],
  ["모델", "입력 단가(원/1M 토큰)", "캐시 입력 단가(원/1M 토큰)", "출력 단가(원/1M 토큰)"],
  ["gpt-5-codex", "1800", "180", "14000"],
);
const ALL: Partial<Record<SheetKey, string[][]>> = { prj: PRJ, tag: TAG, map: MAP, base: BASE };

describe("parseWorkbook", () => {
  it("원본 양식 5개 시트를 읽는다 (B2 시작, 머리글 앞뒤 공백, 안내 줄 건너뜀)", () => {
    const { data, errors } = parseWorkbook(ALL, none);
    expect(errors).toEqual([]);
    // 예전 양식의 '구분' 열은 있어도 무시한다
    expect(data.projects.map((p) => [p.prjId, p.pmNm, p.sysNm])).toEqual([["DAE01", "홍PM", "smartMES"], ["LMS03", "이PM", "smartMES"]]);
    expect(data.projects[0]).not.toHaveProperty("kind");
    expect(data.tags[0]).toMatchObject({ tag: "DAE01-REQ0047-DV", stage: "DV", baseMd: 5, grade: "고급", done: true, doneAt: "2026-11-06", spec: "상", ctx: "중", gen: "하", name: null });
    expect(data.tags[1]).toMatchObject({ done: false, doneAt: null });
    expect(data.mapping).toEqual([{ rowNo: 4, tag: "DAE01-REQ0047-DV", userId: "s1001" }, { rowNo: 5, tag: "DAE01-REQ0047-TS", userId: "" }]);
    expect(data.devs).toEqual([{ rowNo: 10, userId: "s1001", userNm: "김개발", hqNm: "제조본부", deptNm: "MES팀", role: "DEVELOPER", aiAcct: "kim@corp.com" }]);
    expect(data.grades).toEqual([{ grade: "특급", mm: 15000000, md: 750000 }]);
    expect(data.tokens).toEqual([{ model: "gpt-5-codex", input: 1800, cached: 180, output: 14000 }]);
  });

  it("오류는 시트·행과 함께 모두 알린다", () => {
    const tag = at(TAG_HEAD, tagRow("DAE01-REQ0047-DV", "NOPE", "REQ0047", "DV"), tagRow("X-1-DV", "DAE01", "REQ1", "DV"), tagRow("", "DAE01", "REQ2", "배포"), tagRow("", "DAE01", "REQ3", "AN", "두개"));
    const map = at(["공수 태그", "사번"], ["DAE01-ZZZ-DV", "s9"], [], ["사번", "성명", "SK AX 본부", "SK AX 팀", "권한", "AI 도구 계정"], ["s1", "가", "", "", "팀장", ""]);
    const prj = at(PRJ[1].slice(1), ["DAE-01", "x", "", "개발"], ["DAE01", "", "", "기타"]);
    const { errors } = parseWorkbook({ prj, tag, map }, none);
    const msgs = errors.map((e) => `${e.sheet}:${e.rowNo}:${e.message}`).join("\n");
    expect(msgs).toContain("01. 과제:3:과제 ID 'DAE-01'");
    expect(msgs).toContain("01. 과제:4:하이닉스 과제명이 비어");
    expect(msgs).not.toContain("개발·운영");
    expect(msgs).toContain("02. 요구사항-SDLC:3:과제 ID 'NOPE'");
    expect(msgs).toContain("02. 요구사항-SDLC:4:공수 태그 'X-1-DV'");
    expect(msgs).toContain("02. 요구사항-SDLC:5:단계 '배포' — AN·DS·DV·TS 중 하나");
    expect(msgs).toContain("02. 요구사항-SDLC:6:기준 공수 '두개'");
    expect(msgs).toContain("03. 공수 태그 매핑:3:공수 태그 'DAE01-ZZZ-DV'");
    expect(msgs).toContain("사번 's9'");
    expect(msgs).toContain("권한 '팀장'");
  });

  it("단계는 이름(개발)으로 적어도 되고, 포털에 이미 있는 과제·태그·사번을 참조할 수 있다", () => {
    const tag = at(TAG_HEAD, tagRow("", "OLD01", "R1", "개발"));
    const map = at(["공수 태그", "사번"], ["OLD01-R0-AN", "dev01"]);
    const { data, errors } = parseWorkbook({ tag, map }, { prjIds: new Set(["OLD01"]), tags: new Set(["OLD01-R0-AN"]), userIds: new Set(["dev01"]) });
    expect(errors).toEqual([]);
    expect(data.tags[0].tag).toBe("OLD01-R1-DV");
  });
});

describe("mergeWorkbook", () => {
  it("파일 값으로 갱신하고 없는 행은 그대로, 매핑으로 담당을 정한다", () => {
    const exist = mkProject({ prjId: "DAE01", reqs: [mkReq({ reqId: "REQ0047", name: "수신 로직", stages: [mkStage({ cd: "AN", ownerId: "dev02", ownerNm: "박개발" }), mkStage({ cd: "DV", workType: "인터페이스·연계", ownerId: "dev02", ownerNm: "박개발" })] })] });
    const { data } = parseWorkbook(ALL, none);
    const m = mergeWorkbook([exist], [mkUser("dev02", "박개발")], data, admin, "2026-11-10T00:00:00.000Z");
    const p = m.projects.find((x) => x.prjId === "DAE01")!;
    const r = p.reqs[0];
    expect(r.name).toBe("수신 로직");
    expect(r.stages.map((s) => s.cd)).toEqual(["AN", "DV", "TS"]);
    expect(r.stages[0]).toMatchObject({ ownerId: "dev02" });
    expect(r.stages[1]).toMatchObject({ ownerId: "s1001", ownerNm: "김개발", workType: "인터페이스·연계", grade: "고급", done: true, doneAt: "2026-11-06" });
    expect(r.stages[2]).toMatchObject({ ownerId: null, done: false });
    expect(m.summary).toMatchObject({ projectsNew: 1, projectsUpdated: 1, tagsNew: 1, tagsUpdated: 1, mapped: 2 });
  });
});

describe("importWorkbook · 내보내기 왕복", () => {
  let store: Store;
  beforeEach(async () => {
    store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-wb-")));
    await ensureSeed(store, { samples: false });
  });

  it("내보낸 파일을 다시 올리면 같은 데이터가 된다 · 새 사번은 초기 비밀번호를 한 번 돌려준다", async () => {
    const proj = mkProject({ prjId: "DAE01", reqs: [mkReq({ reqId: "REQ0047", name: "", stages: [mkStage({ cd: "DV", ownerId: "s1001", ownerNm: "김개발", baseMd: 2.5, grade: "특급", done: true, doneAt: "2026-11-06" })] })] });
    const users = [mkUser("admin", "관리자", { role: "ADMIN" }), mkUser("s1001", "김개발", { aiAcct: "kim@corp.com", hqNm: "제조본부" })];
    const settings = { ...defaultSettings(), tokenPrice: { "gpt-5-codex": { input: 1, cached: 0.1, output: 8 } } };
    const buf = await buildWorkbook(workbookTables([proj], users, settings, [], () => "DONE"));

    // 미리보기는 같은 숫자를 보여 주되 아무것도 저장하지 않는다
    const dry = await importWorkbook(store, admin, buf, { dryRun: true });
    expect(dry).toMatchObject({ ok: true, value: { dryRun: true, projectsNew: 1, tagsNew: 1, mapped: 1, usersNew: 1, newProjects: [{ prjId: "DAE01" }], newTags: ["DAE01-REQ0047-DV"], newPasswords: [] } });
    expect(await store.projects.get("DAE01")).toBeNull();
    expect(await store.users.get("s1001")).toBeNull();

    const r = await importWorkbook(store, admin, buf);
    expect(r).toMatchObject({ ok: true, value: { dryRun: false, projectsNew: 1, tagsNew: 1, mapped: 1, usersNew: 1 } });
    if (!r.ok) return;
    expect(r.value.newPasswords.map((x) => x.userId)).toEqual(["s1001"]);
    const p = (await store.projects.get("DAE01"))!;
    expect(p.reqs[0].stages[0]).toMatchObject({ ownerId: "s1001", baseMd: 2.5, grade: "특급", done: true, doneAt: "2026-11-06" });
    expect((await store.users.get("s1001"))).toMatchObject({ aiAcct: "kim@corp.com", hqNm: "제조본부", role: "DEVELOPER" });
    expect((await getSettings(store)).tokenPrice).toEqual(settings.tokenPrice);

    const grids = await readWorkbookGrids(buf);
    expect(Object.keys(grids)).toEqual(["prj", "tag", "map", "base", "logic"]);
  });

  it("오류가 하나라도 있으면 아무것도 저장하지 않는다", async () => {
    const buf = await buildWorkbook({
      prj: [{ head: PRJ[1].slice(1), rows: [["DAE01", "과제"]] }],
      tag: [{ head: TAG_HEAD, rows: [["", "DAE01", "R1", "XX", "", "", 1]] }],
      map: [],
      base: [],
      logic: [],
    });
    expect(await importWorkbook(store, admin, buf)).toMatchObject({ ok: false, code: "INVALID_ROWS" });
    expect(await store.projects.list()).toEqual([]);
  });
});
