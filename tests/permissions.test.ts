import { describe, it, expect } from "vitest";
import { can, canAccessPath, homePathFor, reviewSide, type Action } from "@/lib/auth/permissions";
import { ROLES, type ProjectStatus, type Role } from "@/lib/types";

const me = (role: Role, userId = "u1") => ({ userId, role });
const prj = (status: ProjectStatus, pmUserId = "u1") => ({ project: { status, pmUserId } });

describe("can — 관리 행위", () => {
  const adminOnly: Action[] = [
    "project.status",
    "project.confirm",
    "criteria.manage",
    "codes.manage",
    "users.manage",
    "history.view",
    "ai.use",
    "measure.settings",
  ];
  it.each(ROLES)("%s", (role) => {
    for (const a of adminOnly) expect(can(me(role), a)).toBe(role === "AX_ADMIN");
  });
});

describe("can — 과제", () => {
  it("과제 등록은 AX 관리자와 PM", () => {
    expect(ROLES.filter((r) => can(me(r), "project.create"))).toEqual(["AX_ADMIN", "PM"]);
  });
  it("PM 은 본인 작성중·보완요청 과제만 편집", () => {
    expect(can(me("PM"), "project.edit", prj("DRAFT"))).toBe(true);
    expect(can(me("PM"), "project.edit", prj("SUPPLEMENT"))).toBe(true);
    expect(can(me("PM"), "project.edit", prj("SUBMITTED"))).toBe(false);
    expect(can(me("PM"), "project.edit", prj("DRAFT", "other"))).toBe(false);
  });
  it("PM 편집은 과제 문맥 없으면 거부", () => {
    expect(can(me("PM"), "project.edit")).toBe(false);
  });
  it("AX 관리자는 상태와 무관하게 편집", () => {
    expect(can(me("AX_ADMIN"), "project.edit", prj("SELECTED", "other"))).toBe(true);
  });
  it("제출은 PM 본인 작성중·보완요청만, AX 관리자도 대리 제출 가능", () => {
    expect(can(me("PM"), "project.submit", prj("DRAFT"))).toBe(true);
    expect(can(me("PM"), "project.submit", prj("REVIEW"))).toBe(false);
    expect(can(me("AX_ADMIN"), "project.submit", prj("DRAFT", "x"))).toBe(true);
    expect(can(me("AX_ADMIN"), "project.submit", prj("REVIEW", "x"))).toBe(false);
  });
  it("HX 는 편집 불가, 의견 가능", () => {
    expect(can(me("HX_REVIEWER"), "project.edit", prj("DRAFT"))).toBe(false);
    expect(can(me("HX_REVIEWER"), "project.review")).toBe(true);
    expect(can(me("PM"), "project.review")).toBe(false);
  });
  it("열람자는 엑셀 불가, 나머지는 가능", () => {
    expect(ROLES.filter((r) => !can(me(r), "export"))).toEqual(["VIEWER"]);
  });
});

describe("can — 측정", () => {
  const feat = (devUserId: string | null) => ({ feature: { devUserId } });
  it("기능 등록은 본인 과제 PM, 선정 과제만", () => {
    expect(can(me("PM"), "measure.feature", prj("SELECTED"))).toBe(true);
    expect(can(me("PM"), "measure.feature", prj("REVIEW"))).toBe(false);
    expect(can(me("PM"), "measure.feature", prj("SELECTED", "x"))).toBe(false);
  });
  it("공수는 담당 개발자만, 선정 과제만", () => {
    expect(can(me("DEVELOPER"), "measure.effort", { ...prj("SELECTED", "pm"), ...feat("u1") })).toBe(true);
    expect(can(me("DEVELOPER"), "measure.effort", { ...prj("SELECTED", "pm"), ...feat("u2") })).toBe(false);
    expect(can(me("DEVELOPER"), "measure.effort", { ...prj("REVIEW", "pm"), ...feat("u1") })).toBe(false);
    expect(can(me("PM"), "measure.effort", { ...prj("SELECTED"), ...feat("u1") })).toBe(false);
  });
  it("결함은 테스트 수행자, 선정 과제만", () => {
    expect(can(me("TESTER"), "measure.defect", prj("SELECTED", "x"))).toBe(true);
    expect(can(me("TESTER"), "measure.defect", prj("DRAFT", "x"))).toBe(false);
    expect(can(me("DEVELOPER"), "measure.defect", prj("SELECTED", "x"))).toBe(false);
  });
  it("업로드 권한", () => {
    expect(can(me("DEVELOPER"), "measure.upload.usage", prj("SELECTED", "x"))).toBe(true);
    expect(can(me("PM"), "measure.upload.commit", prj("SELECTED"))).toBe(true);
    expect(can(me("PM"), "measure.upload.commit", prj("SELECTED", "x"))).toBe(false);
    expect(can(me("HX_REVIEWER"), "measure.upload.usage", prj("SELECTED", "x"))).toBe(false);
  });
  it("측정 코멘트는 AX·HX", () => {
    expect(ROLES.filter((r) => can(me(r), "measure.comment"))).toEqual(["AX_ADMIN", "HX_REVIEWER"]);
  });
});

describe("canAccessPath", () => {
  it("관리 화면은 AX 관리자만", () => {
    expect(canAccessPath("PM", "/admin/users")).toBe(false);
    expect(canAccessPath("HX_REVIEWER", "/admin")).toBe(false);
    expect(canAccessPath("AX_ADMIN", "/admin/criteria")).toBe(true);
  });
  it("관리 API 도 막는다", () => {
    expect(canAccessPath("PM", "/api/admin/users")).toBe(false);
  });
  it("/administrator 같은 유사 경로는 /admin 규칙에 걸리지 않는다", () => {
    expect(canAccessPath("PM", "/administrator")).toBe(true);
  });
  it("오늘 공수 입력", () => {
    expect(canAccessPath("DEVELOPER", "/today")).toBe(true);
    expect(canAccessPath("HX_REVIEWER", "/today")).toBe(false);
  });
  it("데이터 수집·점검", () => {
    expect(canAccessPath("VIEWER", "/collect")).toBe(false);
    expect(canAccessPath("DEVELOPER", "/collect")).toBe(true);
    expect(canAccessPath("DEVELOPER", "/check")).toBe(false);
    expect(canAccessPath("PM", "/check")).toBe(true);
  });
  it("일반 화면은 전원", () => {
    for (const r of ROLES) {
      expect(canAccessPath(r, "/")).toBe(true);
      expect(canAccessPath(r, "/projects/PRJ-0001")).toBe(true);
      expect(canAccessPath(r, "/measure")).toBe(true);
    }
  });
});

describe("homePathFor / reviewSide", () => {
  it("역할별 첫 화면", () => {
    expect(homePathFor("DEVELOPER")).toBe("/today");
    expect(homePathFor("TESTER")).toBe("/defects");
    expect(homePathFor("PM")).toBe("/");
  });
  it("의견 측은 역할 기준", () => {
    expect(reviewSide({ ...me("AX_ADMIN"), orgCd: "SKAX" })).toBe("AX");
    expect(reviewSide({ ...me("HX_REVIEWER"), orgCd: "SKHYNIX" })).toBe("HX");
    expect(reviewSide({ ...me("PM"), orgCd: "SKAX" })).toBeNull();
  });
});
