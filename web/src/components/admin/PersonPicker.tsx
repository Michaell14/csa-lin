'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { searchPeople, type PersonHit } from '@/lib/api/people'
import { SearchBox } from '@/components/SearchBox'

export function PersonPicker({ label, value, onPick }: { label: string; value: PersonHit | null; onPick: (h: PersonHit | null) => void }) {
  const sb = useMemo(() => createClient(), [])
  const [key, setKey] = useState(0)
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="label">{label}</span>
      {value
        ? <span className="flex h-10 items-center gap-2 font-medium">{value.display_name} &#39;{String(value.grad_year).slice(-2)} <button onClick={() => { onPick(null); setKey(k => k + 1) }} className="link">change</button></span>
        : <SearchBox key={key} search={q => searchPeople(sb, q)} onPick={onPick} placeholder={label} />}
    </div>
  )
}
