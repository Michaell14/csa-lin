export type NewPerson = { display_name: string; grad_year: number; penn_email: string | null }

export function parsePeopleCsv(text: string): { rows: NewPerson[]; errors: string[] } {
  const rows: NewPerson[] = []
  const errors: string[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (line.trim() === '') return
    const cells = line.split(line.includes('\t') ? '\t' : ',').map(c => c.trim())
    if (i === 0 && cells[0]?.toLowerCase() === 'name') return
    const n = i + 1
    const [name = '', yearRaw = '', emailRaw = ''] = cells
    if (!name) { errors.push(`Line ${n}: name is required`); return }
    if (!/^\d{4}$/.test(yearRaw)) { errors.push(`Line ${n}: grad year must be a four-digit year`); return }
    const email = emailRaw ? emailRaw.toLowerCase() : null
    if (email && !email.includes('@')) { errors.push(`Line ${n}: email must contain @`); return }
    rows.push({ display_name: name, grad_year: Number(yearRaw), penn_email: email })
  })
  return { rows, errors }
}
