import { createContext, type KeyboardEvent as TastoReact, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, type LucideIcon, Minus, Plus, Search, Trash2, X } from 'lucide-react'
import { chiama } from './api'
import type { Carrello, Contenuto, TipoContenuto } from './dominio'

// ---------- Notifiche ----------

type Notifica = { testo: string; errore?: boolean }
const ContestoNotifica = createContext<(testo: string, errore?: boolean) => void>(() => {})
export const useNotifica = () => useContext(ContestoNotifica)

export function FornitoreNotifica({ children }: { children: ReactNode }) {
  const [notifica, imposta] = useState<Notifica | null>(null)
  const timer = useRef<number>(undefined)
  const mostra = useCallback((testo: string, errore = false) => {
    imposta({ testo, errore })
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => imposta(null), errore ? 6000 : 2500)
  }, [])
  return (
    <ContestoNotifica.Provider value={mostra}>
      {children}
      {notifica && (
        <div className={`notifica${notifica.errore ? ' errore' : ''}`} role={notifica.errore ? 'alert' : 'status'}>
          {notifica.testo}
        </div>
      )}
    </ContestoNotifica.Provider>
  )
}

// ---------- Contenuto: una revisione in memoria, ogni modifica ne pubblica una nuova ----------

type ContestoC = {
  contenuto: Contenuto | null
  errore: string | null
  salva: (tipo: TipoContenuto, elemento: object, nuovo: boolean) => Promise<boolean>
  elimina: (tipo: TipoContenuto, id: string) => Promise<boolean>
  /** Il carrello e gli id delle sue ricette in una revisione sola; il carrello nuovo prende l'id dal nome sul server. */
  salvaCarrello: (carrello: Carrello, ricette: string[], nuovo: boolean) => Promise<boolean>
  ricarica: () => void
}
const ContestoContenuto = createContext<ContestoC>(null as never)
export const useContenuto = () => useContext(ContestoContenuto)

export function FornitoreContenuto({ children }: { children: ReactNode }) {
  const [contenuto, imposta] = useState<Contenuto | null>(null)
  const [errore, impostaErrore] = useState<string | null>(null)
  const notifica = useNotifica()

  const ricarica = useCallback(() => {
    chiama<Contenuto>('contenuto.leggi').then(imposta, (e) => impostaErrore(e.message))
  }, [])
  useEffect(ricarica, [ricarica])

  const pubblica = async (azione: string, parametri: object) => {
    try {
      const nuovo = await chiama<Contenuto>(azione, { ...parametri, revisione: contenuto?.revisione })
      imposta(nuovo)
      notifica(`Pubblicato · revisione ${nuovo.revisione}`)
      return true
    } catch (e) {
      notifica((e as Error).message, true)
      return false
    }
  }

  return (
    <ContestoContenuto.Provider value={{
      contenuto, errore, ricarica,
      salva: (tipo, elemento, nuovo) => pubblica('contenuto.salva', { tipo, elemento, nuovo }),
      elimina: (tipo, id) => pubblica('contenuto.elimina', { tipo, id }),
      salvaCarrello: (carrello, ricette, nuovo) => pubblica('carrelli.salva', { carrello, ricette, nuovo }),
    }}>
      {children}
    </ContestoContenuto.Provider>
  )
}

/** Un elenco letto dal server con ricarica, per le sezioni fuori dal contenuto. */
export function useElenco<T>(azione: string) {
  const [righe, imposta] = useState<T[] | null>(null)
  const [errore, impostaErrore] = useState<string | null>(null)
  const ricarica = useCallback(() => {
    chiama<T[]>(azione).then((r) => { imposta(r); impostaErrore(null) }, (e) => impostaErrore(e.message))
  }, [azione])
  useEffect(ricarica, [ricarica])
  return { righe, errore, ricarica }
}

// ---------- Pezzi di pagina ----------

export function Intestazione({ titolo, sottotitolo, azione }: { titolo: string; sottotitolo?: ReactNode; azione?: ReactNode }) {
  return (
    <header className="intestazione">
      <div>
        <h1 className="titolo">{titolo}</h1>
        {sottotitolo && <p className="sottotitolo">{sottotitolo}</p>}
      </div>
      {azione}
    </header>
  )
}

export function BottoneNuovo({ testo = 'Nuovo', onClick }: { testo?: string; onClick: () => void }) {
  return <button className="bottone principale" onClick={onClick}><Plus size={18} strokeWidth={2.5} />{testo}</button>
}

export function Cerca({ valore, onCambia, segnaposto = 'Cerca' }: { valore: string; onCambia: (v: string) => void; segnaposto?: string }) {
  return (
    <label className="cerca">
      <Search size={18} aria-hidden />
      <span className="sr-only">{segnaposto}</span>
      <input className="input" type="search" value={valore} placeholder={segnaposto} onChange={(e) => onCambia(e.target.value)} />
    </label>
  )
}

export function Reparto({ children }: { children: ReactNode }) {
  return <h2 className="reparto">{children}</h2>
}

export function Stato({ caricamento, errore, vuoto, children }: { caricamento: boolean; errore?: string | null; vuoto?: boolean; children: ReactNode }) {
  if (errore) return <div className="avviso errore">{errore}</div>
  if (caricamento) return <div className="caricamento">Carico…</div>
  if (vuoto) return <div className="vuoto">Niente da mostrare.</div>
  return <>{children}</>
}

// ---------- Campi ----------

export function Campo({ etichetta, aiuto, children }: { etichetta: string; aiuto?: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{etichetta}</span>
      {children}
      {aiuto && <small>{aiuto}</small>}
    </label>
  )
}

/** Scelte multiple a pastiglia: crema, salvia con la spunta quando scelte. */
export function Pastiglie({ opzioni, valori, onCambia, etichetta }: {
  opzioni: [string, string][]; valori: string[]; onCambia: (v: string[]) => void; etichetta: string
}) {
  return (
    <div className="campo">
      <span>{etichetta}</span>
      <div className="pastiglie" role="group" aria-label={etichetta}>
        {opzioni.map(([valore, nome]) => {
          const scelto = valori.includes(valore)
          return (
            <button type="button" key={valore} className="pastiglia" aria-pressed={scelto}
              onClick={() => onCambia(scelto ? valori.filter((v) => v !== valore) : [...valori, valore])}>
              {scelto ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
              {nome}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Menu a tendina che si riconosce come tale: freccia in un cerchio a destra, icona della scelta
 * a sinistra. Sotto c'e' un select vero, cosi' tastiera, lettori di schermo e telefoni lo aprono
 * con il loro selettore.
 */
/** `gruppi` dopo le `opzioni`: ognuno col suo titolo nel menu. */
export function Tendina({ valore, opzioni = [], gruppi = [], onCambia, etichetta, icona: Icona, classe }: {
  valore: string; opzioni?: [string, string][]; gruppi?: [string, [string, string][]][]; onCambia: (v: string) => void; etichetta: string
  icona?: LucideIcon; classe?: string
}) {
  return (
    <span className={`tendina${Icona ? ' con-icona' : ''}${classe ? ` ${classe}` : ''}`}>
      {Icona && <Icona size={20} className="icona-tendina" aria-hidden />}
      <select value={valore} aria-label={etichetta} onChange={(e) => onCambia(e.target.value)}>
        {opzioni.map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}
        {gruppi.map(([titolo, voci]) => (
          <optgroup key={titolo} label={titolo}>
            {voci.map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}
          </optgroup>
        ))}
      </select>
      <span className="freccia" aria-hidden><ChevronDown size={18} strokeWidth={2.5} /></span>
    </span>
  )
}

/** Un numero da toccare piu' che da scrivere: meno, valore (scrivibile), piu'. */
export function Contatore({ valore, onCambia, min, max, passo = 1, unita, etichetta }: {
  valore: number; onCambia: (v: number) => void; min: number; max: number; passo?: number; unita?: string; etichetta: string
}) {
  const valido = Number.isFinite(valore)
  const porta = (v: number) => onCambia(Math.min(max, Math.max(min, v)))
  return (
    <span className="contatore" role="group" aria-label={etichetta}>
      <button type="button" aria-label={`${etichetta}: meno`} disabled={valido && valore <= min}
        onClick={() => porta(valido ? valore - passo : min)}><Minus size={16} strokeWidth={2.5} /></button>
      <input type="number" inputMode="numeric" min={min} max={max} aria-label={etichetta} value={valido ? valore : ''}
        onChange={(e) => onCambia(e.target.valueAsNumber)} />
      {unita && <span className="unita" aria-hidden>{unita}</span>}
      <button type="button" aria-label={`${etichetta}: più`} disabled={valido && valore >= max}
        onClick={() => porta(valido ? valore + passo : min)}><Plus size={16} strokeWidth={2.5} /></button>
    </span>
  )
}

/**
 * Un pannello che compare sotto un bottone: si chiude toccando fuori o con Esc. Esc si ferma qui
 * e non chiude anche il foglio sotto, che ascolta su window.
 */
export function useComparsa() {
  const [aperta, impostaAperta] = useState(false)
  const contenitore = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aperta) return
    // In fondo a un foglio il pannello finirebbe sotto il bordo: lo si porta in vista.
    contenitore.current?.querySelector('.comparsa')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const fuori = (e: MouseEvent) => { if (!contenitore.current?.contains(e.target as Node)) impostaAperta(false) }
    document.addEventListener('mousedown', fuori)
    return () => document.removeEventListener('mousedown', fuori)
  }, [aperta])
  const alEsc = (e: TastoReact, poi?: () => void) => {
    if (e.key !== 'Escape' || !aperta) return
    e.stopPropagation()
    impostaAperta(false)
    poi?.()
  }
  return { aperta, impostaAperta, contenitore, alEsc }
}

/**
 * Scelta multipla in un menu a tendina: caselle, ricerca e prima le voci gia' scelte. Regge
 * centinaia di voci senza riempire il foglio.
 */
export function SceltaMultipla({ opzioni, valori, onCambia, etichetta, nessuna, cercaSegnaposto = 'Cerca' }: {
  opzioni: [string, string][]; valori: string[]; onCambia: (v: string[]) => void; etichetta: string
  nessuna: string; cercaSegnaposto?: string
}) {
  const { aperta, impostaAperta, contenitore, alEsc } = useComparsa()
  const bottone = useRef<HTMLButtonElement>(null)
  const [filtro, impostaFiltro] = useState('')
  // L'ordine si fissa all'apertura: spuntando, le voci non devono saltare sotto il dito.
  const [ordine, impostaOrdine] = useState<string[]>([])
  const nome = new Map(opzioni)
  const scelti = new Set(valori)
  const riassunto = valori.length === 0 ? nessuna
    : valori.length <= 2 ? valori.map((v) => nome.get(v) ?? v).join(', ')
    : `${nome.get(valori[0]) ?? valori[0]} e altri ${valori.length - 1}`
  const apri = () => {
    impostaOrdine([...opzioni].sort((a, b) => Number(scelti.has(b[0])) - Number(scelti.has(a[0]))).map(([v]) => v))
    impostaFiltro('')
    impostaAperta(true)
  }
  const f = filtro.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const visibili = ordine.filter((v) => !f || (nome.get(v) ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(f))

  return (
    <div className="scelta-multipla" ref={contenitore} onKeyDown={(e) => alEsc(e, () => bottone.current?.focus())}>
      <button type="button" ref={bottone} className={`tendina-bottone${valori.length ? '' : ' vuoto'}`} aria-haspopup="true" aria-expanded={aperta}
        onClick={() => (aperta ? impostaAperta(false) : apri())}>
        <span className="sr-only">{etichetta}: </span>
        <span className="riassunto">{riassunto}</span>
        {valori.length > 0 && <span className="conta">{valori.length}</span>}
        <span className="freccia" aria-hidden><ChevronDown size={18} strokeWidth={2.5} /></span>
      </button>
      {aperta && (
        <div className="comparsa" role="group" aria-label={etichetta}>
          <label className="cerca">
            <Search size={16} aria-hidden />
            <span className="sr-only">{cercaSegnaposto}</span>
            <input className="input" type="search" autoFocus value={filtro} placeholder={cercaSegnaposto} onChange={(e) => impostaFiltro(e.target.value)} />
          </label>
          <div className="voci">
            {visibili.map((v) => (
              <label key={v} className="voce-casella">
                <input type="checkbox" checked={scelti.has(v)}
                  onChange={(e) => onCambia(e.target.checked ? [...valori, v] : valori.filter((x) => x !== v))} />
                <span className="casella" aria-hidden><Check size={14} strokeWidth={3} /></span>
                {nome.get(v)}
              </label>
            ))}
            {visibili.length === 0 && <p className="tenue piccolo" style={{ margin: 8 }}>Nessun risultato per «{filtro.trim()}».</p>}
          </div>
          <div className="piede-comparsa">
            <span className="tenue piccolo">{valori.length} {valori.length === 1 ? 'scelto' : 'scelti'}</span>
            <button type="button" className="bottone secondario compatto" disabled={!valori.length} onClick={() => onCambia([])}>Nessuno</button>
            <button type="button" className="bottone principale compatto" onClick={() => { impostaAperta(false); bottone.current?.focus() }}>Fatto</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Foglio: il sheet senza barra di navigazione dell'app ----------

export function Foglio({ titolo, onChiudi, children, piede, stretto }: {
  titolo: string; onChiudi: () => void; children: ReactNode; piede?: ReactNode; stretto?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const precedente = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input:not([disabled]), textarea, select')?.focus()
    // Con due fogli aperti (un prodotto creato dagli abbinamenti) Esc chiude solo quello sopra.
    const esc = (e: KeyboardEvent) => {
      const fogli = document.querySelectorAll('.foglio')
      if (e.key === 'Escape' && fogli[fogli.length - 1] === ref.current) onChiudi()
    }
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', esc)
      if (!document.querySelector('.velo')) document.body.style.overflow = ''
      precedente?.focus()
    }
  }, [onChiudi])
  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onChiudi()}>
      <div ref={ref} className={`foglio${stretto ? ' stretto' : ''}`} role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="maniglia" />
        <div className="testa-foglio">
          <h2>{titolo}</h2>
          <button className="tondo" onClick={onChiudi} aria-label="Chiudi"><X size={20} /></button>
        </div>
        <div className="corpo-foglio">{children}</div>
        {piede && <div className="piede-foglio">{piede}</div>}
      </div>
    </div>
  )
}

/** Il piede standard dei fogli di modifica: elimina (in due tocchi) a sinistra, salva a destra. */
export function PiedeModifica({ onSalva, onElimina, inCorso, disabilitato, manca, testoSalva = 'Salva e pubblica' }: {
  onSalva: () => void; onElimina?: () => void; inCorso: boolean; disabilitato?: boolean
  /** Perche' non si puo' ancora salvare, accanto al bottone spento. */
  manca?: string | null
  testoSalva?: string
}) {
  return (
    <>
      {onElimina && <BottoneElimina onConferma={onElimina} disabilitato={inCorso} />}
      <div className="spazio" />
      {manca && <span className="manca">{manca}</span>}
      <button className="bottone principale" onClick={onSalva} disabled={inCorso || disabilitato}>
        {inCorso ? 'Salvo…' : testoSalva}
      </button>
    </>
  )
}

export function BottoneElimina({ onConferma, disabilitato, testo = 'Elimina' }: { onConferma: () => void; disabilitato?: boolean; testo?: string }) {
  const [armato, arma] = useState(false)
  useEffect(() => {
    if (!armato) return
    const t = setTimeout(() => arma(false), 4000)
    return () => clearTimeout(t)
  }, [armato])
  return armato
    ? <button className="bottone distruttivo" onClick={onConferma} disabled={disabilitato}><Trash2 size={18} />Conferma: {testo.toLowerCase()}</button>
    : <button className="bottone secondario" style={{ color: 'var(--pomodoro)', borderColor: 'var(--pomodoro)' }} onClick={() => arma(true)} disabled={disabilitato}>{testo}</button>
}

/** Stato di un foglio di modifica: l'elemento in bozza e se e' nuovo. */
export function useBozza<T>() {
  const [bozza, imposta] = useState<{ valore: T; nuovo: boolean } | null>(null)
  const [inCorso, impostaInCorso] = useState(false)
  return {
    bozza,
    apri: (valore: T, nuovo = false) => imposta({ valore: structuredClone(valore), nuovo }),
    chiudi: useCallback(() => imposta(null), []),
    cambia: (modifica: Partial<T>) => imposta((b) => b && { ...b, valore: { ...b.valore, ...modifica } }),
    inCorso,
    /** Esegue e chiude il foglio solo se e' andata bene. */
    esegui: async (operazione: () => Promise<boolean>) => {
      impostaInCorso(true)
      const ok = await operazione().finally(() => impostaInCorso(false))
      if (ok) imposta(null)
    },
  }
}
