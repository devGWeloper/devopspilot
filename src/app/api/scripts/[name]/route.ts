import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { route } from "@/lib/route";

const ALLOWED = new Set(["collect_ai_usage.py", "README.md"]);

export const GET = route<{ name: string }>(async ({ params }) => {
  // 허용 목록으로만 내려준다 — 경로 조작으로 다른 파일을 읽지 못하게.
  if (!ALLOWED.has(params.name)) return fail(404, "NOT_FOUND", "스크립트를 찾을 수 없습니다.");
  const file = path.join(process.cwd(), "scripts", params.name);
  if (!fs.existsSync(file)) return fail(404, "NOT_FOUND", "스크립트를 찾을 수 없습니다.");
  return new NextResponse(fs.readFileSync(file), {
    headers: {
      "Content-Type": params.name.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/x-python; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.name}"`,
    },
  });
});
