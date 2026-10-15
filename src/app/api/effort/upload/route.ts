import { fail, fromResult } from "@/lib/api";
import { uploadLog } from "@/lib/measure/service";
import { route } from "@/lib/route";

export const POST = route(async ({ req, actor, store }) => {
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof Blob)) return fail(400, "NO_FILE", "파일을 골라 주세요.");
  if (file.size > 20 * 1024 * 1024) return fail(400, "TOO_LARGE", "20MB 이하 파일만 올릴 수 있습니다.");
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return fail(400, "BAD_FILE", "JSON 파일이 아닙니다.");
  }
  return fromResult(await uploadLog(store, actor, raw));
});
