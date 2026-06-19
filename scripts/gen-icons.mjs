import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

mkdirSync('public/icons', { recursive: true })

// Disegna un pallone da calcio flat (cerchio bianco + pentagono e cuciture)
function ball(cx, cy, R, opts = {}) {
  const pr = R * 0.4
  const er = R * 0.98
  const ang = (i) => ((-90 + i * 72) * Math.PI) / 180
  const pent = [0, 1, 2, 3, 4].map((i) => [cx + pr * Math.cos(ang(i)), cy + pr * Math.sin(ang(i))])
  const edge = [0, 1, 2, 3, 4].map((i) => [cx + er * Math.cos(ang(i)), cy + er * Math.sin(ang(i))])
  const ballFill = opts.ballFill ?? '#ffffff'
  const ink = opts.ink ?? '#0b1120'
  const sw = R * 0.06
  const pentPath = 'M' + pent.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' L') + ' Z'
  const seams = pent
    .map(
      (p, i) =>
        `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${edge[i][0].toFixed(1)}" y2="${edge[i][1].toFixed(1)}" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`,
    )
    .join('')
  return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${ballFill}"/><path d="${pentPath}" fill="${ink}"/>${seams}`
}

const normal = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#131a2b"/><stop offset="1" stop-color="#0b1120"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <circle cx="256" cy="256" r="198" fill="none" stroke="#16a34a" stroke-width="14"/>
  ${ball(256, 256, 170)}
</svg>`

const apple = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#131a2b"/><stop offset="1" stop-color="#0b1120"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="256" cy="256" r="198" fill="none" stroke="#16a34a" stroke-width="14"/>
  ${ball(256, 256, 170)}
</svg>`

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b1120"/>
  <circle cx="256" cy="256" r="174" fill="none" stroke="#16a34a" stroke-width="12"/>
  ${ball(256, 256, 150)}
</svg>`

const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  ${ball(48, 48, 44, { ballFill: '#ffffff', ink: '#000000' })}
</svg>`

async function render(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile('public/icons/' + file)
}

await render(normal, 192, 'icon-192.png')
await render(normal, 512, 'icon-512.png')
await render(maskable, 512, 'icon-512-maskable.png')
await render(apple, 180, 'apple-touch-icon.png')
await render(badge, 96, 'badge.png')
console.log('Icone generate in public/icons/')
