'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts'

// ── Design tokens (match globals.css) ─────────────────────────────────────────

const COLORS = {
  blue900: '#0b1f3a',
  blue800: '#123e7c',
  blue700: '#1d559a',
  blue600: '#2f6db5',
  blue500: '#3f82cf',
  blue400: '#6fa8dc',
  blue300: '#a9cef2',
  green: '#0b8a5b',
  greenSoft: '#e8f7f1',
  amber: '#b86b00',
  amberSoft: '#fff4df',
  red: '#bd2f3d',
  redSoft: '#ffecef',
  purple: '#6843c6',
  muted: '#5f7188',
  muted2: '#8a98aa',
  line: '#e3ecf6',
  surface: '#ffffff',
  bg: '#f5f9ff',
}

const CHART_PALETTE = [
  COLORS.blue800,
  COLORS.blue600,
  COLORS.blue400,
  COLORS.green,
  COLORS.amber,
  COLORS.purple,
  COLORS.red,
  COLORS.blue300,
  '#5b8fb9',
  '#94b8d8',
]

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload?: { name?: string; pct?: number } }>; label?: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{
      background: COLORS.blue900,
      color: '#fff',
      padding: '10px 14px',
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 8px 24px rgba(11,31,58,0.18)',
      lineHeight: 1.5,
    }}>
      <div style={{ fontSize: 11, color: COLORS.blue300, marginBottom: 2 }}>{label || p.payload?.name}</div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>
        {p.value}
        {p.payload?.pct !== undefined && (
          <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 6, color: COLORS.blue400 }}>
            ({p.payload.pct}%)
          </span>
        )}
      </div>
    </div>
  )
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────

interface HBarData {
  name: string
  value: number
  pct: number
}

export function HBarChart({ data, total }: { data: Record<string, number>; total: number }) {
  const entries: HBarData[] = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({
      name,
      value,
      pct: total ? Math.round(value / total * 100) : 0,
    }))

  if (!entries.length) return <div className="empty">Sem dados para exibir.</div>

  const height = Math.max(entries.length * 40 + 16, 120)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={entries} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fontWeight: 600, fill: COLORS.blue900 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(111,168,220,0.08)' }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16} animationDuration={600} animationEasing="ease-out">
          {entries.map((_, idx) => (
            <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Donut / Pie Chart ─────────────────────────────────────────────────────────

interface DonutData {
  name: string
  value: number
  pct: number
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DonutData }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: COLORS.blue900,
      color: '#fff',
      padding: '10px 14px',
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 8px 24px rgba(11,31,58,0.18)',
    }}>
      <div style={{ fontSize: 11, color: COLORS.blue300, marginBottom: 2 }}>{d.name}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>
        {d.value}
        <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 6, color: COLORS.blue400 }}>
          ({d.pct}%)
        </span>
      </div>
    </div>
  )
}

function DonutLabel({ cx, cy, label }: { cx: number; cy: number; label: string }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: 'Bahnschrift, sans-serif' }}>
      <tspan x={cx} dy="-4" fontSize="28" fontWeight="800" fill={COLORS.blue900}>{label}</tspan>
      <tspan x={cx} dy="22" fontSize="11" fontWeight="700" fill={COLORS.muted2}>SCORE</tspan>
    </text>
  )
}

export function DonutChart({ data, total, centerLabel }: { data: Record<string, number>; total: number; centerLabel: string }) {
  const entries: DonutData[] = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: total ? Math.round(value / total * 100) : 0,
    }))

  if (!entries.length) return <div className="empty">Sem dados.</div>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={entries}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={56}
          outerRadius={82}
          paddingAngle={2}
          animationDuration={800}
          animationEasing="ease-out"
          stroke="none"
        >
          {entries.map((_, idx) => (
            <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<DonutTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.blue900, marginLeft: 4 }}>{value}</span>
          )}
        />
        {/* Center label rendered via customized label */}
        <Pie
          data={[{ name: '', value: 1 }]}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={0}
          outerRadius={0}
          label={({ cx, cy }) => <DonutLabel cx={cx} cy={cy} label={centerLabel} />}
          isAnimationActive={false}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Mini Sparkline Area ───────────────────────────────────────────────────────

interface SparkData {
  label: string
  value: number
}

export function SparkArea({ data, color = COLORS.blue600 }: { data: SparkData[]; color?: string }) {
  if (data.length < 2) return null
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${color.replace('#', '')})`}
          animationDuration={600}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Vertical Bar Chart (for status/risk distributions) ────────────────────────

export function VBarChart({ data, total }: { data: Record<string, number>; total: number }) {
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({
      name: name.length > 14 ? name.slice(0, 12) + '…' : name,
      fullName: name,
      value,
      pct: total ? Math.round(value / total * 100) : 0,
    }))

  if (!entries.length) return <div className="empty">Sem dados para exibir.</div>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={entries} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fontWeight: 600, fill: COLORS.muted }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: COLORS.muted2 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as { fullName: string; value: number; pct: number }
            return (
              <div style={{
                background: COLORS.blue900,
                color: '#fff',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                boxShadow: '0 8px 24px rgba(11,31,58,0.18)',
              }}>
                <div style={{ fontSize: 11, color: COLORS.blue300, marginBottom: 2 }}>{d.fullName}</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {d.value}
                  <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 6, color: COLORS.blue400 }}>({d.pct}%)</span>
                </div>
              </div>
            )
          }}
          cursor={{ fill: 'rgba(111,168,220,0.08)' }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={28} animationDuration={600} animationEasing="ease-out">
          {entries.map((_, idx) => (
            <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Progress Gauge (mini radial for score) ────────────────────────────────────

export function ProgressGauge({ value, size = 120 }: { value: number; size?: number }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference
  const color = value >= 80 ? COLORS.green : value >= 60 ? COLORS.amber : COLORS.red

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={COLORS.line}
        strokeWidth={8}
      />
      {/* Value arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }}
      />
      {/* Center text */}
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        dominantBaseline="central"
        fill={COLORS.blue900}
        fontSize={size * 0.22}
        fontWeight={800}
        fontFamily="Bahnschrift, sans-serif"
        letterSpacing="-0.04em"
      >
        {value}%
      </text>
      <text
        x={size / 2}
        y={size / 2 + size * 0.14}
        textAnchor="middle"
        dominantBaseline="central"
        fill={COLORS.muted2}
        fontSize={9}
        fontWeight={700}
        letterSpacing="0.1em"
      >
        SCORE
      </text>
    </svg>
  )
}
