export default function ScoreRing({ score, size=56 }: { score:number, size?:number }) {
  const r = 22, c = 2*Math.PI*r
  const pct = Math.max(0, Math.min(100, score))/100
  const dash = c*pct
  const color = score>=80? '#10B981' : score>=60? '#F59E0B' : '#EF4444'
  return (
    <div className="relative grid place-items-center" style={{ width:size, height:size }}>
      <svg width={size} height={size} viewBox="0 0 52 52" className="-rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#E2E8F0" strokeWidth="5"/>
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${dash} ${c-dash}`} style={{ transition:'stroke-dasharray 600ms ease' }}/>
      </svg>
      <div className="absolute font-display font-bold text-sm" style={{ color }}>{score}</div>
    </div>
  )
}
