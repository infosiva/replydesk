'use client'

import { useState } from 'react'
import type { DbCalendarItem } from '@/lib/types'

const STATUS_COLORS: Record<DbCalendarItem['status'], string> = {
  draft: 'bg-white/20',
  in_review: 'bg-yellow-400',
  approved: 'bg-green-400',
  scheduled: 'bg-blue-400',
  published: 'bg-purple-400',
}

const STATUS_LABELS: Record<DbCalendarItem['status'], string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export function CalendarGrid({ items }: { items: DbCalendarItem[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const byDay = new Map<string, DbCalendarItem[]>()
  for (const item of items) {
    if (!item.publish_date) continue
    const d = item.publish_date.slice(0, 10)
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d)!.push(item)
  }

  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition">
          ‹
        </button>
        <h2 className="text-base font-semibold text-white">{monthLabel}</h2>
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs text-white/30 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-white/5 rounded-xl overflow-hidden">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="bg-[#0a0a0f] min-h-[72px]" />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayItems = byDay.get(key) ?? []
          const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate()
          return (
            <div key={i} className="bg-[#0a0a0f] p-1.5 min-h-[72px]">
              <span className={`text-xs font-medium inline-flex w-5 h-5 items-center justify-center rounded-full ${
                isToday ? 'bg-purple-600 text-white' : 'text-white/40'
              }`}>
                {day}
              </span>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {dayItems.map(item => (
                  <span
                    key={item.id}
                    title={`${item.platform ?? 'Content'} — ${STATUS_LABELS[item.status]}`}
                    className={`w-2 h-2 rounded-full ${STATUS_COLORS[item.status]}`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-4">
        {(Object.keys(STATUS_COLORS) as DbCalendarItem['status'][]).map(s => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-white/50">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s]}`} />
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  )
}
