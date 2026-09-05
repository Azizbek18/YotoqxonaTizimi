import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300004_payment_batch_per_month_year.sql', import.meta.url),
  'utf8',
)

// A student paying across the academic year's Dekabr->Yanvar boundary in one
// upload (e.g. Noyabr+Dekabr+Yanvar+Fevral) spans two real calendar years.
// submit_payment_batch_atomic used to take one `p_year` for the whole batch —
// now it takes `p_years`, one entry per p_months/p_amounts entry.
describe('payment batch per-month year (202609300004)', () => {
  it('drops both old single-p_year signatures (the 10-arg compat overload and the 11-arg real one)', () => {
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.submit_payment_batch_atomic\(\s*uuid, text, text\[\], integer\[\], integer, text, text, uuid, text, text\s*\);/)
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.submit_payment_batch_atomic\(\s*uuid, text, text\[\], integer\[\], integer, text, text, uuid, text, text, text\s*\);/)
  })

  it('recreates with p_years integer[] in place of p_year integer', () => {
    expect(sql).toMatch(/CREATE FUNCTION public\.submit_payment_batch_atomic\(/)
    expect(sql).toMatch(/p_years integer\[\],/)
    expect(sql).not.toMatch(/p_year integer,/)
  })

  it('validates p_years has one entry per month, each a plausible year, before inserting', () => {
    expect(sql).toMatch(/v_month_count <> coalesce\(array_length\(p_years, 1\), 0\)/)
    expect(sql).toMatch(/FROM unnest\(p_years\) AS year_value\(year\)\s*\n\s*WHERE year_value\.year IS NULL OR year_value\.year < 2020 OR year_value\.year > 2100/)
  })

  it('inserts each row with its own paired year via a 3-way unnest, not one shared p_year', () => {
    expect(sql).toMatch(/FROM unnest\(p_months, p_amounts, p_years\) AS batch\(month, amount, year\)/)
    expect(sql).toMatch(/batch\.year,/)
  })

  it('re-locks the new 11-arg signature down to service_role only', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.submit_payment_batch_atomic\(\s*uuid, text, text\[\], integer\[\], integer\[\], text, text, uuid, text, text, text\s*\) FROM PUBLIC, anon, authenticated;/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.submit_payment_batch_atomic\(\s*uuid, text, text\[\], integer\[\], integer\[\], text, text, uuid, text, text, text\s*\) TO service_role;/)
  })

  it('keeps the ai_review + transaction-id + receipt-claim checks untouched', () => {
    expect(sql).toMatch(/p_ai_review IS NULL OR p_ai_review NOT IN \('passed', 'manual'\)/)
    expect(sql).toMatch(/RAISE EXCEPTION 'Receipt upload claim not found' USING ERRCODE = '23503'/)
    expect(sql).toMatch(/RAISE EXCEPTION 'Active student required' USING ERRCODE = '42501'/)
  })
})
