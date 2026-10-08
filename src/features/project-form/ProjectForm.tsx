"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { FitBadge } from "@/components/ui/FitBadge";
import { Callout, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileStrip } from "@/components/ui/ProfileStrip";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errMessage } from "@/lib/apiClient";
import { can } from "@/lib/auth/permissions";
import { evaluateFit } from "@/lib/fitness";
import { useApi, useRefs } from "@/lib/hooks";
import type { FieldError, ProjectInput } from "@/lib/projects/validate";
import type { Project } from "@/lib/types";
import s from "./form.module.css";
import { StepBaseline } from "./StepBaseline";
import { StepBasic } from "./StepBasic";
import { StepEvaluation } from "./StepEvaluation";

const STEPS = ["기본 정보", "원 프로젝트 실적", "지표 평가"];

export function emptyInput(): ProjectInput {
  return {
    prjNm: "",
    sysNm: "",
    pmUserId: "",
    base: {
      description: "",
      domainCd: "",
      sysTypeCd: "",
      langCds: [],
      techStack: "",
      orgNm: "",
      baseline: {
        startDate: null,
        endDate: null,
        totalMm: null,
        phaseMm: { ANALYSIS: null, DESIGN: null, DEV: null, TEST: null },
        screens: null,
        programs: null,
        loc: null,
        replayPhases: ["DESIGN", "DEV", "TEST"],
      },
    },
    answers: {},
    notes: {},
  };
}

function fromProject(p: Project): ProjectInput {
  return { prjNm: p.prjNm, sysNm: p.sysNm, pmUserId: p.pmUserId, base: p.base, answers: p.eval.answers, notes: p.eval.notes };
}

const STEP_FIELDS: ((f: string) => boolean)[] = [
  (f) => ["prjNm", "sysNm", "pmUserId", "domainCd", "sysTypeCd", "langCds", "description", "techStack"].includes(f),
  (f) => f.startsWith("baseline"),
  (f) => f.startsWith("answer.") || f.startsWith("note."),
];

export function ProjectForm({ id }: { id?: string }) {
  const router = useRouter();
  const { me } = useAuth();
  const { criteria, codes } = useRefs();
  const { toast, toastError } = useToast();
  const { data: loaded, error: loadError } = useApi<Project>(id ? `/api/projects/${id}` : null);
  const { data: pms } = useApi<{ userId: string; userNm: string; deptNm: string }[]>("/api/users/options?role=PM");
  const [input, setInput] = useState<ProjectInput>(emptyInput);
  const [project, setProject] = useState<Project | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (loaded) {
      setProject(loaded);
      setInput(fromProject(loaded));
    }
  }, [loaded]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const ev = useMemo(() => (criteria ? evaluateFit(criteria, input.answers) : null), [criteria, input.answers]);

  function update(patch: Partial<ProjectInput>) {
    setInput((x) => ({ ...x, ...patch }));
    setDirty(true);
  }

  async function save(quiet = false): Promise<Project | null> {
    if (!input.prjNm.trim()) {
      setErrors([{ field: "prjNm", message: "과제명을 입력해야 저장할 수 있습니다." }]);
      setStep(0);
      return null;
    }
    setBusy("save");
    try {
      const p = project
        ? await api<Project>(`/api/projects/${project.prjId}`, { method: "PUT", body: { ...input, updAt: project.updAt } })
        : await api<Project>("/api/projects", { body: input });
      setProject(p);
      setDirty(false);
      setErrors([]);
      if (!project) window.history.replaceState(null, "", `/projects/${p.prjId}/edit`);
      if (!quiet) toast("임시저장했습니다.");
      return p;
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) setErrors(e.details as FieldError[]);
      toastError(errMessage(e));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function goStep(i: number) {
    if (dirty && input.prjNm.trim()) await save(true);
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const saved = dirty || !project ? await save(true) : project;
    if (!saved) return;
    setBusy("submit");
    try {
      await api<Project>(`/api/projects/${saved.prjId}/submit`, { body: { updAt: saved.updAt } });
      setDirty(false);
      toast("제출했습니다.");
      router.push(`/projects/${saved.prjId}`);
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) {
        const errs = e.details as FieldError[];
        setErrors(errs);
        const first = STEP_FIELDS.findIndex((match) => errs.some((x) => match(x.field)));
        if (first >= 0) setStep(first);
        setTimeout(() => document.querySelector("[data-error='true']")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
      }
      toastError(errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <Callout tone="danger">{loadError}</Callout>;
  if (!criteria || !codes || !me || (id && !project)) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Skeleton h={28} w={280} />
        <Skeleton h={420} />
      </div>
    );
  }
  if (project && !can(me, "project.edit", { project })) {
    return <Callout tone="warn">이 과제는 현재 상태에서 편집할 수 없습니다. 보완 요청을 받으면 다시 편집할 수 있습니다.</Callout>;
  }
  if (!project && !can(me, "project.create")) {
    return <Callout tone="warn">과제를 등록할 권한이 없습니다.</Callout>;
  }

  const errOf = (f: string) => errors.find((e) => e.field === f)?.message ?? null;
  const stepDone = [
    !!(input.prjNm && input.sysNm && input.base.domainCd && input.base.sysTypeCd && input.base.langCds.length && input.base.description),
    input.base.baseline.totalMm !== null,
    !!ev && ev.majorCount.answered === ev.majorCount.total,
  ];
  const canSubmit = !project || can(me, "project.submit", { project });

  return (
    <div className={s.wrap}>
      <PageHeader
        eyebrow={project ? `${project.prjId} · 편집` : "New candidate"}
        title={project ? project.prjNm || "과제 편집" : "PoC 후보 과제 등록"}
        description="단계를 이동하면 자동으로 임시저장됩니다. Major 지표까지 모두 응답하면 제출할 수 있습니다."
        actions={project && <Link href={`/projects/${project.prjId}`} className={s.back}>상세로 돌아가기</Link>}
      >
        <Stepper steps={STEPS} current={step} done={stepDone} onSelect={goStep} />
      </PageHeader>

      {errors.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="danger">
            제출 전에 채워야 할 항목이 {errors.length}개 있습니다: {errors.slice(0, 4).map((e) => e.message.replace(/해 주세요\.?$/, "")).join(" · ")}
            {errors.length > 4 && " …"}
          </Callout>
        </div>
      )}

      {step === 0 && (
        <StepBasic input={input} update={update} codes={codes} pms={pms ?? []} isAdmin={me.role === "AX_ADMIN"} errOf={errOf} />
      )}
      {step === 1 && <StepBaseline input={input} update={update} errOf={errOf} />}
      {step === 2 && <StepEvaluation input={input} update={update} criteria={criteria} errOf={errOf} />}

      <div className={s.stepNav}>
        <Button icon="chevronLeft" disabled={step === 0} onClick={() => goStep(step - 1)}>
          이전
        </Button>
        {step < STEPS.length - 1 && (
          <Button variant="primary" onClick={() => goStep(step + 1)}>
            다음 · {STEPS[step + 1]}
          </Button>
        )}
      </div>

      <div className={`${s.previewBar} no-print`}>
        <div className={s.previewInner}>
          {ev && <ProfileStrip profile={ev.profile} size="md" />}
          {ev && (
            <span className={s.previewFit}>
              제안 <FitBadge fit={ev.suggest} confirmed={false} size="sm" />
            </span>
          )}
          <span className="muted num" style={{ fontSize: 13 }}>
            응답 <b style={{ color: "var(--ink)" }}>{ev?.answerCnt ?? 0}</b>/{ev?.indicatorCnt ?? 0}
            {ev && ev.majorCount.answered < ev.majorCount.total && <> · Major 미응답 {ev.majorCount.total - ev.majorCount.answered}</>}
          </span>
          <span className={s.saveState}>{dirty ? "저장 안 된 변경 있음" : project ? "저장됨" : ""}</span>
          <div className={s.previewActions}>
            <Button loading={busy === "save"} disabled={!!busy} onClick={() => save()}>
              임시저장
            </Button>
            {canSubmit && (
              <Button variant="primary" icon="send" loading={busy === "submit"} disabled={!!busy} onClick={submit}>
                제출
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
