'use client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { submitCorrection, type CorrectionKind } from '@/lib/api/corrections'
import { errorMessage } from '@/lib/errors'

export function ReportIssue({ personId }: { personId?: string }) {
  const sb = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false), [details, setDetails] = useState(''), [sent, setSent] = useState(false), [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<CorrectionKind>(personId ? 'profile' : 'missing_person')
  // The side panel keeps this form mounted while the viewer moves between
  // people, so a draft or a sent confirmation would otherwise carry over and be
  // submitted against whoever is shown next.
  useEffect(() => {
    setOpen(false); setDetails(''); setSent(false); setError(null)
    setKind(personId ? 'profile' : 'missing_person')
  }, [personId])
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (details.trim().length < 10) { setError('Please include at least 10 characters.'); return }
    try { await submitCorrection(sb, { kind, personId, details }); setSent(true); setOpen(false) } catch (err) { setError(errorMessage(err)) }
  }
  if (sent) return <p className="text-sm font-bold text-success">Thanks — CSA admins received your report.</p>
  if (!open) return <button onClick={() => setOpen(true)} className="link text-sm">{personId ? 'Suggest a correction' : 'Request a missing person'}</button>
  return <form onSubmit={submit} className="card p-3 text-sm">
    <p className="display text-base">Help improve the lin</p>
    {personId && <select value={kind} onChange={e => setKind(e.target.value as CorrectionKind)} className="input-sm mt-2"><option value="profile">Profile information</option><option value="relationship">Big/little relationship</option></select>}
    <textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={2000} rows={4} placeholder={personId ? 'What should be corrected?' : 'Name, class year, and any known lin relationships'} className="input mt-2 h-auto py-2" />
    {error && <p role="alert" className="error mt-2">{error}</p>}
    <div className="mt-2 flex gap-2"><button className="btn-sm-accent">Submit</button><button type="button" onClick={() => setOpen(false)} className="btn-sm">Cancel</button></div>
  </form>
}
