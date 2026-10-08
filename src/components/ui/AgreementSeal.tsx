import { AGREE_LABEL } from "@/lib/labels";
import type { AgreeCd } from "@/lib/types";
import s from "./ui.module.css";

export function AgreementSeal({ ax, hx }: { ax: AgreeCd; hx: AgreeCd }) {
  const title = `SK AX ${AGREE_LABEL[ax]} · SK hynix ${AGREE_LABEL[hx]}`;
  return (
    <span className={s.seal} title={title} aria-label={title}>
      <span className={s.sealItem}>
        <span className={s.sealDot} data-agree={ax} />
        AX
      </span>
      <span className={s.sealItem}>
        <span className={s.sealDot} data-agree={hx} />
        HX
      </span>
    </span>
  );
}
