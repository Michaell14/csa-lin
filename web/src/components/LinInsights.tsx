'use client'
import type { LinGraph } from '@/lib/types'

export function linStats(graph: LinGraph, asOf: Date) {
  const years = new Map<number, number>()
  for (const person of graph.people) years.set(person.grad_year, (years.get(person.grad_year) ?? 0) + 1)
  // Treat a class as graduated after spring commencement. Before June, the
  // current class year is still counted among students.
  const graduatedThroughYear = asOf.getFullYear() - (asOf.getMonth() < 5 ? 1 : 0)
  const alumni = graph.people.filter(person => person.grad_year <= graduatedThroughYear).length
  const claimed = graph.people.filter(person => person.claimed === true).length
  return { members: graph.people.length, alumni, students: graph.people.length - alumni, claimed, years: [...years.entries()].sort(([a], [b]) => a - b) }
}

export function LinInsights({ graph }: { graph: LinGraph }) {
  const stats = linStats(graph, new Date())
  const max = Math.max(1, ...stats.years.map(([, count]) => count))
  const cards = [['Members', stats.members], ['Current students', stats.students], ['Alumni', stats.alumni], ['Claimed profiles', stats.claimed]] as const
  return <div className="h-full overflow-y-auto bg-surface-muted px-4 py-6 sm:px-8"><div className="mx-auto max-w-4xl space-y-6">
    <section><h2 className="heading text-lg">Lin at a glance</h2><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="card p-4"><p className="text-2xl font-semibold text-ink tabular-nums">{value}</p><p className="text-sm text-ink-muted">{label}</p></div>)}</div></section>
    <section className="card p-4"><h2 className="heading text-base">Members by class year</h2><div className="mt-4 space-y-2">{stats.years.map(([year, count]) => <div key={year} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-2 text-sm tabular-nums"><span>{year}</span><span className="h-2 overflow-hidden rounded-full bg-surface-hover"><span className="block h-full rounded-full bg-accent" style={{ width: `${count / max * 100}%` }} /></span><span className="text-right text-ink-muted">{count}</span></div>)}</div></section>
  </div></div>
}
