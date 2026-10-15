import { describe, it, expect } from "vitest";
import { mergeImport, validateStages } from "@/lib/projects/service";
import { parseGrid, parseWorkType } from "@/lib/projects/xlsxImport";
import type { UserRecord } from "@/lib/types";
import { admin, mkProject, mkReq, mkStage } from "./helpers";

const HEAD = ["No", "PRJ-01\n과제명", "PRJ-02\n대상 시스템명", "PRJ-03\n담당", "PRJ-05\n작성자 (PM)", "REQ-01\n요구사항 ID", "REQ-02\n요구사항명", "REQ-03\n대표 업무 유형", "REQ-04\n구현 난이도", "REQ-05\n필요 개발자 등급", "REQ-06\n기준 공수 (M/D)", "REQ-07\n공수 출처", "AIS-02\nAI 도구", "REF-01\n참여 인력 (AX)"];
const grid = (...rows: string[][]) => [["AI PoC 과제 선정"], ["① 과제"], HEAD, HEAD.map((_, i) => (i ? "필수" : "")), ["예시 1", "", "smartMES", "MES", "홍길동", "REQ-0012", "x", "개발 · UI 개발", "하", "중급", "2", "WBS 실적", "Claude Code", "김개발"], ...rows];
const row = (prj: string, req: string, wt = "개발 · 인터페이스·연계", md = "5.5", staff = "박개발, 최개발") => ["1", prj, "FAB MOS", "MES", "이영희", req, `${req} 이름`, wt, "상", "고급", md, "공수 산정서", "Claude Code", staff];

describe("parseGrid", () => {
  it("머리글을 찾아 항목 ID 로 열을 맞추고, 예시·필수 줄은 건너뛴다", () => {
    const r = parseGrid(grid(row("설비 수신", "REQ-0047"), ["", "", "", "", "", "", "", "", "", "", "", "", "", ""]));
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ reqId: "REQ-0047", stage: "DV", workType: "인터페이스·연계", baseMd: 5.5, staff: ["박개발", "최개발"] });
    expect(r.rows[0].prj).toMatchObject({ prjNm: "설비 수신", sysNm: "FAB MOS", deptCd: "MES", pmNm: "이영희" });
    expect(r.rows[0].extra).toEqual({ "AIS-02": "Claude Code", "REF-01": "박개발, 최개발" });
  });

  it("업무 유형·기준 공수 오류와 ID 중복을 행 번호와 함께 알린다", () => {
    const r = parseGrid(grid(row("a", "REQ-1", "개발-UI"), row("a", "REQ-2", "개발 · UI 개발", "두개"), row("a", "REQ-3"), row("b", "REQ-3")));
    expect(r.errors.map((e) => e.rowNo)).toEqual([6, 7, 9]);
  });

  it("머리글이 없으면 오류", () => {
    expect(parseGrid([["x"]]).errors[0].message).toContain("머리글");
  });

  it("parseWorkType", () => {
    expect(parseWorkType("설계 · DB 설계")).toEqual({ stage: "DS", workType: "DB 설계" });
    expect(parseWorkType("운영 · 장애 분석·조치")).toEqual({ stage: "OP", workType: "장애 분석·조치" });
    expect(parseWorkType("기타 · x")).toBeNull();
  });
});

describe("mergeImport", () => {
  const users = [{ userId: "dev02", userNm: "박개발", useYn: true }] as UserRecord[];
  let n = 2;
  const next = () => `PRJ-${String(n++).padStart(4, "0")}`;

  it("새 과제·요구사항 생성, 담당은 이름으로 계정 연결", () => {
    const { rows } = parseGrid(grid(row("설비 수신", "REQ-0047"), row("설비 수신", "REQ-0048", "테스트 · 단위 테스트", "1", "모르는사람")));
    const m = mergeImport([], rows, users, admin, next);
    expect(m.summary).toMatchObject({ projectsNew: 1, reqsNew: 2, unknownOwners: ["모르는사람"] });
    const p = m.projects[0];
    expect(p.reqs[0].stages[0]).toMatchObject({ cd: "DV", ownerId: "dev02", baseMd: 5.5 });
    expect(p.reqs[1].stages[0]).toMatchObject({ cd: "TS", ownerId: null, ownerNm: "모르는사람" });
  });

  it("다시 올리면 정보만 갱신하고 화면에서 나눈 단계는 유지", () => {
    const exist = mkProject({ prjNm: "설비 수신", reqs: [mkReq({ reqId: "REQ-0047", name: "옛 이름", stages: [mkStage({ cd: "AN" }), mkStage({ cd: "DV" })] })] });
    const m = mergeImport([exist], parseGrid(grid(row("설비 수신", "REQ-0047"))).rows, users, admin, next);
    expect(m.summary).toMatchObject({ projectsUpdated: 1, reqsUpdated: 1, reqsNew: 0 });
    expect(m.projects[0].reqs[0].name).toBe("REQ-0047 이름");
    expect(m.projects[0].reqs[0].stages.map((s) => s.cd)).toEqual(["AN", "DV"]);
  });

  it("다른 과제에 있는 요구사항 ID 는 오류", () => {
    const exist = mkProject({ prjNm: "다른 과제", reqs: [mkReq({ reqId: "REQ-0047" })] });
    expect(mergeImport([exist], parseGrid(grid(row("설비 수신", "REQ-0047"))).rows, users, admin, next).errors).toHaveLength(1);
  });
});

it("validateStages: 중복 단계·없는 계정·음수 거부, 단계 순 정렬", () => {
  const users = [{ userId: "dev01", userNm: "김개발" }] as UserRecord[];
  expect(validateStages([], users).ok).toBe(false);
  expect(validateStages([{ cd: "DV", workType: "", ownerId: null, baseMd: 1 }, { cd: "DV", workType: "", ownerId: null, baseMd: 1 }], users).ok).toBe(false);
  expect(validateStages([{ cd: "DV", workType: "", ownerId: "nobody", baseMd: 1 }], users).ok).toBe(false);
  expect(validateStages([{ cd: "DV", workType: "", ownerId: null, baseMd: -1 }], users).ok).toBe(false);
  const ok = validateStages([{ cd: "TS", workType: "", ownerId: null, baseMd: 1 }, { cd: "AN", workType: "", ownerId: "dev01", baseMd: 1 }], users);
  expect(ok.ok && ok.value.map((s) => [s.cd, s.ownerNm])).toEqual([["AN", "김개발"], ["TS", ""]]);
});
