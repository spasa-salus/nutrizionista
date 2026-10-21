import { type FormEvent, useEffect, useState } from 'react'
import { Columns3, BookOpen, Link2, LogOut, Mail, MessageCircleQuestion, Moon, Package, Camera, ShoppingBasket, Sun } from 'lucide-react'
import { chiama, salvaSessione, sessione } from './api'
import { FornitoreContenuto, useNotifica } from './ui'
import { AutorizzaMcp, BottoneMcp, richiestaMcp } from './mcp'
import Carrelli from './sezioni/Carrelli'
import Editor from './sezioni/Editor'
import Prodotti from './sezioni/Prodotti'
import Ricette from './sezioni/Ricette'
import Associazioni from './sezioni/Associazioni'
import Piatti from './sezioni/Piatti'
import Domande from './sezioni/Domande'
import Messaggi, { type Messaggio } from './sezioni/Messaggi'

const SEZIONI = [
  { reparto: 'Contenuto', voci: [
    { id: 'carrelli', nome: 'Carrelli', icona: ShoppingBasket, vista: Carrelli },
    { id: 'prodotti', nome: 'Prodotti', icona: Package, vista: Prodotti },
    { id: 'ricette', nome: 'Ricette', icona: BookOpen, vista: Ricette },
  ] },
  { reparto: 'Community', voci: [
    { id: 'piatti', nome: 'Post community', icona: Camera, vista: Piatti },
    { id: 'domande', nome: 'Domande Q&A', icona: MessageCircleQuestion, vista: Domande },
  ] },
  { reparto: 'B2B', voci: [
    { id: 'associazioni', nome: 'Associazioni', icona: Link2, vista: Associazioni },
  ] },
  { reparto: 'Sito', voci: [
    { id: 'messaggi', nome: 'Messaggi', icona: Mail, vista: Messaggi },
  ] },
]
// L'editor a colonne sta a parte: in cima al menu, staccato dalle sezioni, e prende tutta la larghezza.
const EDITOR = { id: 'editor', nome: 'Editor', icona: Columns3, vista: Editor }
const VOCI = [...SEZIONI.flatMap((s) => s.voci), EDITOR]

// ---------- Tema chiaro/scuro: di base segue il sistema, la scelta a mano resta ----------

function useTema() {
  const sistema = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'scuro' : 'chiaro'
  const [tema, imposta] = useState<string>(() => {
    try { return localStorage.getItem('nq-tema') ?? sistema() } catch { return sistema() }
  })
  useEffect(() => { document.documentElement.dataset.tema = tema }, [tema])
  return [tema, () => {
    const nuovo = tema === 'scuro' ? 'chiaro' : 'scuro'
    try { localStorage.setItem('nq-tema', nuovo) } catch { /* resta per questa pagina */ }
    imposta(nuovo)
  }] as const
}

// Il logotipo della tavola del brand (public/logo.svg, da ios/Scripts/genera-logo.py): un
// disegno con i suoi colori, uguali in tema chiaro e scuro.
function Logotipo() {
  return <img className="logotipo" src="/logo.svg" alt="NutriQuore" />
}

// ---------- Accesso: la prima volta si sceglie la password ----------

function Accesso({ impostata, onEntrato, nota }: { impostata: boolean; onEntrato: () => void; nota?: string }) {
  const [password, impostaPassword] = useState('')
  const [ripeti, impostaRipeti] = useState('')
  const [errore, impostaErrore] = useState<string | null>(null)
  const [inCorso, impostaInCorso] = useState(false)

  async function invia(e: FormEvent) {
    e.preventDefault()
    if (!impostata && password !== ripeti) return impostaErrore('Le due password non coincidono')
    impostaInCorso(true)
    impostaErrore(null)
    try {
      salvaSessione(await chiama(impostata ? 'accedi' : 'imposta', { password }))
      onEntrato()
    } catch (err) {
      impostaErrore((err as Error).message)
    } finally {
      impostaInCorso(false)
    }
  }

  return (
    <main className="accesso">
      <div className="carta-accesso">
        <Logotipo />
        <div className="motto">Pannello nutrizionista</div>
        <p className="tenue">
          {nota ?? (impostata ? 'Inserisci la password per entrare.' : 'Primo accesso: scegli la password del pannello. Almeno 12 caratteri.')}
        </p>
        <form onSubmit={invia}>
          <label className="campo">
            <span>{impostata ? 'Password' : 'Nuova password'}</span>
            <input className="input" type="password" autoComplete={impostata ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => impostaPassword(e.target.value)} minLength={impostata ? undefined : 12} required autoFocus />
          </label>
          {!impostata && (
            <label className="campo">
              <span>Ripeti la password</span>
              <input className="input" type="password" autoComplete="new-password" value={ripeti}
                onChange={(e) => impostaRipeti(e.target.value)} minLength={12} required />
            </label>
          )}
          {errore && <div className="avviso errore" role="alert">{errore}</div>}
          <button className="bottone principale pieno" disabled={inCorso}>
            {inCorso ? 'Un attimo…' : impostata ? 'Entra' : 'Imposta ed entra'}
          </button>
        </form>
      </div>
    </main>
  )
}

// ---------- Pannello ----------

function usaSezione() {
  const leggi = () => VOCI.find((v) => v.id === location.hash.slice(1)) ?? VOCI[0]
  const [voce, imposta] = useState(leggi)
  useEffect(() => {
    const cambia = () => imposta(leggi())
    window.addEventListener('hashchange', cambia)
    return () => window.removeEventListener('hashchange', cambia)
  }, [])
  return voce
}

// Quanti messaggi dal sito sono da leggere: si riconta a ogni cambio di sezione.
function useDaGuardare(voce: string) {
  const [numeri, imposta] = useState<Record<string, number>>({})
  useEffect(() => {
    chiama<Messaggio[]>('contatti.elenco')
      .then((r) => imposta((n) => ({ ...n, messaggi: r.filter((m) => !m.letto_il).length })), () => {})
  }, [voce])
  return numeri
}

function Pannello() {
  const voce = usaSezione()
  const daGuardare = useDaGuardare(voce.id)
  const [tema, cambiaTema] = useTema()
  const notifica = useNotifica()
  const Vista = voce.vista

  useEffect(() => { document.title = `${voce.nome} · NutriQuore Nutrizionista` }, [voce])

  async function esci() {
    await chiama('esci').catch(() => {})
    salvaSessione(null)
    notifica('Sei uscito')
  }

  return (
    <div className="guscio">
      <header className="testata">
        <a className="marchio" href="#">
          <Logotipo />
          <span className="ruolo">Nutrizionista</span>
        </a>
        <div className="azioni-testata">
          <BottoneMcp />
          <button className="tondo" onClick={cambiaTema} aria-label={tema === 'scuro' ? 'Tema chiaro' : 'Tema scuro'} title={tema === 'scuro' ? 'Tema chiaro' : 'Tema scuro'}>
            {tema === 'scuro' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="bottone secondario compatto" onClick={esci} aria-label="Esci"><LogOut size={16} aria-hidden /><span className="testo-largo">Esci</span></button>
        </div>
      </header>
      <div className="corpo">
        <nav className="laterale" aria-label="Sezioni">
          <a href={`#${EDITOR.id}`} className="ingresso-editor" aria-current={voce.id === EDITOR.id ? 'page' : undefined}>
            <EDITOR.icona size={22} aria-hidden />
            <span><strong>Editor</strong><small>carrelli, ricette e prodotti insieme</small></span>
          </a>
          {SEZIONI.map((s) => (
            <div key={s.reparto} style={{ display: 'contents' }}>
              <div className="reparto">{s.reparto}</div>
              {s.voci.map((v) => (
                <a key={v.id} href={`#${v.id}`} className="voce-laterale" aria-current={v.id === voce.id ? 'page' : undefined}
                  style={{ textDecoration: 'none' }}>
                  <v.icona size={20} aria-hidden />{v.nome}
                  {(daGuardare[v.id] ?? 0) > 0 && (
                    <span className="conteggio" aria-label={`${daGuardare[v.id]} da guardare`}>{daGuardare[v.id]}</span>
                  )}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <main className={`pagina${voce.id === EDITOR.id ? ' larga' : ''}`}>
          <FornitoreContenuto>
            <Vista />
          </FornitoreContenuto>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [connesso, impostaConnesso] = useState(() => !!sessione())
  const [impostata, impostaImpostata] = useState<boolean | null>(null)
  const [errore, impostaErrore] = useState<string | null>(null)
  // Un client MCP che chiede di collegarsi: prima si entra, poi si danno i permessi.
  const [richiesta, impostaRichiesta] = useState(richiestaMcp)

  useEffect(() => {
    const aggiorna = () => impostaConnesso(!!sessione())
    window.addEventListener('nq-sessione', aggiorna)
    return () => window.removeEventListener('nq-sessione', aggiorna)
  }, [])

  useEffect(() => {
    if (!connesso) chiama<{ impostata: boolean }>('stato').then((s) => impostaImpostata(s.impostata), (e) => impostaErrore(e.message))
  }, [connesso])

  if (connesso && richiesta) return <AutorizzaMcp richiesta={richiesta} pannello="Pannello nutrizionista" onChiudi={() => impostaRichiesta(null)} />
  if (connesso) return <Pannello />
  if (errore) return <main className="accesso"><div className="avviso errore">{errore}</div></main>
  if (impostata === null) return <div className="caricamento">Carico…</div>
  return <Accesso impostata={impostata} onEntrato={() => impostaConnesso(true)}
    nota={richiesta ? 'Entra per scegliere cosa può fare l’assistente AI che chiede di collegarsi.' : undefined} />
}
