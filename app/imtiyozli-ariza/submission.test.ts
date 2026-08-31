import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('imtiyozli ariza yakuniy yuborilishi', () => {
  it("otasining ismi yo'q tanlovini API ga yuboradi", () => {
    const pageSource = fs.readFileSync(path.join(process.cwd(), 'app/imtiyozli-ariza/page.tsx'), 'utf8')
    const routeSource = fs.readFileSync(path.join(process.cwd(), 'app/api/imtiyozli-requests/route.ts'), 'utf8')

    expect(pageSource).toContain("submission.append('noMiddleName', noMiddleName ? 'true' : 'false')")
    expect(routeSource).toContain("form.get('noMiddleName')")
    expect(routeSource).toContain("noMiddleName ? null : getNamePartError(middleName, 'Otasining ismi')")
  })
})
