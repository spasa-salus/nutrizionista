import { type FormEvent, useEffect, useState } from 'react'
import { BookOpen, LogOut, MessageCircleQuestion, Moon, Package, Camera, ShoppingBasket, Store, Sun } from 'lucide-react'
import { chiama, salvaSessione, sessione } from './api'
import { FornitoreContenuto, useNotifica } from './ui'
import Carrelli from './sezioni/Carrelli'
import Prodotti from './sezioni/Prodotti'
import Ricette from './sezioni/Ricette'
import Supermercati from './sezioni/Supermercati'
import Piatti from './sezioni/Piatti'
import Domande from './sezioni/Domande'

const SEZIONI = [
  { reparto: 'Contenuto', voci: [
    { id: 'carrelli', nome: 'Carrelli', icona: ShoppingBasket, vista: Carrelli },
    { id: 'prodotti', nome: 'Prodotti', icona: Package, vista: Prodotti },
    { id: 'ricette', nome: 'Ricette', icona: BookOpen, vista: Ricette },
    { id: 'supermercati', nome: 'Supermercati', icona: Store, vista: Supermercati },
  ] },
  { reparto: 'Community', voci: [
    { id: 'piatti', nome: 'Post community', icona: Camera, vista: Piatti },
    { id: 'domande', nome: 'Domande Q&A', icona: MessageCircleQuestion, vista: Domande },
  ] },
]
const VOCI = SEZIONI.flatMap((s) => s.voci)

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

function Logotipo() {
  return <span className="logotipo" aria-label="NutriQuore"><span className="nutri">Nutri</span><span className="quore">Quore</span></span>
}

// ---------- Accesso: la prima volta si sceglie la password ----------

function Accesso({ impostata, onEntrato }: { impostata: boolean; onEntrato: () => void }) {
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
        <img src="/icona.png" alt="" />
        <Logotipo />
        <div className="motto">Pannello nutrizionista</div>
        <p className="tenue">
          {impostata ? 'Inserisci la password per entrare.' : 'Primo accesso: scegli la password del pannello. Almeno 12 caratteri.'}
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

function Pannello() {
  const voce = usaSezione()
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
          <img src="/icona.png" alt="" />
          <Logotipo />
          <span className="ruolo">Nutrizionista</span>
        </a>
        <div className="azioni-testata">
          <button className="tondo" onClick={cambiaTema} aria-label={tema === 'scuro' ? 'Tema chiaro' : 'Tema scuro'} title={tema === 'scuro' ? 'Tema chiaro' : 'Tema scuro'}>
            {tema === 'scuro' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="bottone secondario compatto" onClick={esci}><LogOut size={16} />Esci</button>
        </div>
      </header>
      <div className="corpo">
        <nav className="laterale" aria-label="Sezioni">
          {SEZIONI.map((s) => (
            <div key={s.reparto} style={{ display: 'contents' }}>
              <div className="reparto">{s.reparto}</div>
              {s.voci.map((v) => (
                <a key={v.id} href={`#${v.id}`} className="voce-laterale" aria-current={v.id === voce.id ? 'page' : undefined}
                  style={{ textDecoration: 'none' }}>
                  <v.icona size={20} aria-hidden />{v.nome}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <main className="pagina">
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

  useEffect(() => {
    const aggiorna = () => impostaConnesso(!!sessione())
    window.addEventListener('nq-sessione', aggiorna)
    return () => window.removeEventListener('nq-sessione', aggiorna)
  }, [])

  useEffect(() => {
    if (!connesso) chiama<{ impostata: boolean }>('stato').then((s) => impostaImpostata(s.impostata), (e) => impostaErrore(e.message))
  }, [connesso])

  if (connesso) return <Pannello />
  if (errore) return <main className="accesso"><div className="avviso errore">{errore}</div></main>
  if (impostata === null) return <div className="caricamento">Carico…</div>
  return <Accesso impostata={impostata} onEntrato={() => impostaConnesso(true)} />
}
