import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ArizaTilxatDocument, { type ArizaTilxatData } from './ArizaTilxatDocument'

const BASE: ArizaTilxatData = {
  fullName: 'Anorqulov Islom Yoʻlchi oʻgʻli',
  facultyLabel: 'Amaliy matematika va intellektual texnologiyalar',
  course: 1,
  studyType: 'kontrakt',
  originCountry: "O'zbekiston",
  originRegion: 'Toshkent',
  phone: '901234567',
  relativePhone: '+998901112233',
  ttjName: '12',
}

describe('ArizaTilxatDocument', () => {
  it('leaves the signature / date / dekanat lines blank on the pre-sign preview', () => {
    const html = renderToStaticMarkup(<ArizaTilxatDocument data={BASE} />)
    expect(html).toContain('_____________________________')
    expect(html).not.toContain('<img')
    expect(html).toContain('Ariza № _________')
  })

  it('shows the applicant signature, typed name and signed date once signed', () => {
    const html = renderToStaticMarkup(
      <ArizaTilxatDocument
        data={{ ...BASE, studentSignature: 'data:image/png;base64,iVBORw0KGgo=', signedDate: '2026-09-04T09:00:00Z' }}
      />,
    )
    // signature stamped on both the Ariza and the Tilxat page
    expect(html.match(/data:image\/png;base64,iVBORw0KGgo=/g)).toHaveLength(2)
    expect(html).toContain('Anorqulov Islom Yoʻlchi oʻgʻli')
    expect(html).toContain('04.09.2026')
  })

  it('shows the dekan signature, Ariza № and room once a room is assigned', () => {
    const html = renderToStaticMarkup(
      <ArizaTilxatDocument
        data={{
          ...BASE,
          studentSignature: 'data:image/png;base64,AAAA',
          signedDate: '2026-09-04',
          dekanSignature: 'data:image/png;base64,BBBB',
          dekanName: 'Islomov Sardor Akmalovich',
          arizaNo: 'YT-2026-0042',
          assignedFloor: 3,
          assignedRoom: '312',
        }}
      />,
    )
    expect(html).toContain('YT-2026-0042')
    expect(html).toContain('Berildi 3 qavat 312 xona')
    expect(html.match(/Dekan: Islomov Sardor Akmalovich/g)).toHaveLength(2)
  })

  it('renders a foreign (+993) phone without forcing a +998 prefix', () => {
    const html = renderToStaticMarkup(
      <ArizaTilxatDocument data={{ ...BASE, phone: '+99365123456', relativePhone: '+992501234567' }} />,
    )
    expect(html).toContain('Talaba tel: +993 651 234 56')
    expect(html).toContain('Yaqin qarindoshi tel: +992 501 234 567')
    expect(html).not.toContain('+998 +993')
  })

  it('still renders a legacy bare 9-digit number as an O‘zbekiston number', () => {
    const html = renderToStaticMarkup(<ArizaTilxatDocument data={BASE} />)
    expect(html).toContain('Talaba tel: +998 901 234 567')
  })
})
