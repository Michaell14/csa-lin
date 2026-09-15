'use client'
import type { LinGraph } from '@/lib/types'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listMilestones, type Milestone } from '@/lib/api/milestones'
import { errorMessage } from '@/lib/errors'

export function linStats(graph: LinGraph, currentYear: number) {
  const years = new Map<number, number>()
  for (const person of graph.people) years.set(person.grad_year, (years.get(person.grad_year) ?? 0) + 1)
  const alumni = graph.people.filter(person => person.grad_year < currentYear).length
  const claimed = graph.people.filter(person => person.claimed === true).length
  return { members: graph.people.length, alumni, students: graph.people.length - alumni, claimed, years: [...years.entries()].sort(([a], [b]) => a - b) }
}

export function academicYearTimeline(graph: LinGraph) {
  const years = new Map<string, { label: string; sort: number; count: number }>()
  for (const link of graph.links) {
    const raw = link.academic_year?.trim()
    if (!raw) continue
    let key = raw.toLowerCase(), label = raw, sort = Number.NEGATIVE_INFINITY
    const span = raw.match(/^(\d{4})\s*[-–]\s*(\d{2}|\d{4})$/)
    const term = raw.match(/^(spring|summer|fall|winter)\s+(\d{4})$/i)
    if (span) {
      const start = Number(span[1])
      let end = Number(span[2]); if (span[2].length === 2) end += Math.floor(start / 100) * 100
      if (end < start) end += 100
      if (end === start + 1) {
        key = `${start}-${end}`; label = `${start}–${end}`; sort = start * 10 + 9
      }
    } else if (term) {
      const order = { winter: 1, spring: 2, summer: 3, fall: 4 }[term[1].toLowerCase() as 'winter' | 'spring' | 'summer' | 'fall']
      key = `${term[2]}-${order}`; label = `${term[1][0].toUpperCase()}${term[1].slice(1).toLowerCase()} ${term[2]}`; sort = Number(term[2]) * 10 + order
    }
    const existing = years.get(key)
    years.set(key, { label, sort, count: (existing?.count ?? 0) + 1 })
  }
  return [...years.values()].sort((a, b) => b.sort - a.sort || b.label.localeCompare(a.label))
}

export function LinInsights({ graph, linId }: { graph: LinGraph; linId: string }) {
  const sb = useMemo(() => createClient(), [])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [milestoneError, setMilestoneError] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    setMilestones([]); setMilestoneError(null)
    void listMilestones(sb, linId).then(items => { if (current) setMilestones(items) }).catch(error => { if (current) setMilestoneError(errorMessage(error)) })
    return () => { current = false }
  }, [sb, linId])
  const stats = linStats(graph, new Date().getFullYear())
  const max = Math.max(1, ...stats.years.map(([, count]) => count))
  const timeline = academicYearTimeline(graph)
  const cards = [['Members', stats.members], ['Current students', stats.students], ['Alumni', stats.alumni], ['Claimed profiles', stats.claimed]] as const
  return <div className="h-full overflow-y-auto bg-surface-muted px-4 py-6 sm:px-8"><div className="mx-auto max-w-4xl space-y-6">
    <section><h2 className="heading text-lg">Lin at a glance</h2><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="card p-4"><p className="text-2xl font-semibold text-ink">{value}</p><p className="text-sm text-ink-muted">{label}</p></div>)}</div></section>
    <section className="card p-4"><h2 className="heading text-base">Members by class year</h2><div className="mt-4 space-y-2">{stats.years.map(([year, count]) => <div key={year} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-2 text-sm"><span>{year}</span><span className="h-2 overflow-hidden rounded-full bg-surface-hover"><span className="block h-full rounded-full bg-accent" style={{ width: `${count / max * 100}%` }} /></span><span className="text-right text-ink-muted">{count}</span></div>)}</div></section>
    <section className="card p-4"><h2 className="heading text-base">Recorded history</h2>{timeline.length ? <ol className="mt-3 border-l border-line pl-4">{timeline.map(year => <li key={year.label} className="relative pb-4 last:pb-0"><span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-ink-faint" /><p className="font-medium">{year.label}</p><p className="text-sm text-ink-muted">{year.count} {year.count === 1 ? 'family link' : 'family links'} recorded</p></li>)}</ol> : <p className="mt-2 text-sm text-ink-muted">Academic years haven’t been recorded for this lin yet.</p>}</section>
    {milestoneError && <p role="alert" className="error">Could not load community milestones: {milestoneError}</p>}
    {milestones.length > 0 && <section className="card p-4"><h2 className="heading text-base">Community milestones</h2><ol className="mt-3 space-y-4">{milestones.map(item => <li key={item.id}><p className="font-medium">{item.title}</p><p className="text-xs text-ink-muted">{new Date(`${item.event_date}T00:00:00`).toLocaleDateString()}</p>{item.description && <p className="mt-1 text-sm text-ink-body">{item.description}</p>}</li>)}</ol></section>}
  </div></div>
}
