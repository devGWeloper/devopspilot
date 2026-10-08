"use client";

import { Fragment } from "react";
import { Icon } from "./Icon";
import s from "./ui.module.css";

export function Stepper({
  steps,
  current,
  done,
  onSelect,
}: {
  steps: string[];
  current: number;
  done: boolean[];
  onSelect: (i: number) => void;
}) {
  return (
    <nav className={s.stepper} aria-label="입력 단계">
      {steps.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <span className={s.stepLine} />}
          <button
            className={`${s.step} ${i === current ? s.stepActive : ""} ${done[i] && i !== current ? s.stepDone : ""}`}
            onClick={() => onSelect(i)}
            aria-current={i === current ? "step" : undefined}
          >
            <span className={s.stepNum}>{done[i] && i !== current ? <Icon name="check" size={14} stroke={2.5} /> : i + 1}</span>
            {label}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
