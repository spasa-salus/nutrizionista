// Collegamento di Claude, ChatGPT e degli altri client MCP al pannello (server MCP nella funzione
// `admin`, mcp.ts e mcp_oauth.ts). Il tasto della testata mostra l'indirizzo da incollare nel
// client e i collegamenti attivi, coi permessi da cambiare o da revocare. Quando un client chiede
// di collegarsi, /authorize della funzione rimanda qui con ?mcp=…: chi e' dentro sceglie i permessi.
// File uguale nei due pannelli: i permessi che un ruolo puo' dare li dice il server.

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Plug } from 'lucide-react'
import { chiama } from './api'
import { data } from './dominio'
import { BottoneElimina, Foglio, Reparto, Stato, useNotifica } from './ui'

type Avviso = 'personali' | 'pagamento' | 'irreversibile'
type Permesso = { id: string; nome: string; descrizione: string; avvisi: Avviso[] }
type Collegamento = { id: string; client: string; permessi: string[]; creatoIl: string; usatoIl: string | null }
type StatoMcp = { url: string; pannelloConfigurato: boolean; permessi: Permesso[]; collegamenti: Collegamento[] }

const AVVISI: Record<Avviso, { testo: string; tinta: string }> = {
  personali: { testo: 'dati personali', tinta: 'sabbia' },
  pagamento: { testo: 'a pagamento', tinta: 'sabbia' },
  irreversibile: { testo: 'non si annulla', tinta: 'pomodoro' },
}

/** La richiesta di collegamento che la funzione manda al pannello (?mcp=…), o null. */
export function richiestaMcp(): URLSearchParams | null {
  const r = new URLSearchParams(location.search).get('mcp')
  return r ? new URLSearchParams(r) : null
}

function SceltaPermessi({ permessi, scelti, onCambia, disabilitato }: {
  permessi: Permesso[]; scelti: string[]; onCambia: (scelti: string[]) => void; disabilitato?: boolean
}) {
  return (
    <div className="permessi-mcp" role="group" aria-label="Permessi">
      {permessi.map((p) => (
        <label key={p.id} className="voce-casella permesso-mcp">
          <input type="checkbox" checked={scelti.includes(p.id)} disabled={disabilitato}
            onChange={(e) => onCambia(e.target.checked ? [...scelti, p.id] : scelti.filter((x) => x !== p.id))} />
          <span className="casella" aria-hidden><Check size={14} strokeWidth={3} /></span>
          <span className="testo-permesso">
            <strong>{p.nome}</strong>
            <small>{p.descrizione}</small>
            {p.avvisi.length > 0 && (
              <span className="avvisi-permesso">
                {p.avvisi.map((a) => <span key={a} className={`etichetta ${AVVISI[a].tinta}`}>{AVVISI[a].testo}</span>)}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  )
}

/** Dati personali verso un fornitore nuovo: lo si dice prima, non dopo. */
function AvvisoPersonali({ permessi, scelti }: { permessi: Permesso[]; scelti: string[] }) {
  if (!permessi.some((p) => scelti.includes(p.id) && p.avvisi.includes('personali'))) return null
  return (
    <div className="avviso">
      I dati personali scelti arrivano al fornitore dell’AI che colleghi (Anthropic, OpenAI…): va previsto
      nell’informativa privacy e nel contratto con lui.
    </div>
  )
}

// ---------- Tasto della testata ----------

export function BottoneMcp() {
  const [aperto, apri] = useState(false)
  const chiudi = useCallback(() => apri(false), [])
  return (
    <>
      <button className="bottone secondario compatto bottone-mcp" onClick={() => apri(true)} title="Collega Claude o ChatGPT al pannello"
        aria-label="MCP: collega Claude o ChatGPT">
        <Plug size={16} aria-hidden /><span className="testo-largo">MCP</span>
      </button>
      {aperto && <FoglioMcp onChiudi={chiudi} />}
    </>
  )
}

function FoglioMcp({ onChiudi }: { onChiudi: () => void }) {
  const [stato, imposta] = useState<StatoMcp | null>(null)
  const [errore, impostaErrore] = useState<string | null>(null)
  const notifica = useNotifica()

  const carica = useCallback(() => {
    chiama<StatoMcp>('mcp.stato').then(imposta, (e) => impostaErrore(e.message))
  }, [])
  useEffect(carica, [carica])

  async function copia(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      notifica('Indirizzo copiato')
    } catch {
      notifica('Copia non riuscita: selezionalo e copialo a mano', true)
    }
  }

  // Si salva a ogni spunta: il collegamento usa i permessi nuovi dalla richiesta dopo.
  async function cambiaPermessi(k: Collegamento, permessi: string[]) {
    if (!permessi.length) return notifica('Serve almeno un permesso: per togliere tutto, scollega', true)
    imposta((s) => s && { ...s, collegamenti: s.collegamenti.map((x) => x.id === k.id ? { ...x, permessi } : x) })
    try {
      await chiama('mcp.permessi', { id: k.id, permessi })
      notifica('Permessi aggiornati')
    } catch (e) {
      notifica((e as Error).message, true)
      carica()
    }
  }

  async function scollega(k: Collegamento) {
    try {
      await chiama('mcp.revoca', { id: k.id })
      notifica(`${k.client} scollegato`)
      carica()
    } catch (e) {
      notifica((e as Error).message, true)
    }
  }

  return (
    <Foglio titolo="Collega Claude o ChatGPT" onChiudi={onChiudi}>
      <Stato caricamento={!stato} errore={errore}>
        {stato && (
          <>
            <p className="tenue" style={{ margin: 0 }}>
              Con l’MCP un assistente AI lavora sul pannello per te: legge e, se glielo permetti, modifica.
              Ogni modifica si pubblica come quelle fatte da qui.
            </p>
            {!stato.pannelloConfigurato && (
              <div className="avviso errore">
                Manca l’indirizzo di questo pannello nei segreti della funzione <span className="stampa">admin</span>: senza,
                il collegamento non arriva alla pagina dei permessi.
              </div>
            )}
            <div className="campo">
              <span>Indirizzo del server MCP</span>
              <div className="copia-mcp">
                <input className="input stampa" readOnly value={stato.url} aria-label="Indirizzo del server MCP"
                  onFocus={(e) => e.target.select()} />
                <button className="tondo" onClick={() => copia(stato.url)} aria-label="Copia l’indirizzo" title="Copia">
                  <Copy size={18} />
                </button>
              </div>
            </div>
            <ol className="passi-mcp">
              <li><strong>Claude</strong>: Impostazioni › Connettori › aggiungi un connettore personalizzato con questo indirizzo.</li>
              <li><strong>ChatGPT</strong>: Impostazioni › App e connettori, con la modalità sviluppatore attiva: crea un connettore con questo indirizzo e autenticazione OAuth.</li>
              <li>Si apre il pannello: scegli cosa può fare e premi <strong>Collega</strong>.</li>
            </ol>

            <Reparto>Collegati</Reparto>
            {stato.collegamenti.length === 0 && <p className="tenue" style={{ margin: 0 }}>Ancora nessuno.</p>}
            {stato.collegamenti.map((k) => (
              <section key={k.id} className="collegamento-mcp" aria-label={k.client}>
                <div className="testa-collegamento">
                  <div>
                    <strong>{k.client}</strong>
                    <small className="tenue">Collegato il {data(k.creatoIl)} · ultimo uso {data(k.usatoIl)}</small>
                  </div>
                  <BottoneElimina testo="Scollega" onConferma={() => scollega(k)} />
                </div>
                <SceltaPermessi permessi={stato.permessi} scelti={k.permessi} onCambia={(p) => cambiaPermessi(k, p)} />
                <AvvisoPersonali permessi={stato.permessi} scelti={k.permessi} />
              </section>
            ))}
          </>
        )}
      </Stato>
    </Foglio>
  )
}

// ---------- Pagina del consenso ----------

type Cliente = { nome: string; ritorno: string; permessi: Permesso[] }

export function AutorizzaMcp({ richiesta, pannello, onChiudi }: { richiesta: URLSearchParams; pannello: string; onChiudi: () => void }) {
  const [cliente, imposta] = useState<Cliente | null>(null)
  const [scelti, sceglie] = useState(['contenuto.leggi'])
  const [errore, impostaErrore] = useState<string | null>(null)
  const [inCorso, impostaInCorso] = useState(false)
  // Dentro la cornice di un altro sito il consenso si potrebbe far cliccare con l'inganno.
  const inCornice = window.top !== window.self
  const chi = { clientId: richiesta.get('client_id'), redirectUri: richiesta.get('redirect_uri') }

  useEffect(() => {
    if (!inCornice) chiama<Cliente>('mcp.cliente', chi).then(imposta, (e) => impostaErrore(e.message))
  }, [])

  async function rispondi(consenso: boolean) {
    impostaInCorso(true)
    impostaErrore(null)
    try {
      const { redirect } = await chiama<{ redirect: string }>('mcp.autorizza', {
        ...chi, codeChallenge: richiesta.get('code_challenge'), state: richiesta.get('state') ?? undefined, consenso, permessi: scelti,
      })
      location.replace(redirect)
    } catch (e) {
      impostaErrore((e as Error).message)
      impostaInCorso(false)
    }
  }

  function vaiAlPannello() {
    history.replaceState(null, '', location.pathname)
    onChiudi()
  }

  return (
    <main className="accesso">
      <div className="carta-accesso larga">
        <img className="logotipo" src="/logo.svg" alt="NutriQuore" />
        <div className="motto">Collega l’AI · {pannello}</div>
        {inCornice ? (
          <div className="avviso errore">Questa pagina non si apre dentro un’altra: aprila da sola.</div>
        ) : !cliente ? (
          errore ? (
            <>
              <div className="avviso errore" role="alert">{errore}</div>
              <button className="bottone secondario" onClick={vaiAlPannello}>Vai al pannello</button>
            </>
          ) : <div className="caricamento" style={{ minHeight: 120 }}>Carico…</div>
        ) : (
          <>
            <h1 className="titolo-consenso"><strong>{cliente.nome}</strong> chiede di lavorare sul pannello</h1>
            <p className="tenue">
              Dopo torni su <strong>{cliente.ritorno}</strong>. Scegli cosa può fare: lo cambi quando vuoi dal tasto MCP.
            </p>
            <SceltaPermessi permessi={cliente.permessi} scelti={scelti} onCambia={sceglie} disabilitato={inCorso} />
            <AvvisoPersonali permessi={cliente.permessi} scelti={scelti} />
            {errore && <div className="avviso errore" role="alert">{errore}</div>}
            <div className="azioni-consenso">
              <button className="bottone secondario" onClick={() => rispondi(false)} disabled={inCorso}>Rifiuta</button>
              <button className="bottone principale" onClick={() => rispondi(true)} disabled={inCorso || !scelti.length}>
                {inCorso ? 'Un attimo…' : 'Collega'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
