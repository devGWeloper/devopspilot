import { fail, fromResult } from "@/lib/api";
import { applyUpload, type UploadKind } from "@/lib/measure/service";
import { route } from "@/lib/route";

const KINDS: UploadKind[] = ["usage", "otel", "commits", "jira"];

export const POST = route<{ prjId: string }>(async ({ req, actor, store, params }) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "BAD_REQUEST", "파일을 첨부해 주세요.");
  }
  const kind = form.get("kind") as UploadKind;
  const file = form.get("file");
  if (!KINDS.includes(kind) || !(file instanceof File)) return fail(400, "BAD_REQUEST", "업로드 종류와 파일을 확인해 주세요.");
  if (file.size > 20 * 1024 * 1024) return fail(413, "TOO_LARGE", "파일이 너무 큽니다(20MB 이하).");
  const text = new TextDecoder("utf-8").decode(await file.arrayBuffer());
  return fromResult(await applyUpload(store, actor, params.prjId, kind, file.name, text, form.get("dryRun") === "true"));
});
