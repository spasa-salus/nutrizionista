import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Check, Plus, Search, Trash2, X } from 'lucide-react'
import { chiama } from './api'
import type { Contenuto, TipoContenuto } from './dominio'

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
export function PiedeModifica({ onSalva, onElimina, inCorso, testoSalva = 'Salva e pubblica' }: {
  onSalva: () => void; onElimina?: () => void; inCorso: boolean; testoSalva?: string
}) {
  return (
    <>
      {onElimina && <BottoneElimina onConferma={onElimina} disabilitato={inCorso} />}
      <div className="spazio" />
      <button className="bottone principale" onClick={onSalva} disabled={inCorso}>
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
