"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { docDir, STAGE_GUIDE, stagePrompt } from "@/lib/measure/stageGuide";
import { STAGE_LABEL, STAGES, type StageCd } from "@/lib/types";
import { copyText } from "../common/copy";
import s from "./effort.module.css";

export interface PromptTarget {
  code: string;
  reqKey: string;
  name: string;
  stage: StageCd;
}

/** 공수 태그 + 단계 지시문. 태그만 붙이면 AI 가 단계를 넘나들어서, 기본 동작을 지시문 열기로 둔다. */
export function TagCopy({ target, show }: { target: PromptTarget; show: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  if (!show) return <span className={s.code}>{target.code}</span>;
  return (
    <>
      <span className={s.cmd} data-tour="tag">
        poc {target.code}
        <button
          className={s.copy}
          onClick={() => {
            copyText(`poc ${target.code}`);
            toast(`"poc ${target.code}" 복사했습니다. Codex 대화 첫 줄에 붙여 넣으세요.`);
          }}
        >
          복사
        </button>
        <button className={s.copy} onClick={() => setOpen(true)} data-tour="prompt">
          지시문
        </button>
      </span>
      {open && <StagePromptDialog target={target} onClose={() => setOpen(false)} />}
    </>
  );
}

function StagePromptDialog({ target, onClose }: { target: PromptTarget; onClose: () => void }) {
  const { toast } = useToast();
  const g = STAGE_GUIDE[target.stage];
  const text = stagePrompt(target);
  const dir = docDir(target.reqKey);
  const label = STAGE_LABEL[target.stage];
  return (
    <Modal
      open
      wide
      eyebrow={target.code}
      title={`${label} 단계 Codex 세션 시작하기`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>닫기</Button>
          <Button
            variant="primary"
            onClick={() => {
              copyText(text);
              toast(`${label} 지시문을 복사했습니다. 새 Codex 세션의 첫 메시지로 붙여 넣으세요.`);
              onClose();
            }}
          >
            지시문 복사
          </Button>
        </>
      }
    >
      <ol className={s.promptSteps}>
        <li>
          Codex 를 <b>새 세션</b>으로 엽니다. 다른 단계 일을 하던 세션에 이어 쓰지 않습니다.
        </li>
        <li>
          아래 지시문을 <b>첫 메시지</b>로 붙여 넣습니다. 첫 줄 <code>poc {target.code}</code> 로 이 세션 시간이 {label} 단계에 붙습니다.
        </li>
        <li>
          {label}이 끝나면 결과 문서 <code>{`${dir}/${g.output}`}</code> 를 확인하고 세션을 닫습니다. 다음 단계는 그 단계 줄의 <b>지시문</b>으로 새 세션을 엽니다.
        </li>
      </ol>
      <pre className={s.promptBox}>{text}</pre>
      <div className={s.promptChain} aria-label="단계 산출 문서">
        {STAGES.map((cd) => (
          <span key={cd} className={cd === target.stage ? s.promptOn : undefined}>
            {STAGE_LABEL[cd]} → {STAGE_GUIDE[cd].output}
          </span>
        ))}
      </div>
      <p className="subtle" style={{ margin: "8px 0 0", fontSize: 12 }}>
        같은 세션에서 다른 단계 코드를 말하면 그 세션은 &lsquo;미분류&rsquo;로 빠져 직접 나눠야 합니다. 지시문의 문서 경로·담을 내용은 상황에 맞게 고쳐 써도 됩니다.
      </p>
    </Modal>
  );
}
