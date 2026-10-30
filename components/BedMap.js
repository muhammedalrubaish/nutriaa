// Interactive room map drawn in an oblique "3D" view: the floor plan is seen from above and
// every object is extruded upwards (a point at height z is drawn z px higher than its floor spot).
// Window on the far wall, door at the bottom, beds B/A on the right and C/D on the left
// (1=A, 2=B, 3=C, 4=D), each with its own monitor, IV pole and bedside cabinet.

const BEDS = [
  { num: 1, label: 'A', x: 172, y: 206, head: 'right' },
  { num: 2, label: 'B', x: 172, y: 80, head: 'right' },
  { num: 3, label: 'C', x: 12, y: 80, head: 'left' },
  { num: 4, label: 'D', x: 12, y: 206, head: 'left' },
]
const W = 116 // bed length
const D = 62 // bed width (depth on the plan)

/** A box standing on the plan rect (x, y, w, d) between heights z0 and z1: front face + top face. */
function Box({ x, y, w, d, z0 = 0, z1, top, front, rx = 1.5, stroke }) {
  return (
    <g>
      <rect x={x} y={y + d - z1} width={w} height={z1 - z0} rx={rx} fill={front} />
      <rect x={x} y={y - z1} width={w} height={d} rx={rx} fill={top} stroke={stroke} strokeWidth={stroke ? 1.2 : 0} />
    </g>
  )
}

const PALETTE = {
  off: {
    head: ['#475569', '#334155'],
    blanket: ['#3b5b8a', '#2c4469'],
    label: '#e2e8f0',
    glow: null,
  },
  on: {
    head: ['#10b981', '#047857'],
    blanket: ['#10b981', '#059669'],
    label: '#ffffff',
    glow: 'url(#bm-glow)',
  },
}

function Equipment({ x, y, head }) {
  // Behind the bed head: patient monitor on a stand and an IV pole with a drip bag.
  const mx = head === 'left' ? x + 18 : x + W - 18
  const ix = head === 'left' ? x + 44 : x + W - 44
  const fy = y - 3 // floor depth of both stands
  return (
    <g>
      <ellipse cx={ix} cy={fy} rx="6" ry="2" fill="#000" opacity="0.35" />
      <line x1={ix} y1={fy} x2={ix} y2={fy - 62} stroke="#94a3b8" strokeWidth="1.3" />
      <line x1={ix - 5} y1={fy - 62} x2={ix + 5} y2={fy - 62} stroke="#94a3b8" strokeWidth="1.3" />
      <rect x={ix + 1.5} y={fy - 61} width="7" height="10" rx="2.5" fill="#bae6fd" opacity="0.85" stroke="#e0f2fe" strokeWidth="0.5" />
      <line x1={ix + 5} y1={fy - 51} x2={ix + 5} y2={fy - 40} stroke="#bae6fd" strokeWidth="0.6" />

      <ellipse cx={mx} cy={fy} rx="7" ry="2.2" fill="#000" opacity="0.35" />
      <line x1={mx} y1={fy} x2={mx} y2={fy - 34} stroke="#64748b" strokeWidth="2" />
      <Box x={mx - 14} y={fy - 3} w={28} d={3} z0={33} z1={53} top="#334155" front="#1e293b" rx={2} />
      <rect x={mx - 12} y={fy - 51} width="24" height="15" rx="1" fill="#020617" />
      <polyline
        points={`${mx - 11},${fy - 43} ${mx - 6},${fy - 43} ${mx - 4.5},${fy - 48} ${mx - 3},${fy - 40} ${mx - 1.5},${fy - 43} ${mx + 4},${fy - 43}`}
        fill="none"
        stroke="#22c55e"
        strokeWidth="0.8"
      />
      <text x={mx + 10.5} y={fy - 45} textAnchor="end" fontSize="4.2" fontWeight="bold" fill="#22c55e" fontFamily="system-ui">
        72
      </text>
      <text x={mx + 10.5} y={fy - 39} textAnchor="end" fontSize="4.2" fontWeight="bold" fill="#38bdf8" fontFamily="system-ui">
        98
      </text>
    </g>
  )
}

function Bed({ num, label, x, y, head, on, onSelect }) {
  const p = on ? PALETTE.on : PALETTE.off
  const left = head === 'left'
  const hb = 7 // headboard thickness
  const fb = 5 // footboard thickness
  const mx = left ? x + hb : x + fb // mattress
  const mw = W - hb - fb
  const my = y + 2
  const md = D - 4
  const pillowX = left ? mx + 3 : mx + mw - 25
  const bx = left ? mx + 28 : mx // blanket covers the foot end
  const bw = mw - 28
  const railX = left ? mx + 2 : mx + mw - 42
  const select = () => onSelect(num)

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`سرير ${label}`}
      aria-pressed={on}
      onClick={select}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select())}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      {/* Hit area: the bed and its boards only, so the two rows never overlap. */}
      <rect x={x - 3} y={y - 32} width={W + 6} height={D + 34} fill="transparent" />
      <Equipment x={x} y={y} head={head} />
      <rect x={x + 3} y={y + 5} width={W} height={D} rx="8" fill="#000" opacity="0.4" filter="url(#bm-blur)" />
      <g filter={p.glow || undefined}>
        {/* Frame on wheels */}
        <Box x={mx + 2} y={y + 6} w={mw - 4} d={D - 12} z0={4} z1={9} top="#475569" front="#334155" />
        {[mx + 6, mx + mw - 6].map((cx) => (
          <circle key={cx} cx={cx} cy={y + D - 4} r="2.4" fill="#0f172a" stroke="#64748b" strokeWidth="0.8" />
        ))}
        {/* Mattress, pillow, blanket */}
        <Box x={mx} y={my} w={mw} d={md} z0={9} z1={17} top="#e2e8f0" front="#94a3b8" rx={3} />
        <Box x={pillowX} y={my + 6} w={22} d={md - 12} z0={17} z1={20} top="#ffffff" front="#cbd5e1" rx={5} />
        <Box x={bx} y={my - 1} w={bw} d={md + 2} z0={8} z1={19} top={p.blanket[0]} front={p.blanket[1]} rx={3} />
        <rect x={left ? bx : bx + bw - 6} y={my - 1 - 19} width="6" height={md + 2} rx="2" fill="#f1f5f9" opacity="0.9" />
        {/* Head and foot boards */}
        <Box x={left ? x : x + W - hb} y={y} w={hb} d={D} z1={31} top={p.head[0]} front={p.head[1]} rx={2} />
        <Box x={left ? x + W - fb : x} y={y + 2} w={fb} d={D - 4} z1={22} top={p.head[0]} front={p.head[1]} rx={2} />
        {/* Side rail along the near side of the head half */}
        <rect x={railX} y={y + D - 25} width="40" height="2.6" rx="1.3" fill="#cbd5e1" />
        {[railX + 3, railX + 37].map((rx) => (
          <rect key={rx} x={rx - 1} y={y + D - 25} width="2" height="8" fill="#94a3b8" />
        ))}
      </g>
      <text
        x={bx + bw / 2}
        y={my - 19 + md / 2 + 9}
        textAnchor="middle"
        fontSize="26"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
        fill={p.label}
        style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 2 }}
      >
        {label}
      </text>
      {on && (
        <g>
          <circle cx={left ? x + W - 4 : x + 4} cy={y - 24} r="7" fill="#10b981" stroke="#ecfdf5" strokeWidth="1.2" />
          <path
            d={`M ${(left ? x + W - 4 : x + 4) - 3} ${y - 24} l 2 2.2 l 4 -4.4`}
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  )
}

function Cabinet({ x, y }) {
  return (
    <g>
      <rect x={x + 2} y={y + 3} width="15" height="14" rx="2" fill="#000" opacity="0.35" filter="url(#bm-blur)" />
      <Box x={x} y={y} w={15} d={14} z1={17} top="#cbd5e1" front="#94a3b8" rx={1.5} />
      <line x1={x + 2} y1={y + 14 - 9} x2={x + 13} y2={y + 14 - 9} stroke="#64748b" strokeWidth="0.6" />
      <rect x={x + 6} y={y + 14 - 7} width="3" height="1" rx="0.5" fill="#475569" />
      {/* A water cup on top */}
      <rect x={x + 9} y={y - 17 + 3} width="3.5" height="5" rx="0.8" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="0.4" />
    </g>
  )
}

export default function BedMap({ selected, onSelect }) {
  return (
    <svg viewBox="0 0 300 302" className="w-full max-w-sm mx-auto select-none rounded-2xl" style={{ filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.5))' }}>
      <defs>
        <pattern id="bm-tiles" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="#1b2a41" />
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#24364f" strokeWidth="0.8" />
        </pattern>
        <linearGradient id="bm-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334155" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="bm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
        <filter id="bm-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id="bm-glow" x="-15%" y="-30%" width="130%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#10b981" floodOpacity="0.85" />
        </filter>
      </defs>

      {/* Floor and the far wall with the window */}
      <rect width="300" height="302" rx="10" fill="#0b1324" />
      <rect x="8" y="34" width="284" height="256" fill="url(#bm-tiles)" />
      <rect x="0" y="0" width="300" height="36" rx="10" fill="url(#bm-wall)" />
      <rect x="0" y="33" width="300" height="3" fill="#475569" />
      <rect x="98" y="5" width="104" height="22" rx="2" fill="#0c2d4a" />
      <rect x="101" y="8" width="47" height="16" rx="1" fill="url(#bm-sky)" opacity="0.85" />
      <rect x="152" y="8" width="47" height="16" rx="1" fill="url(#bm-sky)" opacity="0.85" />
      <path d="M 104 10 l 10 -0 l -8 12 z" fill="#fff" opacity="0.18" />
      <path d="M 92 4 q 4 12 0 24 l 8 0 q -3 -12 0 -24 z" fill="#64748b" opacity="0.8" />
      <path d="M 208 4 q -4 12 0 24 l -8 0 q 3 -12 0 -24 z" fill="#64748b" opacity="0.8" />
      <text x="150" y="33" textAnchor="middle" fontSize="5.5" fill="#bae6fd" fontFamily="system-ui">
        نافذة
      </text>

      {/* Side walls */}
      <rect x="0" y="34" width="8" height="268" fill="#334155" />
      <rect x="292" y="34" width="8" height="268" fill="#334155" />

      {/* Aisle */}
      <rect x="133" y="36" width="34" height="254" fill="#0f1b2e" opacity="0.45" />

      {/* Back row first, then the front row, so nearer objects overlap farther ones */}
      {[BEDS[1], BEDS[2]].map((b) => (
        <Bed key={b.label} {...b} on={selected === b.num} onSelect={onSelect} />
      ))}
      <Cabinet x={134} y={124} />
      <Cabinet x={151} y={124} />
      {[BEDS[0], BEDS[3]].map((b) => (
        <Bed key={b.label} {...b} on={selected === b.num} onSelect={onSelect} />
      ))}
      <Cabinet x={134} y={250} />
      <Cabinet x={151} y={250} />

      {/* Near wall with the door */}
      <rect x="0" y="290" width="108" height="12" fill="#334155" />
      <rect x="192" y="290" width="108" height="12" fill="#334155" />
      <path d="M 108 290 Q 150 256 192 290" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="5,3" />
      <text x="150" y="299" textAnchor="middle" fontSize="5.5" fill="#94a3b8" fontFamily="system-ui">
        باب
      </text>
    </svg>
  )
}
