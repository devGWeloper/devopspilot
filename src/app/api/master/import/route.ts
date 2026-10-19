import { fail, fromResult } from "@/lib/api";
import { importWorkbook } from "@/lib/projects/service";
import { route } from "@/lib/route";

export const POST = route(async ({ req, actor, store }) => {
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof Blob)) return fail(400, "NO_FILE", "엑셀 파일을 골라 주세요.");
  if (file.size > 10 * 1024 * 1024) return fail(400, "TOO_LARGE", "10MB 이하 파일만 올릴 수 있습니다.");
  return fromResult(await importWorkbook(store, actor, await file.arrayBuffer()));
});
