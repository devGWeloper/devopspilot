import { describe, it, expect } from "vitest";
import { can, canAccessPath, canSee, homePathFor } from "@/lib/auth/permissions";
import { admin, dev1, dev2, mkReq, mkStage, viewer } from "./helpers";

describe("permissions", () => {
  const req = mkReq({ stages: [mkStage({ cd: "AN", ownerId: "dev02" }), mkStage({ cd: "DV", ownerId: "dev01" })] });

  it("관리 작업은 관리자만", () => {
    for (const a of ["project.manage", "users.manage", "settings.manage", "history.view"] as const) {
      expect(can(admin, a)).toBe(true);
      expect(can(dev1, a)).toBe(false);
      expect(can(viewer, a)).toBe(false);
    }
  });

  it("공수 입력은 담당 개발자 본인만 — 관리자도 대신 못 한다", () => {
    expect(can(dev1, "effort.edit", { ownerId: "dev01" })).toBe(true);
    expect(can(dev1, "effort.edit", { ownerId: "dev02" })).toBe(false);
    expect(can(admin, "effort.edit", { ownerId: "dev01" })).toBe(false);
    expect(can(dev2, "effort.edit", { req })).toBe(true);
    expect(can(viewer, "effort.upload")).toBe(false);
  });

  it("개발자는 내 담당 단계가 있는 요구사항만 본다", () => {
    expect(canSee(dev1, req)).toBe(true);
    expect(canSee({ userId: "dev09", role: "DEVELOPER" }, req)).toBe(false);
    expect(canSee(viewer, req)).toBe(true);
  });

  it("경로", () => {
    expect(canAccessPath("ADMIN", "/admin")).toBe(true);
    expect(canAccessPath("DEVELOPER", "/admin")).toBe(false);
    expect(canAccessPath("VIEWER", "/api/admin/users")).toBe(false);
    expect(canAccessPath("VIEWER", "/dashboard")).toBe(true);
    for (const p of ["/master", "/assign", "/users", "/settings"]) {
      expect(canAccessPath("ADMIN", p)).toBe(true);
      expect(canAccessPath("DEVELOPER", p)).toBe(false);
    }
    expect(canAccessPath("DEVELOPER", "/voc")).toBe(true);
    expect(homePathFor("DEVELOPER")).toBe("/effort");
    expect(homePathFor("VIEWER")).toBe("/selection");
  });
});
