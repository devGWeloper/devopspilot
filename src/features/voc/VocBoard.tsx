"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, Select, Textarea, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Tabs";
import { api } from "@/lib/apiClient";
import { VOC_CAT, VOC_STATUS, type Voc, type VocCat, type VocStatus } from "@/lib/voc/service";
import { useMutate } from "../common/useMutate";
import s from "./voc.module.css";

type Filter = "open" | "mine" | "all";

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");
// 처리 상태에 색을 쓰지 않는다 — 업무 화면 무채색 원칙. 아직 손대지 않은 '접수'만 진하게.
const statusTone = (st: VocStatus) => (st === "OPEN" ? "accent" : "outline");

export function VocBoard({ items, me, admin, pages }: { items: Voc[]; me: string; admin: boolean; pages: string[] }) {
  const [filter, setFilter] = useState<Filter>(admin ? "open" : "all");
  const [writing, setWriting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const isOpen = (v: Voc) => v.status === "OPEN" || v.status === "REVIEW";
  const shown = items.filter((v) => (filter === "open" ? isOpen(v) : filter === "mine" ? v.by === me : true));

  return (
    <>
      <PageHeader
        eyebrow="도움말"
        title="개선 요청"
        description="불편한 점·오류·궁금한 점을 남기면 관리자가 확인하고 여기에 답합니다. 메신저 대신 여기에 남겨 주세요 — 다른 사람이 같은 요청을 했는지도 볼 수 있습니다."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setWriting(true)}>
            요청 남기기
          </Button>
        }
      />
      <div className={s.bar}>
        <Segmented<Filter>
          ariaLabel="보기"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "open", label: `처리 중 ${items.filter(isOpen).length}` },
            { key: "mine", label: "내 요청" },
            { key: "all", label: `전체 ${items.length}` },
          ]}
        />
      </div>
      <Panel flush>
        {shown.length === 0 ? (
          <EmptyState icon="message" title={filter === "mine" ? "남긴 요청이 없습니다" : "요청이 없습니다"}>
            불편한 점이 있으면 &lsquo;요청 남기기&rsquo;를 눌러 주세요.
          </EmptyState>
        ) : (
          <ul className={s.list}>
            {shown.map((v) => (
              <li key={v.vocId}>
                <button className={s.head} onClick={() => setOpenId(openId === v.vocId ? null : v.vocId)} aria-expanded={openId === v.vocId}>
                  <Chip tone={statusTone(v.status)}>{VOC_STATUS[v.status]}</Chip>
                  <span className={s.cat}>{VOC_CAT[v.cat]}</span>
                  <b className={s.title}>{v.title}</b>
                  {v.reply && <span className={s.replied}>답변 있음</span>}
                  <span className={s.meta}>
                    {v.page && `${v.page} · `}
                    {v.byNm} · {when(v.at)}
                  </span>
                </button>
                {openId === v.vocId && <Detail v={v} me={me} admin={admin} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {writing && <WriteDialog pages={pages} onClose={() => setWriting(false)} />}
    </>
  );
}

function Detail({ v, me, admin }: { v: Voc; me: string; admin: boolean }) {
  const { run, busy } = useMutate();
  // 관리자가 열어 보고 답하면 대개 검토 중으로 넘어가므로 그 값을 먼저 고른다.
  const [status, setStatus] = useState<VocStatus>(v.status === "OPEN" ? "REVIEW" : v.status);
  const [reply, setReply] = useState(v.reply);
  const canDelete = admin || (v.by === me && v.status === "OPEN" && !v.reply);
  const url = `/api/voc/${encodeURIComponent(v.vocId)}`;
  return (
    <div className={s.detail}>
      {v.body ? <p className={s.body}>{v.body}</p> : <p className="subtle">내용 없음</p>}
      {v.reply && !admin && (
        <div className={s.reply}>
          <b>
            답변 · {v.replyNm} {v.replyAt && when(v.replyAt)}
          </b>
          <p className={s.body}>{v.reply}</p>
        </div>
      )}
      {admin && (
        <div className={s.answer}>
          <Field label="답변">
            <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="요청자에게 보이는 답변 — 반영 시점·우회 방법 등" />
          </Field>
          <div className={s.actions}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as VocStatus)} aria-label="상태">
              {(Object.keys(VOC_STATUS) as VocStatus[]).map((k) => (
                <option key={k} value={k}>
                  {VOC_STATUS[k]}
                </option>
              ))}
            </Select>
            <Button variant="primary" size="sm" loading={busy} onClick={() => run(() => api(url, { method: "PUT", body: { status, reply } }), "저장했습니다.")}>
              저장
            </Button>
            {v.replyAt && (
              <span className="subtle">
                마지막 답변 {v.replyNm} {when(v.replyAt)}
              </span>
            )}
          </div>
        </div>
      )}
      {canDelete && (
        <div className={s.actions}>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm("이 요청을 지웁니다.") && run(() => api(url, { method: "DELETE" }), "지웠습니다.")}>
            지우기
          </Button>
        </div>
      )}
    </div>
  );
}

function WriteDialog({ pages, onClose }: { pages: string[]; onClose: () => void }) {
  const { run, busy } = useMutate();
  const [cat, setCat] = useState<VocCat>("IMPROVE");
  const [page, setPage] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const submit = async () => {
    if (await run(() => api("/api/voc", { body: { cat, page, title, body } }), "요청을 남겼습니다. 답변은 이 화면에서 볼 수 있습니다.")) onClose();
  };
  return (
    <Modal
      open
      title="개선 요청 남기기"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} disabled={!title.trim()} onClick={submit}>
            남기기
          </Button>
        </>
      }
    >
      <div className={s.form}>
        <Field label="구분" required>
          <Select value={cat} onChange={(e) => setCat(e.target.value as VocCat)}>
            {(Object.keys(VOC_CAT) as VocCat[]).map((k) => (
              <option key={k} value={k}>
                {VOC_CAT[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="화면">
          <Select value={page} onChange={(e) => setPage(e.target.value)}>
            <option value="">전체·기타</option>
            {pages.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <div className={s.full}>
          <Field label="제목" required>
            <TextInput value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="예: 미분류 세션을 여러 건 한 번에 옮기고 싶어요" />
          </Field>
        </div>
        <div className={s.full}>
          <Field label="내용" hint="무엇을 하려다 어떤 점이 불편했는지. 오류면 언제·어떤 화면에서 무엇을 눌렀는지">
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
