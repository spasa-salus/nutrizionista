import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, CircleOff, Clock, LayoutGrid, type LucideIcon, Pencil, Plus } from 'lucide-react'
import { type Carrello, cerca, perNome, type Ricetta } from '../dominio'
import { BottoneElimina, Cerca, Intestazione, Stato, useContenuto, useElenco } from '../ui'
import { FoglioCarrello, IconaCarrello } from './Carrelli'
import { useFoglioProdotto } from './Prodotti'
import { cosaManca, fotoPerRicetta, ModuloRicetta, PASTI, type Piatto, ricettaPronta, ricettaPulita, visibile, VUOTA } from './Ricette'

// Le due cartelle che non sono carrelli. Un id di carrello comincia sempre con lettera o cifra.
const TUTTE = '*tutte'
const NESSUNO = '*nessuno'

type Aperta = { ricetta: Ricetta; nuova: boolean; originale: string; daRileggere?: boolean }
type Livello = 'carrelli' | 'ricette' | 'ricetta'

/**
 * L'editor a colonne, come un file manager: carrelli, ricette del carrello scelto, la ricetta.
 * La ricetta si modifica sul posto e si pubblica col bottone in fondo; carrelli e prodotti si
 * aprono nei loro fogli. Su schermo stretto si vede una colonna alla volta.
 */
export default function Editor() {
  const { contenuto, errore, salva, elimina } = useContenuto()
  const piatti = useElenco<Piatto>('piatti.elenco')
  const prodotto = useFoglioProdotto()
  const [scelta, impostaScelta] = useState<string | null>(null)
  const [filtro, impostaFiltro] = useState('')
  const [aperta, impostaAperta] = useState<Aperta | null>(null)
  const [inCorso, impostaInCorso] = useState(false)
  const [inSospeso, impostaInSospeso] = useState<(() => void) | null>(null)
  const [livello, impostaLivello] = useState<Livello>('carrelli')
  const [foglioCarrello, impostaFoglioCarrello] = useState<{ carrello: Carrello | null } | null>(null)
  const chiudiCarrello = useCallback(() => impostaFoglioCarrello(null), [])
  // Gli id dei carrelli prima di crearne uno: quello nuovo (id dal server) si riconosce per differenza.
  const idPrimaDelNuovo = useRef<Set<string> | null>(null)

  const carrelli = contenuto?.carrelli ?? []
  const ricette = contenuto?.ricette ?? []
  const cartella = scelta ?? carrelli[0]?.id ?? TUTTE
  const carrello = carrelli.find((c) => c.id === cartella)
  const dentro = (r: Ricetta) => cartella === TUTTE || (cartella === NESSUNO ? r.carrelli.length === 0 : r.carrelli.includes(cartella))
  const elenco = cerca(ricette.filter(dentro), filtro, (r) => r.nome).sort(perNome)
  const senzaCarrello = ricette.filter((r) => r.carrelli.length === 0).length
  const foto = fotoPerRicetta(piatti.righe, true)
  const sporca = !!aperta && JSON.stringify(aperta.ricetta) !== aperta.originale

  // Ogni passo che cambierebbe la ricetta aperta passa da qui: con modifiche non salvate si chiede prima.
  const vai = (azione: () => void) => (sporca ? impostaInSospeso(() => azione) : azione())
  const apri = (ricetta: Ricetta, nuova = false) => {
    impostaAperta({ ricetta: structuredClone(ricetta), nuova, originale: JSON.stringify(ricetta) })
    impostaLivello('ricetta')
  }
  const nuovaRicetta = () => vai(() => apri({ ...VUOTA, carrelli: carrello ? [carrello.id] : [] }, true))
  const scegliCartella = (id: string) => { impostaScelta(id); impostaFiltro(''); impostaLivello('ricette') }
  const cambia = (modifica: Partial<Ricetta>) => impostaAperta((a) => a && { ...a, ricetta: { ...a.ricetta, ...modifica } })

  // La ricetta aperta segue il contenuto quando cambia altrove (un carrello, un prodotto) e dopo
  // ogni salvataggio, ma solo se non ha modifiche in corso: quelle non si buttano.
  useEffect(() => {
    if (!contenuto || !aperta || aperta.nuova || (sporca && !aperta.daRileggere)) return
    const attuale = contenuto.ricette.find((r) => r.id === aperta.ricetta.id)
    if (!attuale) { impostaAperta(null); return }
    const testo = JSON.stringify(attuale)
    if (testo !== aperta.originale || aperta.daRileggere) {
      impostaAperta({ ricetta: structuredClone(attuale), nuova: false, originale: testo })
    }
  }, [contenuto, aperta, sporca])

  // Un carrello appena creato si seleziona; uno eliminato lascia il posto al primo.
  useEffect(() => {
    if (!contenuto) return
    const prima = idPrimaDelNuovo.current
    const nuovo = prima && contenuto.carrelli.find((c) => !prima.has(c.id))
    if (nuovo) { idPrimaDelNuovo.current = null; impostaScelta(nuovo.id); return }
    if (scelta && scelta !== TUTTE && scelta !== NESSUNO && !contenuto.carrelli.some((c) => c.id === scelta)) impostaScelta(null)
  }, [contenuto, scelta])

  // Chiudere la scheda del browser con una ricetta non salvata chiede conferma.
  useEffect(() => {
    if (!sporca) return
    const avvisa = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [sporca])

  async function salvaRicetta() {
    if (!aperta || !contenuto || !ricettaPronta(aperta.ricetta)) return false
    const pulita = ricettaPulita(aperta.ricetta, aperta.nuova, contenuto)
    impostaInCorso(true)
    const ok = await salva('ricette', pulita, aperta.nuova).finally(() => impostaInCorso(false))
    // Si rilegge dal contenuto pubblicato: il server ricalcola le esigenze.
    if (ok) impostaAperta({ ricetta: pulita, nuova: false, originale: JSON.stringify(pulita), daRileggere: true })
    return ok
  }
  async function eliminaRicetta() {
    if (!aperta) return
    impostaInCorso(true)
    const ok = await elimina('ricette', aperta.ricetta.id).finally(() => impostaInCorso(false))
    if (ok) { impostaAperta(null); impostaLivello('ricette') }
  }
  const annulla = () => {
    if (!aperta) return
    if (aperta.nuova) { impostaAperta(null); impostaLivello('ricette') }
    else impostaAperta({ ...aperta, ricetta: JSON.parse(aperta.originale) })
  }
  const continua = (salvare: boolean) => async () => {
    const azione = inSospeso
    if (!azione) return
    if (salvare && !(await salvaRicetta())) return
    impostaInSospeso(null)
    azione()
  }

  const nomeCartella = cartella === TUTTE ? 'Tutte le ricette' : cartella === NESSUNO ? 'Senza carrello' : carrello?.nome ?? ''

  return (
    <>
      <Intestazione titolo="Editor" sottotitolo="Scegli un carrello, poi una ricetta: a destra la modifichi tutta, prodotti e foto compresi." />
      <Stato caricamento={!contenuto} errore={errore}>
        <div className="editor" data-livello={livello}>
          <section className="colonna cartelle" aria-label="Carrelli">
            <header className="testa-colonna">
              <h2>Carrelli</h2>
              <button type="button" className="tondo piccolo" aria-label="Nuovo carrello" title="Nuovo carrello"
                onClick={() => { idPrimaDelNuovo.current = new Set(carrelli.map((c) => c.id)); impostaFoglioCarrello({ carrello: null }) }}>
                <Plus size={18} />
              </button>
            </header>
            <div className="scorrimento">
              <VoceCartella icona={LayoutGrid} nome="Tutte le ricette" conta={ricette.length}
                scelta={cartella === TUTTE} onScegli={() => scegliCartella(TUTTE)} />
              <div className="gruppo-colonna">I carrelli · {carrelli.length}</div>
              {carrelli.map((c) => {
                const sue = ricette.filter((r) => r.carrelli.includes(c.id))
                return (
                  <div key={c.id} className="riga-cartella">
                    <button type="button" className="voce-colonna" aria-current={cartella === c.id} onClick={() => scegliCartella(c.id)}>
                      <span className="icona"><IconaCarrello simbolo={c.simbolo} lato={18} /></span>
                      <span className="testo">
                        <strong>{c.nome}</strong>
                        <small className="per-pasto">
                          {PASTI.map(({ momento, icona: I }) => {
                            const n = sue.filter((r) => r.momento === momento).length
                            return <span key={momento} className={n ? undefined : 'zero'}><I size={11} aria-hidden />{n}</span>
                          })}
                        </small>
                      </span>
                      <span className="conta">{sue.length}</span>
                    </button>
                    <button type="button" className="tondo piccolo modifica" aria-label={`Modifica il carrello ${c.nome}`} title="Modifica il carrello"
                      onClick={() => impostaFoglioCarrello({ carrello: c })}><Pencil size={14} /></button>
                  </div>
                )
              })}
              {senzaCarrello > 0 && (
                <VoceCartella icona={CircleOff} nome="Senza carrello" conta={senzaCarrello} avviso
                  scelta={cartella === NESSUNO} onScegli={() => scegliCartella(NESSUNO)} />
              )}
            </div>
          </section>

          <section className="colonna" aria-label="Ricette">
            <header className="testa-colonna">
              <button type="button" className="tondo piccolo solo-stretto" aria-label="Torna ai carrelli" onClick={() => impostaLivello('carrelli')}>
                <ArrowLeft size={18} />
              </button>
              <h2>{nomeCartella}</h2>
              <button type="button" className="tondo piccolo" aria-label="Nuova ricetta" title="Nuova ricetta" onClick={nuovaRicetta}><Plus size={18} /></button>
            </header>
            <div className="cerca-colonna"><Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca una ricetta" /></div>
            <div className="scorrimento">
              {PASTI.map(({ momento, tante, icona: I }) => {
                const delPasto = elenco.filter((r) => r.momento === momento)
                if (!delPasto.length) return null
                return (
                  <div key={momento}>
                    <div className="gruppo-colonna"><I size={12} aria-hidden /> {tante} · {delPasto.length}</div>
                    {delPasto.map((r) => {
                      const prima = foto.get(r.id)?.find(visibile)
                      return (
                        <button type="button" key={r.id} className="voce-colonna" aria-current={!!aperta && !aperta.nuova && aperta.ricetta.id === r.id}
                          onClick={() => vai(() => apri(r))}>
                          <span className="icona">{prima ? <img src={prima.fotoUrl} alt="" loading="lazy" /> : <I size={16} aria-hidden />}</span>
                          <span className="testo">
                            <strong>{r.nome}</strong>
                            <small>
                              <Clock size={11} aria-hidden /> {r.minutiPreparazione} min · {r.ingredienti.length} ingredienti
                              {!r.elettrodomestici && <span className="da-completare" title="Elettrodomestici da indicare">· da completare</span>}
                            </small>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              {elenco.length === 0 && (
                <p className="vuoto-colonna-testo">
                  {filtro.trim() ? `Nessuna ricetta con «${filtro.trim()}».`
                    : cartella === NESSUNO ? 'Ogni ricetta è in almeno un carrello.'
                    : 'Nessuna ricetta in questo carrello: aggiungine una con +.'}
                </p>
              )}
            </div>
          </section>

          <section className="colonna dettaglio" aria-label="Ricetta">
            {!aperta ? (
              <div className="vuoto-colonna">
                <BookOpen size={40} aria-hidden />
                <p>Scegli una ricetta nella colonna accanto,<br />oppure creane una nuova.</p>
                <button type="button" className="bottone secondario" onClick={nuovaRicetta}><Plus size={16} aria-hidden /> Nuova ricetta</button>
              </div>
            ) : (
              <>
                <header className="testa-colonna">
                  <button type="button" className="tondo piccolo solo-stretto" aria-label="Torna alle ricette" onClick={() => impostaLivello('ricette')}>
                    <ArrowLeft size={18} />
                  </button>
                  <h2>{aperta.nuova ? 'Nuova ricetta' : aperta.ricetta.nome.trim() || 'Senza nome'}</h2>
                  {sporca && <span className="etichetta sabbia">da salvare</span>}
                </header>
                <div className="corpo-colonna">
                  <ModuloRicetta valore={aperta.ricetta} nuovo={aperta.nuova} cambia={cambia}
                    foto={foto.get(aperta.ricetta.id) ?? []} onFotoCambiate={piatti.ricarica} onModificaProdotto={prodotto.apri} />
                </div>
                <footer className="piede-colonna">
                  {!aperta.nuova && <BottoneElimina testo="Elimina ricetta" disabilitato={inCorso} onConferma={eliminaRicetta} />}
                  <div className="spazio" />
                  {sporca && cosaManca(aperta.ricetta) && <span className="manca">{cosaManca(aperta.ricetta)}</span>}
                  {sporca && <button type="button" className="bottone secondario" disabled={inCorso} onClick={annulla}>Annulla</button>}
                  <button type="button" className="bottone principale" disabled={!sporca || inCorso || !ricettaPronta(aperta.ricetta)}
                    onClick={() => salvaRicetta()}>{inCorso ? 'Salvo…' : 'Salva e pubblica'}</button>
                </footer>
              </>
            )}
          </section>
        </div>
      </Stato>

      {inSospeso && aperta && (
        <div className="barra-sospeso" role="alertdialog" aria-label="Modifiche non salvate">
          <span>Hai modifiche non salvate a «{aperta.ricetta.nome.trim() || 'nuova ricetta'}».</span>
          <button type="button" className="bottone secondario compatto" onClick={() => impostaInSospeso(null)}>Resta qui</button>
          <button type="button" className="bottone secondario compatto" onClick={continua(false)}>Scarta</button>
          <button type="button" className="bottone principale compatto" disabled={inCorso || !ricettaPronta(aperta.ricetta)} onClick={continua(true)}>Salva e continua</button>
        </div>
      )}
      {foglioCarrello && <FoglioCarrello carrello={foglioCarrello.carrello} onChiudi={chiudiCarrello} />}
      {prodotto.foglio}
    </>
  )
}

function VoceCartella({ icona: Icona, nome, conta, scelta, avviso, onScegli }: {
  icona: LucideIcon; nome: string; conta: number; scelta: boolean; avviso?: boolean; onScegli: () => void
}) {
  return (
    <button type="button" className={`voce-colonna${avviso ? ' avviso-cartella' : ''}`} aria-current={scelta} onClick={onScegli}>
      <span className="icona"><Icona size={18} aria-hidden /></span>
      <span className="testo"><strong>{nome}</strong></span>
      <span className="conta">{conta}</span>
    </button>
  )
}
