import { describe, it, expect } from 'vitest'
import { parsePeopleCsv } from '@/lib/csv'

describe('parsePeopleCsv', () => {
  it('parses comma and tab rows, skipping header and blanks', () => {
    const text = 'name,grad_year,penn_email\nAlice Wang, 2022, Alice@UPenn.edu\n\nBob Chen\t2023\tbob@seas.upenn.edu\nCathy Liu,2023,'
    const { rows, errors } = parsePeopleCsv(text)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { display_name: 'Alice Wang', grad_year: 2022, penn_email: 'alice@upenn.edu' },
      { display_name: 'Bob Chen', grad_year: 2023, penn_email: 'bob@engineering.upenn.edu' },
      { display_name: 'Cathy Liu', grad_year: 2023, penn_email: null },
    ])
  })
  it('reports bad rows with line numbers and keeps good ones', () => {
    const { rows, errors } = parsePeopleCsv('Ann,20x2,a@upenn.edu\nBen,2024,not-an-email\nCal,2025,c@upenn.edu\n,2025,d@upenn.edu')
    expect(rows.map(r => r.display_name)).toEqual(['Cal'])
    expect(errors).toEqual([
      'Line 1: grad year must be a four-digit year',
      'Line 2: email must contain @',
      'Line 4: name is required',
    ])
  })
})
