import { describe, it, expect } from "vitest";
import { FORM_FIELDS, formValues, missingRequired } from "@/lib/projects/form";
import { mkProject, mkReq, mkStage } from "./helpers";

describe("선정 현황 항목", () => {
  it("항목 ID 가 겹치지 않는다", () => {
    const ids = FORM_FIELDS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("공수 태그 한 행을 항목 ID → 값으로 펼친다", () => {
    const s = mkStage({ cd: "DV", baseMd: 6, difficulty: "상", grade: "고급", fit: "하", ownerId: "s1001", ownerNm: "김개발" });
    const req = mkReq({ reqId: "REQ0047", stages: [s] });
    const v = formValues(mkProject({ prjNm: "설비 수신", deployType: "C/S — 설치형", reqs: [req] }), req, s, "DAE01-REQ0047-DV");
    expect(v).toMatchObject({ "PRJ-01": "설비 수신", "PRJ-07": "C/S — 설치형", "REQ-01": "DAE01-REQ0047-DV", "REQ-02": "REQ0047", "REQ-03": "개발", "REQ-04": "상", "REQ-06": "6", "FIT-06": "하", "REQ-08": "김개발 (s1001)" });
    expect(missingRequired(v).map((f) => f.id)).toContain("FIT-01");
    expect(missingRequired(v).map((f) => f.id)).not.toContain("PRJ-07");
  });
});
