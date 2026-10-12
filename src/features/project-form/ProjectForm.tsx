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
import { ENTRY_STEPS, entryProgress, stepOfField, toInput, type FieldError, type ProjectInput } from "@/lib/projects/validate";
import type { Project } from "@/lib/types";
import s from "./form.module.css";
import { emptyBase } from "@/lib/projects/base";
import { StepBaseline } from "./StepBaseline";
import { StepFit, StepPlan, StepProject, StepStaff } from "./Steps";

const STEPS = [...ENTRY_STEPS];

export function emptyInput(): ProjectInput {
  return {
    prjNm: "",
    sysNm: "",
    pmUserId: "",
    base: emptyBase(),
    answers: {},
    notes: {},
  };
}

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
      setInput(toInput(loaded));
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
      if (!project) window.history.replaceState(null, "", `/entry/${p.prjId}`);
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
      toast("제출했습니다. AX 검토가 시작되면 기입 목록에서 상태를 확인할 수 있습니다.");
      router.push("/entry");
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) {
        const errs = e.details as FieldError[];
        setErrors(errs);
        if (errs.length) setStep(Math.min(...errs.map((x) => stepOfField(x.field, criteria ?? undefined))));
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
  const progress = entryProgress(input, criteria);
  const stepDone = progress.missing.map((n) => n === 0);
  const canSubmit = !project || can(me, "project.submit", { project });
  const ctx = { input, update, errOf, codes, criteria };

  return (
    <div className={s.wrap}>
      <PageHeader
        eyebrow={project ? `과제 기입 · ${project.prjId}` : "과제 기입 · 신규"}
        title={project ? project.prjNm || "과제 기입" : "PoC 후보 과제 기입"}
        description="과제 선정 양식(엑셀)과 같은 항목입니다. 단계를 이동하면 자동으로 임시저장되고, * 표시 항목을 모두 채워야 제출할 수 있습니다."
        actions={
          <Link href="/entry" className={s.back}>
            기입 목록으로
          </Link>
        }
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
        <StepProject
          ctx={ctx}
          pms={pms ?? []}
          isAdmin={me.role === "AX_ADMIN"}
          pmName={project?.pmUserNm ?? me.userNm}
        />
      )}
      {step === 1 && <StepBaseline input={input} update={update} errOf={errOf} />}
      {step === 2 && <StepPlan ctx={ctx} />}
      {step === 3 && <StepFit ctx={ctx} ev={ev} />}
      {step === 4 && <StepStaff ctx={ctx} />}

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
              참고 등급 <FitBadge fit={ev.suggest} confirmed={false} size="sm" />
            </span>
          )}
          {input.base.pmFit && (
            <span className={s.previewFit}>
              PM 판단 <FitBadge fit={input.base.pmFit} confirmed={false} size="sm" />
            </span>
          )}
          <span className="muted num" style={{ fontSize: 13 }} title="양식 REF-05 필수 입력 완료율">
            필수 입력 <b style={{ color: "var(--ink)" }}>{Math.floor(progress.rate * 100)}%</b>
            {progress.total > 0 ? (
              <span style={{ color: "var(--fit-l)", fontWeight: 600 }}> · 남은 항목 {progress.total}</span>
            ) : (
              <> · 제출 가능</>
            )}
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
