"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip, type Tone } from "@/components/ui/Chip";
import { Field, Select, TextInput, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, KpiTile, Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Tabs";
import { api } from "@/lib/apiClient";
import { RULES, type RuleCd, type Severity } from "@/lib/measure/monitorRules";
import type { MonitorNote, NoteStatus } from "@/lib/measure/types";
import type { MonitorVM } from "@/lib/views";
import { useMutate } from "../common/useMutate";
import s from "./monitor.module.css";

type Item = MonitorVM["items"][number];
type F = "open" | "action" | "ok" | "all";

const SEV: Record<Severity, { label: string; tone: Tone }> = {
  high: { label: "높음", tone: "danger" },
  mid: { label: "보통", tone: "warn" },
  low: { label: "낮음", tone: "neutral" },
};
const NOTE: Record<NoteStatus, { label: string; tone: Tone }> = {
  OK: { label: "문제없음 확인", tone: "ok" },
  ACTION: { label: "조치 필요", tone: "danger" },
  MEMO: { label: "메모", tone: "neutral" },
};
const METHODS = ["전화", "메신저", "메일", "대면", "회의", "기타"];

// 마지막 판정이 '문제없음'이면 닫힌 것으로 본다. 메모만 있으면 아직 확인 대기.
const stateOf = (i: Item): F => (i.last?.status === "OK" ? "ok" : i.notes.some((n) => n.status === "ACTION") ? "action" : "open");

export function MonitorBoard({ vm }: { vm: MonitorVM }) {
  const [f, setF] = useState<F>("open");
  const [user, setUser] = useState("");
  const [rule, setRule] = useState("");
  const [sel, setSel] = useState<Item | null>(null);
  const [free, setFree] = useState(false);

  const count = (x: F) => vm.items.filter((i) => stateOf(i) === x).length;
  const list = useMemo(
    () => vm.items.filter((i) => (f === "all" || stateOf(i) === f) && (!user || i.userId === user) && (!rule || i.rule === rule)),
    [vm, f, user, rule],
  );
  const byUser = useMemo(() => {
    const m = new Map<string, { nm: string; n: number; open: number }>();
    vm.items.forEach((i) => {
      if (!i.userId) return;
      const x = m.get(i.userId) ?? { nm: i.userNm, n: 0, open: 0 };
      x.n++;
      if (stateOf(i) !== "ok") x.open++;
      m.set(i.userId, x);
    });
    return Array.from(m).sort((a, b) => b[1].open - a[1].open);
  }, [vm]);

  return (
    <>
      <PageHeader
        eyebrow="관리"
        title="공수 모니터링"
        description="입력된 공수에서 형식적 입력·튀는 값을 자동으로 찾아냅니다. 확인한 내용(누구에게 어떻게 확인했는지)을 바로 기록해 증적으로 남깁니다."
        actions={
          <Button icon="edit" onClick={() => setFree(true)}>
            감독 일지 쓰기
          </Button>
        }
      >
        <div className={s.kpis}>
          <KpiTile label="확인 대기" value={count("open")} unit="건" sub={`높음 ${vm.items.filter((i) => i.severity === "high" && stateOf(i) === "open").length}건`} />
          <KpiTile label="조치 필요" value={count("action")} unit="건" sub="조치 후 '문제없음'으로 닫기" />
          <KpiTile label="문제없음 확인" value={count("ok")} unit="건" sub="기록이 남은 건" />
          <KpiTile label="감독 일지" value={vm.free.length} unit="건" sub="특정 이상과 무관한 기록" />
        </div>
      </PageHeader>

      <div className={s.layout}>
        <div style={{ minWidth: 0 }}>
          <div className={s.filters}>
            <Segmented<F>
              ariaLabel="상태"
              value={f}
              onChange={setF}
              options={[
                { key: "open", label: `확인 대기 ${count("open")}` },
                { key: "action", label: `조치 필요 ${count("action")}` },
                { key: "ok", label: `확인 완료 ${count("ok")}` },
                { key: "all", label: "전체" },
              ]}
            />
            <Select value={user} onChange={(e) => setUser(e.target.value)} aria-label="개발자" style={{ maxWidth: 160 }}>
              <option value="">개발자 전체</option>
              {vm.users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.userNm}
                </option>
              ))}
            </Select>
            <Select value={rule} onChange={(e) => setRule(e.target.value)} aria-label="유형" style={{ maxWidth: 180 }}>
              <option value="">유형 전체</option>
              {(Object.keys(RULES) as RuleCd[]).map((k) => (
                <option key={k} value={k}>
                  {RULES[k].label}
                </option>
              ))}
            </Select>
          </div>

          <Panel flush>
            {list.length === 0 ? (
              <EmptyState title={f === "open" ? "확인할 이상이 없습니다" : "해당하는 항목이 없습니다"} />
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>심각도</th>
                    <th style={{ width: 130 }}>유형</th>
                    <th>내용</th>
                    <th style={{ width: 220 }}>최근 확인 기록</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i.key} className={s.row} onClick={() => setSel(i)}>
                      <td>
                        <Chip tone={SEV[i.severity].tone}>{SEV[i.severity].label}</Chip>
                      </td>
                      <td>
                        <b>{RULES[i.rule].label}</b>
                      </td>
                      <td>
                        <b>{i.title}</b>
                        <div className={s.sub}>{i.detail}</div>
                      </td>
                      <td>
                        {i.last ? (
                          <>
                            <Chip tone={NOTE[i.last.status].tone}>{NOTE[i.last.status].label}</Chip>
                            <div className={s.sub}>
                              {i.last.at.slice(5, 10)} {i.last.byNm}
                              {i.last.contact ? ` → ${i.last.contact}` : ""}
                              {i.last.method ? ` (${i.last.method})` : ""}
                            </div>
                          </>
                        ) : (
                          <span className="subtle">기록 없음</span>
                        )}
                      </td>
                      <td>
                        <Button size="sm">기록</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className={s.side}>
          <Panel title="개발자별" flush>
            {byUser.length === 0 ? (
              <p className={s.pad}>감지된 이상이 없습니다.</p>
            ) : (
              <table className={s.table}>
                <tbody>
                  {byUser.map(([id, x]) => (
                    <tr key={id} className={s.row} onClick={() => (setUser(id), setF("all"))}>
                      <td>{x.nm}</td>
                      <td className={s.r}>
                        {x.open > 0 ? <b className={s.warn}>미확인 {x.open}</b> : <span className="subtle">모두 확인</span>}
                        <span className="subtle"> / {x.n}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Panel title="감지 규칙">
            <ul className={s.rules}>
              {(Object.keys(RULES) as RuleCd[]).map((k) => (
                <li key={k}>
                  <b>{RULES[k].label}</b>
                  <span>{RULES[k].why}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="최근 감독 일지">
            {vm.free.length === 0 ? (
              <p className="subtle" style={{ fontSize: 13 }}>
                아직 없습니다.
              </p>
            ) : (
              <Timeline notes={vm.free.slice(0, 8)} />
            )}
          </Panel>
        </div>
      </div>

      {sel && <NoteDialog item={sel} onClose={() => setSel(null)} />}
      {free && <NoteDialog item={null} onClose={() => setFree(false)} />}
    </>
  );
}

function Timeline({ notes }: { notes: MonitorNote[] }) {
  return (
    <ol className={s.timeline}>
      {notes.map((n) => (
        <li key={n.noteId}>
          <div className={s.tlHead}>
            <Chip tone={NOTE[n.status].tone}>{NOTE[n.status].label}</Chip>
            <span className="subtle">
              {n.at.slice(0, 16).replace("T", " ")} · {n.byNm}
            </span>
          </div>
          {(n.contact || n.method) && (
            <div className={s.sub}>
              {n.contact && `확인 대상: ${n.contact}`}
              {n.method && ` · ${n.method}`}
            </div>
          )}
          <p className={s.tlText}>{n.text}</p>
        </li>
      ))}
    </ol>
  );
}

function NoteDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const { run, busy } = useMutate();
  const [status, setStatus] = useState<NoteStatus>(item ? "OK" : "MEMO");
  const [method, setMethod] = useState("전화");
  const [contact, setContact] = useState("");
  const [text, setText] = useState("");

  async function save() {
    const ok = await run(
      () => api("/api/monitor/notes", { body: { key: item?.key ?? "FREE", status, method, contact, text, userId: item?.userId, reqId: item?.reqId, date: item?.date } }),
      "기록했습니다.",
    );
    if (ok) onClose();
  }

  return (
    <Modal
      open
      wide
      eyebrow={item ? RULES[item.rule].label : "감독 일지"}
      title={item ? item.title : "감독 일지 쓰기"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>닫기</Button>
          <Button variant="primary" loading={busy} disabled={!text.trim()} onClick={save}>
            기록 남기기
          </Button>
        </>
      }
    >
      {item && (
        <div className={s.detail}>
          <p>
            <b>{item.detail}</b>
          </p>
          <p className="subtle">{RULES[item.rule].why}</p>
          {item.userId && (
            <Link className={s.link} href={`/effort?u=${encodeURIComponent(item.userId)}${item.date ? `&d=${item.date}` : ""}`}>
              {item.userNm} 님 공수 입력 화면에서 보기 →
            </Link>
          )}
        </div>
      )}

      {item && item.notes.length > 0 && (
        <>
          <h3 className={s.h3}>지금까지 기록 {item.notes.length}건</h3>
          <Timeline notes={item.notes} />
        </>
      )}

      <h3 className={s.h3}>새 기록</h3>
      <div className={s.form}>
        <Field label="판정">
          <Segmented<NoteStatus>
            ariaLabel="판정"
            value={status}
            onChange={setStatus}
            options={(item ? (["OK", "ACTION", "MEMO"] as NoteStatus[]) : (["MEMO", "ACTION"] as NoteStatus[])).map((k) => ({ key: k, label: NOTE[k].label }))}
          />
        </Field>
        <div className={s.formRow}>
          <Field label="확인 방법">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="확인 대상" hint="누구에게 확인했는지 (예: 김OO 팀장, 본인)">
            <TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder="김OO 팀장" />
          </Field>
        </div>
        <Field label="내용" required hint="기록은 고칠 수 없고 계속 쌓입니다.">
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={item ? "예: 김OO 팀장에게 전화로 문의 — 해당 주는 장애 대응으로 같은 시간 투입이 맞다고 확인. 문제없음." : "예: 이번 주 전체 입력 점검. 미확정 3명에게 메신저로 안내."}
          />
        </Field>
      </div>
    </Modal>
  );
}
