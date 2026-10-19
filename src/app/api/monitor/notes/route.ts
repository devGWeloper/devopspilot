import { fail, fromResult, readJson } from "@/lib/api";
import { addNote, type NoteInput } from "@/lib/measure/service";
import { route } from "@/lib/route";

export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<NoteInput>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await addNote(store, actor, body));
});
