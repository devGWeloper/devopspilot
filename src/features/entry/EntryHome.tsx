"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/Chip";
import { FitPair } from "@/components/ui/FitBadge";
import { Icon } from "@/components/ui/Icon";
import { Callout, EmptyState, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/permissions";
import { useApi, useRefs } from "@/lib/hooks";
import { fmtRelative } from "@/lib/labels";
import { ENTRY_STEPS, entryProgress, toInput } from "@/lib/projects/validate";
import type { Criteria, Project } from "@/lib/types";
import s from "./entry.module.css";

const FLOW = [...ENTRY_STEPS, "제출", "AX·HX 검토"];
const EDITABLE = ["DRAFT", "SUPPLEMENT"];

export function EntryHome() {
  const router = useRouter();
  const { me } = useAuth();
  const { criteria } = useRefs();
  const { data, error } = useApi<Project[]>("/api/projects");

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!data || !criteria || !me) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Skeleton h={28} w={240} />
        <Skeleton h={220} />
      </div>
    );
  }

  const isAdmin = me.role === "AX_ADMIN";
  const mine = data.filter((p) => isAdmin || p.pmUserId === me.userId);
  const todo = mine.filter((p) => EDITABLE.includes(p.status)).sort((a, b) => (a.status === "SUPPLEMENT" ? -1 : 0) - (b.status === "SUPPLEMENT" ? -1 : 0));
  const sent = mine.filter((p) => !EDITABLE.includes(p.status));

  return (
    <>
      <PageHeader
        eyebrow="Project entry"
        title="과제 기입"
        description={
          isAdmin
            ? "PM 이 기입 중인 과제와 제출된 과제를 한곳에서 봅니다. AX 관리자는 PM 대신 기입할 수 있습니다."
            : "과제 선정 양식(엑셀)과 같은 항목을 화면에서 입력하고 제출합니다. 요구사항 단위가 아니라 과제 단위로 한 건씩 기입합니다."
        }
        actions={
          can(me, "project.create") && (
            <Button variant="primary" icon="plus" onClick={() => router.push("/entry/new")}>
              새 과제 기입
            </Button>
          )
        }
      />

      <p className={s.formNote}>
        양식 구성 — ① 과제 · ③ AI 적용 계획 · ④ AI 적합도 · ⑤ 참여 인력. 양식의 ② 요구사항 영역은 과제 기준 선정이라 받지 않습니다.
      </p>
      <ol className={s.flow} aria-label="기입 절차">
        {FLOW.map((f, i) => (
          <li key={f}>
            <span className={s.flowNo}>{i + 1}</span>
            {f}
          </li>
        ))}
        <li className={s.flowNote}>보완 요청을 받으면 다시 기입 → 재제출</li>
      </ol>

      <Panel eyebrow="To fill in" title={`기입할 과제 ${todo.length}`} style={{ marginBottom: 16 }}>
        {todo.length === 0 ? (
          <EmptyState icon="check" title="기입할 과제가 없습니다">
            작성 중이거나 보완 요청된 과제가 여기에 나옵니다.
          </EmptyState>
        ) : (
          <div className={s.cards}>
            {todo.map((p) => (
              <EntryCard key={p.prjId} p={p} criteria={criteria} showPm={isAdmin} />
            ))}
          </div>
        )}
      </Panel>

      <Panel eyebrow="Submitted" title={`제출한 과제 ${sent.length}`} flush>
        {sent.length === 0 ? (
          <div style={{ padding: 20 }}>
            <p className="muted" style={{ fontSize: 13 }}>
              아직 제출한 과제가 없습니다.
            </p>
          </div>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>과제</th>
                {isAdmin && <th>PM</th>}
                <th>상태</th>
                <th>적합도</th>
                <th>최근 변경</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sent.map((p) => (
                <tr key={p.prjId}>
                  <td>
                    <b>{p.prjNm}</b>
                    <span className="subtle"> · {p.prjId}</span>
                  </td>
                  {isAdmin && <td>{p.pmUserNm}</td>}
                  <td>
                    <StatusChip status={p.status} />
                  </td>
                  <td>
                    <FitPair finalFit={p.finalFit} suggestFit={p.suggestFit} size="sm" />
                  </td>
                  <td className="subtle">{fmtRelative(p.updAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/projects/${p.prjId}`} className={s.link}>
                      상세 보기 <Icon name="chevronRight" size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <p className="subtle" style={{ fontSize: 12, marginTop: 12 }}>
        제출한 과제는 AX 검토 중 수정할 수 없습니다. 수정이 필요하면 AX 관리자에게 보완 요청을 받아 다시 기입합니다.
      </p>
    </>
  );
}

function EntryCard({ p, criteria, showPm }: { p: Project; criteria: Criteria; showPm: boolean }) {
  const router = useRouter();
  const prog = entryProgress(toInput(p), criteria);
  return (
    <article className={s.card}>
      <header className={s.cardHead}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">
            {p.prjId}
            {showPm && ` · PM ${p.pmUserNm}`}
          </span>
          <h3 className={s.cardTitle}>{p.prjNm || "(과제명 미입력)"}</h3>
        </div>
        <StatusChip status={p.status} />
      </header>
      {p.status === "SUPPLEMENT" && p.statusNote && (
        <div className={s.supplement}>
          <b>보완 요청</b> {p.statusNote}
        </div>
      )}
      <ul className={s.steps}>
        {ENTRY_STEPS.map((name, i) => (
          <li key={name} data-done={prog.missing[i] === 0 ? "true" : undefined}>
            <span className={s.stepMark}>{prog.missing[i] === 0 ? <Icon name="check" size={12} /> : i + 1}</span>
            <span>{name}</span>
            <span className={s.stepState}>{prog.missing[i] === 0 ? "완료" : `${prog.missing[i]}개 남음`}</span>
          </li>
        ))}
      </ul>
      <footer className={s.cardFoot}>
        <span className="subtle" style={{ fontSize: 12 }}>
          필수 입력 <b className="num">{Math.floor(prog.rate * 100)}%</b> · {fmtRelative(p.updAt)} 저장
        </span>
        <Button variant={prog.done ? "primary" : "secondary"} icon="edit" onClick={() => router.push(`/entry/${p.prjId}`)}>
          {prog.done ? "확인 후 제출" : p.status === "SUPPLEMENT" ? "보완 기입" : "이어서 기입"}
        </Button>
      </footer>
    </article>
  );
}
