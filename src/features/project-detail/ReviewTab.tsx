"use client";

import { useState } from "react";
import type { Me } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Chip, type Tone } from "@/components/ui/Chip";
import { Textarea } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { can, reviewSide } from "@/lib/auth/permissions";
import { AGREE_LABEL, fmtDateTime } from "@/lib/labels";
import type { AgreeCd, Project, ReviewEntry } from "@/lib/types";
import s from "./detail.module.css";

const AGREE_TONE: Record<AgreeCd, Tone> = { AGREE: "ok", DISAGREE: "danger", HOLD: "warn", NONE: "neutral" };

function Thread({ items }: { items: ReviewEntry[] }) {
  if (!items.length) return <p className="muted">아직 의견이 없습니다.</p>;
  return (
    <div className={s.thread}>
      {[...items].reverse().map((r) => (
        <div key={r.id} className={s.msg}>
          <div className={s.msgHead}>
            <b>{r.userNm}</b>
            <span>{fmtDateTime(r.at)}</span>
            {r.agree !== "NONE" && <Chip tone={AGREE_TONE[r.agree]}>{AGREE_LABEL[r.agree]}</Chip>}
          </div>
          <div className={s.msgText}>{r.text}</div>
        </div>
      ))}
    </div>
  );
}

export function ReviewTab({
  p,
  me,
  onChange,
  context,
}: {
  p: Project;
  me: Me;
  onChange: (p: Project) => void;
  context: "SELECTION" | "MEASURE";
}) {
  const { toast, toastError } = useToast();
  const [text, setText] = useState("");
  const [agree, setAgree] = useState<AgreeCd>(context === "SELECTION" ? "AGREE" : "NONE");
  const [busy, setBusy] = useState(false);
  const mySide = reviewSide(me);
  const allowed = can(me, context === "MEASURE" ? "measure.comment" : "project.review");
  const list = p.reviews.filter((r) => r.context === context);

  async function post() {
    setBusy(true);
    try {
      onChange(await api<Project>(`/api/projects/${p.prjId}/reviews`, { body: { agree, text, context } }));
      setText("");
      toast("의견을 남겼습니다.");
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const sides: { side: "AX" | "HX"; title: string; agree: AgreeCd }[] = [
    { side: "AX", title: "SK AX", agree: p.axAgree },
    { side: "HX", title: "SK hynix", agree: p.hxAgree },
  ];

  return (
    <div className={s.reviewGrid}>
      {sides.map((sd) => (
        <Panel
          key={sd.side}
          eyebrow={sd.side === "AX" ? "Partner" : "Customer"}
          title={
            <span className={s.sideHead}>
              {sd.title}
              {context === "SELECTION" && <Chip tone={AGREE_TONE[sd.agree]}>{AGREE_LABEL[sd.agree]}</Chip>}
            </span>
          }
        >
          <Thread items={list.filter((r) => r.side === sd.side)} />
          {allowed && mySide === sd.side && (
            <div className={s.compose}>
              {context === "SELECTION" && (
                <Segmented
                  ariaLabel="동의 여부"
                  value={agree}
                  onChange={setAgree}
                  options={[
                    { key: "AGREE", label: "동의" },
                    { key: "HOLD", label: "보류" },
                    { key: "DISAGREE", label: "이견" },
                    { key: "NONE", label: "의견만" },
                  ]}
                />
              )}
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={context === "SELECTION" ? "선정 의견을 남겨 주세요" : "측정 결과에 대한 코멘트를 남겨 주세요"}
                maxLength={2000}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="primary" icon="send" loading={busy} disabled={!text.trim()} onClick={post}>
                  의견 등록
                </Button>
              </div>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}
