/**
 * O dia como uma linha de cílios: a pálpebra vai do início ao fim do expediente e cada atendimento
 * aparece como um tufo de fios no seu horário. Quanto mais fios, mais cheio o dia.
 */
type Item = { startMin: number; endMin: number; status: string };

const COR: Record<string, string> = {
  confirmed: "#000000",
  completed: "#8f8286",
  pending: "#b8305a",
};

const W = 320;
const X0 = 12;
const X1 = 308;
const Y = 56; // altura da pálpebra nas pontas
const ARCO = 22; // quanto a pálpebra sobe no meio

function ponto(t: number) {
  const x = X0 + (X1 - X0) * t;
  const y = Y - ARCO * 4 * t * (1 - t) * 0.5;
  return { x, y };
}
function normal(t: number) {
  const tx = X1 - X0;
  const ty = -ARCO * 2 * (1 - 2 * t);
  const l = Math.hypot(tx, ty);
  return { nx: ty / l, ny: -tx / l, tx: tx / l, ty: ty / l };
}

function hh(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function LinhaDoDia({ items, ini, fim, agora, className }: { items: Item[]; ini: number; fim: number; agora: number | null; className?: string }) {
  const span = Math.max(60, fim - ini);
  const tOf = (m: number) => Math.min(1, Math.max(0, (m - ini) / span));
  const fios: { d: string; cor: string }[] = [];
  for (const it of items) {
    const a = tOf(it.startMin);
    const b = tOf(it.endMin);
    const largura = (b - a) * (X1 - X0);
    const n = Math.max(3, Math.round(largura / 4.2));
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const t = a + (b - a) * u;
      const { x, y } = ponto(t);
      const { nx, ny, tx, ty } = normal(t);
      const inclina = (t - 0.5) * 0.9;
      let vx = nx + tx * inclina;
      let vy = ny + ty * inclina;
      const l = Math.hypot(vx, vy);
      vx /= l;
      vy /= l;
      const comp = 13 + 11 * Math.sin(Math.PI * u); // fios mais longos no meio do tufo
      const ex = x + vx * comp;
      const ey = y + vy * comp;
      const cx = x + vx * comp * 0.55 + tx * (t > 0.5 ? 1.2 : -1.2);
      const cy = y + vy * comp * 0.55;
      fios.push({ d: `M${x.toFixed(1)} ${y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`, cor: COR[it.status] ?? "#000" });
    }
  }
  const meio = Math.round((ini + span / 2) / 60) * 60;
  const p0 = ponto(0);
  const pm = ponto(0.5);
  const p1 = ponto(1);
  const agoraT = agora !== null && agora >= ini && agora <= fim ? tOf(agora) : null;
  return (
    <svg viewBox={`0 0 ${W} 74`} className={className} role="img" aria-label={`Linha do dia: ${items.length} atendimento${items.length === 1 ? "" : "s"} entre ${hh(ini)} e ${hh(fim)}`}>
      <path d={`M${p0.x} ${p0.y}Q${pm.x} ${Y - ARCO} ${p1.x} ${p1.y}`} fill="none" stroke="#1c1719" strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round" />
      {fios.map((f, i) => (
        <path key={i} d={f.d} fill="none" stroke={f.cor} strokeWidth="1.9" strokeLinecap="round" />
      ))}
      {agoraT !== null && (() => {
        const p = ponto(agoraT);
        return <circle cx={p.x} cy={p.y} r="4" fill="#b8305a" stroke="#f7d9df" strokeWidth="2" />;
      })()}
      <g fontSize="11" fill="#6e2b3e" fontFamily="inherit" fontWeight="600">
        <text x={X0} y="72">{hh(ini)}</text>
        {meio > ini + 90 && meio < fim - 90 && <text x={ponto(tOf(meio)).x} y="72" textAnchor="middle">{hh(meio)}</text>}
        <text x={X1} y="72" textAnchor="end">{hh(fim)}</text>
      </g>
    </svg>
  );
}
