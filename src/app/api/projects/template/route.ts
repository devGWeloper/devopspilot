import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

const NAME = "AI 활용 생산성 향상 PoC_과제선정_양식.xlsx";

export const GET = route(async () => {
  const file = path.join(process.cwd(), "templates", "project_template.xlsx");
  if (!fs.existsSync(file)) return fail(404, "NOT_FOUND", "양식 파일이 없습니다.");
  return new NextResponse(fs.readFileSync(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(NAME)}`,
    },
  });
});
