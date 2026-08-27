import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

// Static social-share card (Telegram, Twitter/X, Facebook, …). 1200×630 is
// the ratio every platform crops to, so the card is built at exactly that
// size instead of reusing the square in-app illustration.
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Meningyotoqxonam.uz — Aqlli talabalar yotoqxonasi boshqaruv tizimi'

// Runs on the server at build time — reading the logo off disk and inlining
// it as a data URI is the simplest reliable way to get it into the canvas.
const logoDataUri = `data:image/png;base64,${readFileSync(
  join(process.cwd(), 'public', 'logo.png'),
).toString('base64')}`

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '96px',
          background:
            'radial-gradient(1000px 700px at 15% 0%, rgba(79,70,229,0.35), transparent 60%), radial-gradient(900px 700px at 100% 110%, rgba(124,58,237,0.28), transparent 55%), #0b1120',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} alt="" width={148} height={148} style={{ borderRadius: 40 }} />

        <div
          style={{
            marginTop: 44,
            fontSize: 74,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          Meningyotoqxonam.uz
        </div>

        <div
          style={{
            marginTop: 20,
            fontSize: 32,
            fontWeight: 500,
            color: '#c7d2fe',
            maxWidth: 900,
            lineHeight: 1.35,
          }}
        >
          Aqlli talabalar yotoqxonasi boshqaruv tizimi — arizalar, to&apos;lovlar va
          navbatchilik bir joyda.
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '100%',
            height: 12,
            background: 'linear-gradient(90deg, #6366f1, #7c3aed)',
          }}
        />
      </div>
    ),
    { ...size },
  )
}
