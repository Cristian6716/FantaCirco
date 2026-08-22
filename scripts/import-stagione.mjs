// Genera l'SQL che azzera la stagione precedente e carica rose + svincolati.
//
//   node scripts/import-stagione.mjs > /tmp/stagione.sql
//
// Sorgenti: data/rose.csv (export rose complete) e data/svincolati.xlsx
// (listone Mantra). Dagli svincolati sono esclusi i "fuori lista" (asterisco).
// Lo script è idempotente: rigenera sempre lo stesso SQL, che a sua volta
// ricostruisce players da zero — si può rilanciare se una rosa va corretta.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import XLSX from 'xlsx'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Il CSV usa il soprannome del fantallenatore, il DB il nome della squadra.
const TEAM_BY_OWNER = {
  Marco: 'Sesko e Sambia',
  Lorenzo: 'Rubin Kebab',
  Damiano: 'Fc Padre Tempo',
  Stefan: 'Fessa Kyoto Fc',
  Gabbo: 'Minotoro',
  Pezzu: 'Hadjuk Spanato',
  Angelico: 'Frocinone',
  Fritto: 'Energy Team',
  Putin: 'Figli di Putin',
  Riccardo: 'One Pisa',
  Dima: 'Napolethanos',
  Qara: 'QARABAGGIO',
  Rod: 'SAO SALVADOR',
  Mirko: 'PASSAMO ALLE COSE FORMALI',
  Salvatori: 'Fredin FC',
  Triboli: 'Cani della Malesia',
}

// Squadre rinominate: vecchio team_name -> nome attuale. Il nome squadra e'
// anche il display_name.
const RINOMINATE = {
  'Rocks Pirates': 'SAO SALVADOR',
  VILTRUM: 'SAO SALVADOR',
  'Come VaVa': 'PASSAMO ALLE COSE FORMALI',
  'Beautiful Abbyssinian': 'Frocinone',
  'Lang olodelsesso': 'Hadjuk Spanato',
  'Soh Matta': 'Minotoro',
  Minotorino: 'Minotoro',
}

// Budget di partenza dell'asta estiva (Frocinone ne aveva uno in più).
const START_CREDITS = 500
const START_CREDITS_BY_TEAM = { Frocinone: 501 }

const SERIE_A = {
  ATA: 'Atalanta', BOL: 'Bologna', CAG: 'Cagliari', COM: 'Como', FIO: 'Fiorentina',
  FRO: 'Frosinone', GEN: 'Genoa', INT: 'Inter', JUV: 'Juventus', LAZ: 'Lazio',
  LEC: 'Lecce', MIL: 'Milan', MON: 'Monza', NAP: 'Napoli', PAR: 'Parma',
  ROM: 'Roma', SAS: 'Sassuolo', TOR: 'Torino', UDI: 'Udinese', VEN: 'Venezia',
}

const MANTRA_ROLES = ['Por', 'Dd', 'Ds', 'Dc', 'B', 'E', 'M', 'C', 'W', 'T', 'A', 'Pc']

/** Estrae i codici ruolo Mantra da "Dd/Ds", "M;C", "Dc,Ds"… scartando l'ignoto. */
function parseRoles(field) {
  return String(field ?? '')
    .split(/[;/|,\s]+/)
    .map((tok) => MANTRA_ROLES.find((r) => r.toLowerCase() === tok.trim().toLowerCase()))
    .filter(Boolean)
}

function parseCSV(txt) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i]
    if (quoted) {
      if (c === '"') {
        if (txt[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = [] }
    else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

const q = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const n = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? String(Math.round(x)) : 'null'
}

// ---- Rose ----
const roseRows = parseCSV(readFileSync(join(root, 'data/rose.csv'), 'utf8')).slice(1)
const rose = []
for (const c of roseRows) {
  if (!c[1]) continue
  const owner = c[0].trim()
  const team = TEAM_BY_OWNER[owner]
  if (!team) throw new Error(`Fantallenatore senza squadra mappata: "${owner}"`)
  rose.push({
    name: c[1].trim(),
    real_team: SERIE_A[c[2].trim()] ?? c[2].trim(),
    ruolo: c[3].trim(),
    roles: parseRoles(c[4]),
    price: Number(c[5]),
    quotazione: Number(c[6]),
    quotazione_mantra: Number(c[7]),
    fantacalcio_id: Number(c[8]),
    owner_team: team,
  })
}

// ---- Svincolati (niente "fuori lista": colonna con asterisco) ----
const wb = XLSX.readFile(join(root, 'data/svincolati.xlsx'))
const sheet = wb.Sheets[wb.SheetNames[0]]
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
const head = raw[0].map((h) => String(h).trim().toLowerCase())
const col = (label) => head.indexOf(label)
const iId = col('#'), iName = col('nome'), iOut = col('fuori lista'), iTeam = col('sq.')
const iRuolo = col('r.'), iMantra = col('r.mantra'), iQuot = col('quot.')
if ([iName, iOut, iTeam, iMantra, iQuot].some((i) => i === -1)) {
  throw new Error(`Colonne inattese nel listone: ${raw[0].join(' | ')}`)
}

const svincolati = []
let esclusi = 0
for (const r of raw.slice(1)) {
  const name = String(r[iName] ?? '').trim()
  if (!name) continue
  if (String(r[iOut] ?? '').trim() === '*') { esclusi++; continue }
  svincolati.push({
    name,
    real_team: String(r[iTeam] ?? '').trim(),
    ruolo: String(r[iRuolo] ?? '').trim(),
    roles: parseRoles(r[iMantra]),
    quotazione: Number(r[iQuot]),
    fantacalcio_id: Number(r[iId]),
  })
}

// ---- Crediti residui per squadra ----
const spentByTeam = {}
for (const p of rose) spentByTeam[p.owner_team] = (spentByTeam[p.owner_team] ?? 0) + p.price

const out = []
const say = (s) => out.push(s)

say('-- Generato da scripts/import-stagione.mjs — non modificare a mano.')
say('begin;')
say('')
say('-- 1) Azzeramento stagione precedente (resta ranking_generale).')
say('delete from bids;')
say('delete from autobids;')
say('delete from auction_participants;')
say('delete from auctions;')
say('delete from players;')
say('delete from pronostici;')
say('delete from punteggi_giornata;')
say('delete from torneo_overrides;')
say('delete from podio_votes;')
say('delete from podio_rounds;')
say('delete from push_outbox;')
say('update giornate set pronostici_chiusi = false;')
say('update partite set gol_casa = null, gol_trasferta = null;')
say('')
say('-- 2) Squadre rinominate quest\'anno.')
for (const [vecchio, nuovo] of Object.entries(RINOMINATE)) {
  say(`update managers set team_name = '${nuovo}', display_name = '${nuovo}' where team_name = '${vecchio}';`)
}
say('-- Il calendario si riaggancia agli account per nome squadra.')
say('update partite p set casa_manager = m.id from managers m where m.team_name = p.casa;')
say('update partite p set trasferta_manager = m.id from managers m where m.team_name = p.trasferta;')
say('')
say('-- 3) Rose complete. assigned_to resta null per le squadre senza account:')
say('--    ci pensa claim_team alla registrazione. owner_team è la fonte di verità.')
say(
  'insert into players(name, real_team, roles, ruolo, status, owner_team, assigned_to, price, quotazione, quotazione_mantra, fantacalcio_id)\n' +
    "select v.nome, v.sq, coalesce(string_to_array(nullif(v.ruoli, ''), '/'), '{}'), v.r, 'assigned', v.team, m.id, v.prezzo, v.qt, v.qtm, v.fid\n" +
    'from (values',
)
say(
  rose
    .map(
      (p) =>
        `(${q(p.name)},${q(p.real_team)},${q(p.roles.join('/'))},${q(p.ruolo)},${q(p.owner_team)},${n(p.price)},${n(p.quotazione)},${n(p.quotazione_mantra)},${n(p.fantacalcio_id)})`,
    )
    .join(',\n'),
)
say(') as v(nome, sq, ruoli, r, team, prezzo, qt, qtm, fid)')
say('left join managers m on m.team_name = v.team;')
say('')
say(`-- 4) Svincolati disponibili (${esclusi} fuori lista esclusi).`)
say(
  'insert into players(name, real_team, roles, ruolo, status, quotazione, quotazione_mantra, fantacalcio_id)\n' +
    "select v.nome, v.sq, coalesce(string_to_array(nullif(v.ruoli, ''), '/'), '{}'), v.r, 'available', v.qt, v.qt, v.fid\n" +
    'from (values',
)
say(
  svincolati
    .map(
      (p) =>
        `(${q(p.name)},${q(p.real_team)},${q(p.roles.join('/'))},${q(p.ruolo)},${n(p.quotazione)},${n(p.fantacalcio_id)})`,
    )
    .join(',\n'),
)
say(') as v(nome, sq, ruoli, r, qt, fid);')
say('')
say('-- 5) Crediti residui = budget di partenza − speso all\'asta estiva.')
for (const [team, spent] of Object.entries(spentByTeam).sort()) {
  const start = START_CREDITS_BY_TEAM[team] ?? START_CREDITS
  say(`update managers set credits_total = ${start - spent} where team_name = ${q(team)}; -- ${start} - ${spent}`)
}
say('')
say('commit;')

process.stdout.write(out.join('\n') + '\n')

process.stderr.write(
  `rose: ${rose.length} giocatori su ${Object.keys(spentByTeam).length} squadre\n` +
    `svincolati: ${svincolati.length} (esclusi ${esclusi} fuori lista)\n`,
)
