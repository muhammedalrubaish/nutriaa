// Interactive room map (viewBox 300×240): window at the top, door at the bottom,
// beds B/A on the right and C/D on the left (1=A, 2=B, 3=C, 4=D).
const TABLES = [
  [130, 40],
  [156, 40],
  [130, 160],
  [156, 160],
]

const BEDS = [
  { num: 1, label: 'A', x: 170, y: 148, w: 116, h: 74, head: 'right' },
  { num: 2, label: 'B', x: 170, y: 18, w: 116, h: 74, head: 'right' },
  { num: 3, label: 'C', x: 14, y: 18, w: 116, h: 74, head: 'left' },
  { num: 4, label: 'D', x: 14, y: 148, w: 116, h: 74, head: 'left' },
]

export default function BedMap({ selected, onSelect }) {
  return (
    <svg
      viewBox="0 0 300 240"
      className="w-full max-w-sm mx-auto select-none rounded-2xl"
      style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }}
    >
      <rect width="300" height="240" rx="8" fill="#0d1424" />
      <rect x="0" y="0" width="300" height="12" fill="#1e293b" />
      <rect x="0" y="228" width="105" height="12" fill="#1e293b" />
      <rect x="195" y="228" width="105" height="12" fill="#1e293b" />
      <rect x="0" y="0" width="12" height="240" fill="#1e293b" />
      <rect x="288" y="0" width="12" height="240" fill="#1e293b" />
      <rect x="96" y="0" width="108" height="12" fill="#0c2d4a" />
      <rect x="100" y="2" width="48" height="8" rx="1" fill="#38bdf8" opacity="0.35" />
      <rect x="152" y="2" width="48" height="8" rx="1" fill="#38bdf8" opacity="0.35" />
      <line x1="150" y1="1" x2="150" y2="11" stroke="#0c2d4a" strokeWidth="2.5" />
      <text x="150" y="9.5" textAnchor="middle" fontSize="5.5" fill="#7dd3fc" fontFamily="system-ui">
        نافذة
      </text>
      <path d="M 105 228 Q 150 184 195 228" fill="none" stroke="#334155" strokeWidth="1.5" strokeDasharray="5,3" />
      <line x1="105" y1="220" x2="105" y2="240" stroke="#334155" strokeWidth="2" />
      <line x1="195" y1="220" x2="195" y2="240" stroke="#334155" strokeWidth="2" />
      <text x="150" y="238" textAnchor="middle" fontSize="5.5" fill="#64748b" fontFamily="system-ui">
        باب
      </text>
      <rect x="130" y="12" width="40" height="216" fill="#070d18" opacity="0.6" />
      {TABLES.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="14" height="14" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1" />
      ))}
      {BEDS.map(({ num, label, x, y, w, h, head }) => {
        const on = selected === num
        const headX = head === 'left' ? x : x + w - 10
        const bodyX = head === 'left' ? x + 10 : x
        const bodyW = w - 10
        const pillowX = head === 'left' ? x + 10 + 6 : x + bodyW - 38
        const lineX = head === 'left' ? x + 10 + 44 : x + bodyW - 44
        const stroke = on ? '#059669' : '#293e55'
        return (
          <g key={label} onClick={() => onSelect(num)} style={{ cursor: 'pointer' }}>
            <rect x={x + 3} y={y + 3} width={w} height={h} rx="5" fill="rgba(0,0,0,0.45)" />
            <rect x={bodyX} y={y} width={bodyW} height={h} rx="4" fill={on ? '#064e3b' : '#162032'} stroke={stroke} strokeWidth="1.5" />
            <rect x={headX} y={y} width={10} height={h} rx="3" fill={on ? '#047857' : '#1a3050'} stroke={stroke} strokeWidth="1.5" />
            <rect x={pillowX} y={y + 10} width={32} height={20} rx="5" fill={on ? '#10b981' : '#1e3a5f'} opacity="0.9" />
            <line x1={lineX} y1={y + 6} x2={lineX} y2={y + h - 6} stroke={on ? '#34d399' : '#293e55'} strokeWidth="1" opacity="0.7" />
            <text
              x={x + w / 2}
              y={y + h / 2 + 9}
              textAnchor="middle"
              fontSize="26"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
              fill={on ? '#ffffff' : '#475569'}
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
