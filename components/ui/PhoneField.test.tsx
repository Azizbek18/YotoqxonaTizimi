import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PhoneField from './PhoneField'

describe('PhoneField', () => {
  it('shows the national part of a stored E.164 number and its dial code', () => {
    const html = renderToStaticMarkup(<PhoneField value="+99365123456" onChange={() => {}} />)
    // national number in the input
    expect(html).toContain('value="65123456"')
    // the +993 country is the active option
    expect(html).toContain('+993')
  })

  it('defaults an empty value to the O‘zbekiston dial code with a blank number', () => {
    const html = renderToStaticMarkup(<PhoneField value="" onChange={() => {}} />)
    expect(html).toContain('+998')
    expect(html).toContain('value=""')
  })

  it('renders a manual code input for an unrecognised country code', () => {
    const html = renderToStaticMarkup(<PhoneField value="+2099912345" onChange={() => {}} />)
    // manual "+[__]" code editor, not the country dropdown
    expect(html).toContain('aria-label="Davlat kodi"')
    expect(html).toContain('value="2099"')
  })
})
