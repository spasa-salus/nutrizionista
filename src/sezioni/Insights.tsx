import { type KeyboardEvent, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CalendarRange, Info, Store, User, Users } from 'lucide-react'
import { chiama } from '../api'
import { Intestazione, Reparto, Stato, Tendina } from '../ui'

// Insights: statistiche dedotte da quello che gli utenti fanno nell'app (azione `insights`, calcolo
// in supabase/functions/admin/insights.ts). Sezioni, schede e grafici li decide il server: qui si
// disegna quello che arriva, per tipo di scheda. File identico nei pannelli admin e nutrizionista.

type Formato = 'numero' | 'percento' | 'euro' | 'minuti' | 'giorni'
type Voce = { etichetta: string; valore: number }
type Scheda =
  | { tipo: 'numeri'; titolo: string; nota?: string; voci: { etichetta: string; valore: number | null; formato: Formato }[] }
  | { tipo: 'barre' | 'colonne'; titolo: string; nota?: string; formato: Formato; voci: Voce[] }
  | { tipo: 'andamento'; titolo: string; nota?: string; formato: Formato; giorni: string[]; serie: { nome: string; valori: number[] }[] }
  | { tipo: 'mappa'; titolo: string; nota?: string; righe: string[]; colonne: string[]; valori: number[][] }
  | { tipo: 'vuoto'; titolo: string; nota: string }
type Sezione = { id: string; titolo: string; descrizione: string; gruppi: { titolo: string; schede: Scheda[] }[] }
type Rapporto = {
  dal: string; al: string; giorni: number; popolazione: number; pochi: boolean; sezioni: Sezione[]
  puntiVendita: { id: string; nome: string; ritiro: boolean }[]; fasceEta: string[]; sessi: Record<string, string>
}

const PERIODI: [string, string][] = [['7', 'Ultimi 7 giorni'], ['30', 'Ultimi 30 giorni'], ['90', 'Ultimi 3 mesi'], ['365', 'Ultimi 12 mesi']]
// Colori delle serie (stile.css, --serie-*): gli stessi del grafico del pannello B2B, validati per
// daltonismo su sfondo chiaro e scuro. Al piu' tre per grafico: una quarta tinta non passa.
const COLORI = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)']
const CHIAVE_SEZIONE = 'nq-insights-sezione'

const cifra = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 })
const soldi = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
function formatta(v: number | null, f: Formato) {
  if (v == null) return '—'
  if (f === 'percento') return `${cifra.format(v)}%`
  if (f === 'euro') return soldi.format(v)
  if (f === 'minuti') return `${cifra.format(v)} min`
  if (f === 'giorni') return `${cifra.format(v)} ${v === 1 ? 'giorno' : 'giorni'}`
  return cifra.format(v)
}
const data = (giorno: string) => new Date(`${giorno}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
const dataBreve = (giorno: string) => new Date(`${giorno}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })

// ---------- Schede ----------

function Numeri({ voci }: { voci: Extract<Scheda, { tipo: 'numeri' }>['voci'] }) {
  return (
    <dl className="cifre">
      {voci.map((v) => (
        <div key={v.etichetta}><dt>{v.etichetta}</dt><dd>{formatta(v.valore, v.formato)}</dd></div>
      ))}
    </dl>
  )
}

const Nessuno = () => <p className="tenue piccolo grafico-niente">Ancora nessun dato nel periodo.</p>

// Barre orizzontali dalla stessa linea di base, valore in punta: ogni voce si legge senza puntatore.
function Barre({ voci, formato }: { voci: Voce[]; formato: Formato }) {
  const massimo = Math.max(0, ...voci.map((v) => v.valore))
  if (massimo === 0) return <Nessuno />
  return (
    <ul className="barre">
      {voci.map((v) => (
        <li key={v.etichetta}>
          <span className="etichetta-barra">{v.etichetta}</span>
          <span className="pista" aria-hidden>{v.valore > 0 && <span className="barra-valore" style={{ width: `${(v.valore / massimo) * 100}%` }} />}</span>
          <span className="valore-barra">{formatta(v.valore, formato)}</span>
        </li>
      ))}
    </ul>
  )
}

// Colonne per le categorie ordinate (fasce d'età, minuti, importi): valore sul cappello.
function Colonne({ voci, formato }: { voci: Voce[]; formato: Formato }) {
  const massimo = Math.max(0, ...voci.map((v) => v.valore))
  if (massimo === 0) return <Nessuno />
  return (
    <ul className="colonne">
      {voci.map((v) => (
        <li key={v.etichetta}>
          {/* Il valore sta sul cappello della sua colonna: il pozzo tiene 22px per l'etichetta. */}
          <span className="pozzo">
            <span className="valore-colonna">{formatta(v.valore, formato)}</span>
            {v.valore > 0 && <span className="colonna-valore" aria-hidden style={{ height: `calc((100% - 22px) * ${v.valore / massimo})` }} />}
          </span>
          <span className="etichetta-colonna">{v.etichetta}</span>
        </li>
      ))}
    </ul>
  )
}

// Giorni della settimana per ore: una tinta sola, piu' scura dove ce n'e' di piu'.
function Mappa({ righe, colonne, valori }: { righe: string[]; colonne: string[]; valori: number[][] }) {
  const massimo = Math.max(0, ...valori.flat())
  if (massimo === 0) return <Nessuno />
  return (
    <div className="scorrevole">
      <table className="mappa">
        <thead><tr><th scope="col"><span className="sr-only">Giorno</span></th>{colonne.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {righe.map((r, i) => (
            <tr key={r}>
              <th scope="row">{r}</th>
              {valori[i].map((v, j) => (
                <td key={j} title={`${r} ore ${colonne[j]}: ${cifra.format(v)}`}
                  style={{ background: v ? `color-mix(in srgb, var(--serie-1) ${Math.round(12 + (v / massimo) * 88)}%, var(--sfondo))` : undefined }}>
                  <span className="sr-only">{cifra.format(v)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tenue piccolo legenda-mappa">
        <span>meno</span><span className="sfumatura" aria-hidden /><span>più (fino a {cifra.format(massimo)})</span>
      </p>
    </div>
  )
}

// Passo "tondo" (1, 2, 5, 10…) con al massimo 4 tacche sopra lo zero, come nel pannello B2B.
function scala(massimo: number) {
  for (let decina = 1; ; decina *= 10) {
    for (const m of [1, 2, 5]) {
      const passo = m * decina
      if (Math.ceil(massimo / passo) <= 4) return { passo, cima: Math.max(passo, Math.ceil(massimo / passo) * passo) }
    }
  }
}

// L'SVG si disegna sulla larghezza vera del contenitore (assoluto in un box ad altezza fissa): il
// testo degli assi non si rimpicciolisce e restringendo la finestra il grafico segue.
function useLarghezza() {
  const rif = useRef<HTMLDivElement>(null)
  const [larghezza, imposta] = useState(0)
  useLayoutEffect(() => {
    const el = rif.current
    if (!el) return
    imposta(Math.round(el.getBoundingClientRect().width))
    const osservatore = new ResizeObserver(([voce]) => imposta(Math.round(voce.contentRect.width)))
    osservatore.observe(el)
    return () => osservatore.disconnect()
  }, [])
  return [rif, larghezza] as const
}

const ALTEZZA = 200

function Andamento({ titolo, giorni, serie, formato }: Extract<Scheda, { tipo: 'andamento' }>) {
  const [rif, larghezza] = useLarghezza()
  const [attivo, impostaAttivo] = useState<number | null>(null)
  const ultimo = giorni.length - 1
  const massimo = Math.max(0, ...serie.flatMap((s) => s.valori))
  const { passo, cima } = scala(massimo)
  const tacche = Array.from({ length: Math.round(cima / passo) + 1 }, (_, i) => i * passo)
  const stretto = larghezza < 480
  const margine = { alto: 10, basso: 28, sinistra: Math.max(...tacche.map((t) => formatta(t, formato).length)) * 7 + 12, destra: 12 }
  const pw = Math.max(1, larghezza - margine.sinistra - margine.destra)
  const ph = ALTEZZA - margine.alto - margine.basso
  const x = (i: number) => margine.sinistra + (ultimo > 0 ? (i / ultimo) * pw : pw / 2)
  const y = (v: number) => margine.alto + ph - (v / cima) * ph
  const percorso = (valori: number[]) => valori.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const passi = stretto ? 2 : 4
  const tacchePerGiorno = [...new Set(Array.from({ length: passi + 1 }, (_, k) => Math.round((k / passi) * ultimo)))]

  function muovi(e: PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    impostaAttivo(Math.min(ultimo, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * ultimo))))
  }
  function tasto(e: KeyboardEvent<HTMLDivElement>) {
    const verso = ({ ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[e.key]
    if (verso) {
      e.preventDefault()
      impostaAttivo((i) => Math.min(ultimo, Math.max(0, (i ?? ultimo) + verso)))
    }
  }

  return (
    <>
      {serie.length > 1 && (
        <ul className="legenda">
          {serie.map((s, k) => <li key={s.nome}><span className="chiave" style={{ background: COLORI[k] }} aria-hidden />{s.nome}</li>)}
        </ul>
      )}
      <div className="grafico-linee" ref={rif} tabIndex={0} role="group" style={{ height: ALTEZZA }}
        aria-label={`${titolo}, giorno per giorno. Frecce per scorrere i giorni.`}
        onFocus={() => impostaAttivo((i) => i ?? ultimo)} onBlur={() => impostaAttivo(null)} onKeyDown={tasto}>
        {larghezza > 0 && (
          <svg width={larghezza} height={ALTEZZA} aria-hidden>
            {tacche.map((t) => (
              <g key={t}>
                <line className={t === 0 ? 'asse-zero' : 'griglia'} x1={margine.sinistra} x2={margine.sinistra + pw} y1={y(t)} y2={y(t)} />
                <text className="etichetta-asse" x={margine.sinistra - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">{formatta(t, formato)}</text>
              </g>
            ))}
            {tacchePerGiorno.map((i) => (
              <text key={i} className="etichetta-asse" x={x(i)} y={ALTEZZA - 8} textAnchor={i === 0 ? 'start' : i === ultimo ? 'end' : 'middle'}>
                {dataBreve(giorni[i])}
              </text>
            ))}
            {attivo !== null && <line className="mirino" x1={x(attivo)} x2={x(attivo)} y1={margine.alto} y2={margine.alto + ph} />}
            {serie.map((s, k) => <path key={s.nome} className="linea" d={percorso(s.valori)} style={{ stroke: COLORI[k] }} />)}
            {attivo !== null && serie.map((s, k) => (
              <circle key={s.nome} className="punto" cx={x(attivo)} cy={y(s.valori[attivo])} r={4} style={{ fill: COLORI[k] }} />
            ))}
            <rect className="bersaglio" x={margine.sinistra} y={margine.alto} width={pw} height={ph}
              onPointerMove={muovi} onPointerDown={muovi} onPointerLeave={(e) => { if (e.pointerType === 'mouse') impostaAttivo(null) }} />
          </svg>
        )}
        {massimo === 0 && <p className="grafico-vuoto">Ancora niente nel periodo</p>}
        {attivo !== null && (
          <div className={`fumetto-grafico${x(attivo) > larghezza * 0.6 ? ' a-sinistra' : ''}`} style={{ left: x(attivo) }}>
            <div className="quando">{data(giorni[attivo])}</div>
            {serie.map((s, k) => (
              <div key={s.nome} className="riga-fumetto">
                <span className="chiave" style={{ background: COLORI[k] }} /><b>{formatta(s.valori[attivo], formato)}</b><span>{s.nome}</span>
              </div>
            ))}
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {attivo !== null && `${data(giorni[attivo])}: ${serie.map((s) => `${s.nome} ${formatta(s.valori[attivo], formato)}`).join(', ')}`}
        </p>
      </div>
      <details className="apribile">
        <summary>I numeri giorno per giorno</summary>
        <div className="scorrevole tabella-giorni">
          <table className="tabella numeri">
            <thead><tr><th scope="col">Giorno</th>{serie.map((s) => <th key={s.nome} scope="col">{s.nome}</th>)}</tr></thead>
            <tbody>
              {giorni.map((_, i) => ultimo - i).map((i) => (
                <tr key={giorni[i]}><th scope="row">{data(giorni[i])}</th>{serie.map((s) => <td key={s.nome}>{formatta(s.valori[i], formato)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  )
}

function Carta({ scheda }: { scheda: Scheda }) {
  const larga = scheda.tipo === 'andamento' || scheda.tipo === 'mappa'
  return (
    <section className={`carta-insight${larga ? ' larga' : ''}${scheda.tipo === 'vuoto' ? ' spenta' : ''}`}>
      <h3>{scheda.titolo}</h3>
      {scheda.tipo === 'numeri' && <Numeri voci={scheda.voci} />}
      {scheda.tipo === 'barre' && <Barre voci={scheda.voci} formato={scheda.formato} />}
      {scheda.tipo === 'colonne' && <Colonne voci={scheda.voci} formato={scheda.formato} />}
      {scheda.tipo === 'andamento' && <Andamento {...scheda} />}
      {scheda.tipo === 'mappa' && <Mappa {...scheda} />}
      {scheda.nota && <p className="tenue piccolo nota-insight">{scheda.nota}</p>}
    </section>
  )
}

// ---------- Pagina ----------

function leggiSezione() {
  try { return localStorage.getItem(CHIAVE_SEZIONE) ?? 'utenti' } catch { return 'utenti' }
}

export default function Insights() {
  const [giorni, impostaGiorni] = useState('30')
  const [puntoVendita, impostaPuntoVendita] = useState('')
  const [eta, impostaEta] = useState('')
  const [sesso, impostaSesso] = useState('')
  const [sezione, impostaSezione] = useState(leggiSezione)
  const [dati, impostaDati] = useState<Rapporto | null>(null)
  const [errore, impostaErrore] = useState<string | null>(null)
  const [caricamento, impostaCaricamento] = useState(true)

  // Filtri cambiati in fretta: vince la risposta dell'ultima richiesta, non quella che arriva per ultima.
  useEffect(() => {
    let valida = true
    impostaCaricamento(true)
    impostaErrore(null)
    chiama<Rapporto>('insights', { giorni: Number(giorni), puntoVendita: puntoVendita || null, eta: eta || null, sesso: sesso || null })
      .then((r) => { if (valida) impostaDati(r) }, (e: Error) => { if (valida) impostaErrore(e.message) })
      .finally(() => { if (valida) impostaCaricamento(false) })
    return () => { valida = false }
  }, [giorni, puntoVendita, eta, sesso])

  function scegli(id: string) {
    impostaSezione(id)
    try { localStorage.setItem(CHIAVE_SEZIONE, id) } catch { /* resta per questa pagina */ }
  }

  const corrente = dati?.sezioni.find((s) => s.id === sezione) ?? dati?.sezioni[0]

  return (
    <>
      <Intestazione titolo="Insights"
        sottotitolo="Statistiche anonime, dedotte da quello che gli utenti scelgono nell’app: liste, piano dei pasti, ricerche, ordini e community. Solo numeri complessivi e medie, mai una persona." />
      <div className="barra filtri-insight">
        <Tendina etichetta="Periodo" icona={CalendarRange} valore={giorni} onCambia={impostaGiorni} opzioni={PERIODI} />
        <Tendina etichetta="Punto vendita" icona={Store} valore={puntoVendita} onCambia={impostaPuntoVendita}
          opzioni={[['', 'Tutti i punti vendita'], ...(dati?.puntiVendita ?? []).map((p): [string, string] => [p.id, p.ritiro ? `${p.nome} · ordini attivi` : p.nome])]} />
        <Tendina etichetta="Fascia d’età" icona={Users} valore={eta} onCambia={impostaEta}
          opzioni={[['', 'Tutte le età'], ...(dati?.fasceEta ?? []).map((f): [string, string] => [f, `${f} anni`])]} />
        <Tendina etichetta="Sesso" icona={User} valore={sesso} onCambia={impostaSesso}
          opzioni={[['', 'Tutti'], ...Object.entries(dati?.sessi ?? {})]} />
        {dati && !caricamento && <span className="tenue piccolo">{cifra.format(dati.popolazione)} utenti</span>}
      </div>
      <Stato caricamento={caricamento && !dati} errore={errore}>
        {dati?.pochi
          ? (
            <div className="avviso">
              <Info size={16} aria-hidden /> Con questi filtri ci sono meno di 5 utenti: le statistiche potrebbero far riconoscere
              qualcuno, quindi non si mostrano. Allarga il periodo o togli un filtro.
            </div>
          )
          : corrente && (
            <div className={caricamento ? 'in-aggiornamento' : undefined} aria-busy={caricamento}>
              <div className="pastiglie schede-insight" role="group" aria-label="Sezioni">
                {dati!.sezioni.map((s) => (
                  <button key={s.id} className="pastiglia" aria-pressed={s.id === corrente.id} onClick={() => scegli(s.id)}>{s.titolo}</button>
                ))}
              </div>
              <p className="sottotitolo">{corrente.descrizione}</p>
              {corrente.gruppi.map((g) => (
                <div key={g.titolo}>
                  <Reparto>{g.titolo}</Reparto>
                  <div className="griglia-insight">
                    {g.schede.map((s) => <Carta key={s.titolo} scheda={s} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
      </Stato>
    </>
  )
}
