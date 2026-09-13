'use client'
import type { LinGraph } from '@/lib/types'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listMilestones, type Milestone } from '@/lib/api/milestones'

export function linStats(graph: LinGraph, currentYear: number) {
  const years = new Map<number, number>()
  for (const person of graph.people) years.set(person.grad_year, (years.get(person.grad_year) ?? 0) + 1)
  const alumni = graph.people.filter(person => person.grad_year < currentYear).length
  const claimed = graph.people.filter(person => person.claimed === true).length
  return { members: graph.people.length, alumni, students: graph.people.length - alumni, claimed, years: [...years.entries()].sort(([a], [b]) => a - b) }
}

export function LinInsights({ graph, linId }: { graph: LinGraph; linId: string }) {
  const sb = useMemo(() => createClient(), [])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  useEffect(() => { void listMilestones(sb, linId).then(setMilestones) }, [sb, linId])
  const stats = linStats(graph, new Date().getFullYear())
  const max = Math.max(1, ...stats.years.map(([, count]) => count))
  const timeline = [...new Set(graph.links.map(link => link.academic_year).filter((year): year is string => Boolean(year)))].sort().reverse()
  const cards = [['Members', stats.members], ['Current students', stats.students], ['Alumni', stats.alumni], ['Claimed profiles', stats.claimed]] as const
  return <div className="h-full overflow-y-auto bg-neutral-50 px-4 py-6 sm:px-8"><div className="mx-auto max-w-4xl space-y-8">
    <section><h2 className="text-lg font-semibold">Lin at a glance</h2><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-neutral-500">{label}</p></div>)}</div></section>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Members by class year</h2><div className="mt-4 space-y-2">{stats.years.map(([year, count]) => <div key={year} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-2 text-sm"><span>{year}</span><span className="h-3 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-neutral-800" style={{ width: `${count / max * 100}%` }} /></span><span className="text-right text-neutral-500">{count}</span></div>)}</div></section>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Recorded history</h2>{timeline.length ? <ol className="mt-3 border-l-2 border-neutral-200 pl-4">{timeline.map(year => { const count = graph.links.filter(link => link.academic_year === year).length; return <li key={year} className="relative pb-4 last:pb-0"><span className="absolute -left-[1.34rem] top-1 h-2.5 w-2.5 rounded-full bg-neutral-800" /><p className="font-medium">{year}</p><p className="text-sm text-neutral-500">{count} {count === 1 ? 'family link' : 'family links'} recorded</p></li> })}</ol> : <p className="mt-2 text-sm text-neutral-500">Academic years haven’t been recorded for this lin yet.</p>}</section>
    {milestones.length > 0 && <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Community milestones</h2><ol className="mt-3 space-y-4">{milestones.map(item => <li key={item.id}><p className="font-medium">{item.title}</p><p className="text-xs text-neutral-500">{new Date(`${item.event_date}T00:00:00`).toLocaleDateString()}</p>{item.description && <p className="mt-1 text-sm">{item.description}</p>}</li>)}</ol></section>}
  </div></div>
}
