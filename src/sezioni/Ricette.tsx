import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Clock, Coffee, CookingPot, Heart, ImagePlus, LayoutGrid, Link2, type LucideIcon, Moon,
  Package, Pencil, Plus, Search, Sparkles, Sun, Users, X,
} from 'lucide-react'
import { chiama } from '../api'
import { CATEGORIE, cerca, type Contenuto, data, ELETTRODOMESTICI, elettrodomesticiDaiPassaggi, ESIGENZE, esigenzeDellaRicetta, idDaNome, type Ingrediente, perNome, type Prodotto, type Ricetta, TAG } from '../dominio'
import {
  BottoneNuovo, Campo, Cerca, Contatore, Foglio, Intestazione, PiedeModifica, Reparto, SceltaMultipla, Stato, Tendina,
  useBozza, useComparsa, useContenuto, useElenco, useNotifica,
} from '../ui'
import { FoglioNuovaFoto } from './Piatti'
import { ICONE_ESIGENZA, ICONE_REPARTO, useFoglioProdotto } from './Prodotti'

export const VUOTA: Ricetta = {
  id: '', nome: '', descrizione: '', ingredienti: [], carrelli: [], tag: [],
  minutiPreparazione: 20, porzioni: 2, passaggi: [], momento: 'pranzo',
}

// I tre pasti del piano settimanale, nell'ordine in cui si mangiano.
export const PASTI: { momento: string; nome: string; tante: string; icona: LucideIcon }[] = [
  { momento: 'colazione', nome: 'Colazione', tante: 'Colazioni', icona: Coffee },
  { momento: 'pranzo', nome: 'Pranzo', tante: 'Pranzi', icona: Sun },
  { momento: 'cena', nome: 'Cena', tante: 'Cene', icona: Moon },
]
const iconaPasto = (momento: string) => PASTI.find((p) => p.momento === momento)?.icona ?? Sun

// Nelle ricette le unita' brevi, grammi per primi: e' l'unita' di quasi ogni ingrediente.
const UNITA_INGREDIENTE: [string, string][] = [
  ['grammo', 'g'], ['chilogrammo', 'kg'], ['millilitro', 'ml'], ['litro', 'l'], ['pezzo', 'pezzi'], ['confezione', 'confezioni'],
]
// Un prodotto a chili o a litri entra in ricetta a grammi o millilitri: nessuno scrive 0,32 kg di spaghetti.
const INGREDIENTE_DA: Record<string, Pick<Ingrediente, 'quantita' | 'unita'>> = {
  grammo: { quantita: 100, unita: 'grammo' }, chilogrammo: { quantita: 100, unita: 'grammo' },
  millilitro: { quantita: 100, unita: 'millilitro' }, litro: { quantita: 100, unita: 'millilitro' },
  pezzo: { quantita: 1, unita: 'pezzo' }, confezione: { quantita: 1, unita: 'confezione' },
}

// I piatti della community (funzione admin, piatti.elenco): le foto di una ricetta sono le loro.
export type Piatto = {
  id: string; ricetta_id: string; fotoUrl: string; didascalia: string; autore: string | null
  mi_piace: number; segnalazioni: number; moderazione: string; redazione: boolean
}
// Come l'app: si vedono solo i piatti approvati e con meno di tre segnalazioni.
export const visibile = (p: Piatto) => p.moderazione === 'ok' && p.segnalazioni < 3
/** Le foto per ricetta, dalla piu' recente. `tutte`: anche quelle in moderazione o nascoste, per chi le gestisce. */
export function fotoPerRicetta(piatti: Piatto[] | null, tutte = false) {
  const uscita = new Map<string, Piatto[]>()
  for (const p of piatti ?? []) {
    if (!tutte && !visibile(p)) continue
    uscita.set(p.ricetta_id, [...(uscita.get(p.ricetta_id) ?? []), p])
  }
  return uscita
}

// Proposta dell'AI sui carrelli di una ricetta (funzione admin, ricette_ai.ts): solo quelle che
// cambiano qualcosa. Decide a chi l'app propone la ricetta: chi ha scelto quei carrelli.
type Proposta = { ricettaId: string; carrelli: string[]; attuali: string[]; confidenza: number; motivo: string }
// stato dell'ultima richiesta all'AI (in batch: minuti, al massimo 24 ore); null = mai chiesto.
type Revisione = { stato: 'in_corso' | 'concluso' | 'fallito'; creatoIl: string; conclusoIl: string | null; errore: string | null; soglia: number; proposte: Proposta[] } | null

function RevisioneAI({ onChiudi }: { onChiudi: () => void }) {
  const { contenuto, ricarica } = useContenuto()
  const notifica = useNotifica()
  const [dati, impostaDati] = useState<Revisione | undefined>(undefined)
  const [errore, impostaErrore] = useState<string | null>(null)
  const [scelte, impostaScelte] = useState<Set<string>>(new Set())
  const [inCorso, impostaInCorso] = useState(false)
  const leggi = () => chiama<Revisione>('ai.ricette.stato').then((r) => {
    impostaDati(r)
    impostaScelte(new Set((r?.proposte ?? []).filter((p) => p.confidenza >= r!.soglia).map((p) => p.ricettaId)))
  }, (e) => impostaErrore(e.message))
  useEffect(() => { leggi() }, [])
  // Mentre l'AI lavora si ricontrolla ogni minuto.
  const aperto = dati?.stato === 'in_corso'
  useEffect(() => {
    if (!aperto) return
    const t = setInterval(leggi, 60_000)
    return () => clearInterval(t)
  }, [aperto])

  async function chiedi() {
    impostaInCorso(true)
    try {
      await chiama('ai.ricette.carrelli')
      notifica('Richiesta inviata: le proposte arrivano di solito in pochi minuti')
      await leggi()
    } catch (e) {
      notifica((e as Error).message, true)
    } finally {
      impostaInCorso(false)
    }
  }
  const nome = (id: string) => contenuto?.ricette.find((r) => r.id === id)?.nome ?? id
  const carrello = (id: string) => contenuto?.carrelli.find((c) => c.id === id)?.nome ?? id
  const elenco = (ids: string[]) => ids.length ? ids.map(carrello).join(', ') : 'nessuno'
  const alterna = (id: string) => impostaScelte((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  async function applica() {
    if (!dati) return
    impostaInCorso(true)
    try {
      const modifiche = dati.proposte.filter((p) => scelte.has(p.ricettaId)).map(({ ricettaId, carrelli }) => ({ ricettaId, carrelli }))
      const r = await chiama<{ revisione: number }>('ai.ricette.applica', { revisione: contenuto?.revisione, modifiche })
      notifica(`Pubblicato · revisione ${r.revisione}`)
      ricarica()
      onChiudi()
    } catch (e) {
      notifica((e as Error).message, true)
    } finally {
      impostaInCorso(false)
    }
  }

  return (
    <Foglio titolo="Carrelli delle ricette: proposte dell'AI" onChiudi={onChiudi}
      piede={<button className="bottone principale" disabled={inCorso || !scelte.size} onClick={applica}>
        {inCorso ? 'Pubblico…' : `Applica ${scelte.size} ${scelte.size === 1 ? 'modifica' : 'modifiche'}`}
      </button>}>
      <p className="tenue piccolo" style={{ margin: 0 }}>
        {dati?.stato === 'in_corso' && `L'AI sta preparando le proposte (richiesta del ${data(dati.creatoIl)}): la finestra si aggiorna da sola. `}
        {dati?.stato === 'concluso' && `Proposte del ${data(dati.conclusoIl)}. Sono già spuntate quelle di cui l'AI è sicura. `}
        {dati?.stato === 'fallito' && `L'ultima richiesta non è andata: ${dati.errore ?? 'errore di OpenAI'}. `}
        Chi può mangiare una ricetta lo decidono sempre i suoi ingredienti.
      </p>
      <div className="riga">
        <button className="bottone secondario" disabled={inCorso || aperto} onClick={chiedi}>
          <Sparkles size={16} aria-hidden /> {dati ? 'Chiedi nuove proposte' : 'Chiedi le proposte all\'AI'}
        </button>
      </div>
      <Stato caricamento={dati === undefined && !errore} errore={errore} vuoto={!dati || dati.proposte.length === 0}>
        <div className="elenco">
          {dati && dati.proposte.map((p) => (
            <label key={p.ricettaId} className="scheda cliccabile">
              <input type="checkbox" checked={scelte.has(p.ricettaId)} onChange={() => alterna(p.ricettaId)} />
              <div className="principale">
                <div className="nome">{nome(p.ricettaId)}</div>
                <div className="tenue piccolo">Ora: {elenco(p.attuali)} → proposta: <strong>{elenco(p.carrelli)}</strong></div>
                <div className="riga">
                  <span className="etichetta">AI {Math.round(p.confidenza * 100)}%</span>
                  {p.motivo && <span className="tenue piccolo">{p.motivo}</span>}
                </div>
              </div>
            </label>
          ))}
        </div>
      </Stato>
    </Foglio>
  )
}

/** La ricetta come si pubblica: id dal nome se nuova, righe e passaggi vuoti lasciati indietro. */
export function ricettaPulita(r: Ricetta, nuovo: boolean, contenuto: Contenuto): Ricetta {
  const nomeProdotto = (id?: string) => contenuto.prodotti.find((p) => p.id === id)?.nome ?? ''
  return {
    ...r,
    id: nuovo ? idDaNome(r.nome, contenuto.ricette.map((x) => x.id), 'ricetta') : r.id,
    nome: r.nome.trim(),
    ingredienti: r.ingredienti
      .filter((i) => i.nome.trim() || i.prodottoID)
      .map((i) => ({ ...i, nome: i.nome.trim() || nomeProdotto(i.prodottoID) })),
    passaggi: r.passaggi.map((p) => p.trim()).filter(Boolean),
  }
}

/** Cosa manca per poter pubblicare, detto come lo si legge accanto al bottone; null = niente. */
export function cosaManca(r: Ricetta): string | null {
  const intero = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max
  if (!r.nome.trim()) return 'Manca il nome'
  if (!intero(r.minutiPreparazione, 0, 1440)) return 'Controlla il tempo'
  if (!intero(r.porzioni, 1, 50)) return 'Controlla le porzioni'
  if (!r.ingredienti.every((i) => (!i.nome.trim() && !i.prodottoID) || i.quantita > 0)) return 'Un ingrediente senza quantità'
  if (!r.elettrodomestici) return 'Indica gli elettrodomestici'
  return null
}
export const ricettaPronta = (r: Ricetta) => cosaManca(r) === null

export default function Ricette() {
  const { contenuto, errore, salva, elimina } = useContenuto()
  const { righe: piatti, ricarica: ricaricaPiatti } = useElenco<Piatto>('piatti.elenco')
  const prodotto = useFoglioProdotto()
  const [revisioneAI, impostaRevisioneAI] = useState(false)
  const { bozza, apri, chiudi, cambia, inCorso, esegui } = useBozza<Ricetta>()
  const [filtro, impostaFiltro] = useState('')
  const [pasto, impostaPasto] = useState('')

  const tutte = contenuto?.ricette ?? []
  const foto = fotoPerRicetta(piatti)
  const trovate = cerca(tutte, filtro, (r) => r.nome).sort(perNome)
  const gruppi = PASTI
    .filter((p) => !pasto || p.momento === pasto)
    .map((p) => [p, trovate.filter((r) => r.momento === p.momento)] as const)
    .filter(([, elenco]) => elenco.length > 0)

  const salvaBozza = () => bozza && contenuto && esegui(() => salva('ricette', ricettaPulita(bozza.valore, bozza.nuovo, contenuto), bozza.nuovo))

  return (
    <>
      <Intestazione titolo="Ricette" sottotitolo={`${tutte.length} ricette nel ricettario`}
        azione={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="bottone secondario" onClick={() => impostaRevisioneAI(true)}>
            <Sparkles size={16} aria-hidden /> Carrelli con l'AI
          </button>
          <BottoneNuovo testo="Nuova ricetta" onClick={() => apri({ ...VUOTA, momento: pasto || 'pranzo' }, true)} />
        </span>} />
      {revisioneAI && <RevisioneAI onChiudi={() => impostaRevisioneAI(false)} />}
      <div className="segmentato schede pasti" role="tablist" aria-label="Pasto">
        <button type="button" role="tab" aria-selected={pasto === ''} onClick={() => impostaPasto('')}>
          <LayoutGrid size={16} aria-hidden /> Tutte <span className="conta">{tutte.length}</span>
        </button>
        {PASTI.map(({ momento, tante, icona: Icona }) => (
          <button type="button" key={momento} role="tab" aria-selected={pasto === momento} onClick={() => impostaPasto(momento)}>
            <Icona size={16} aria-hidden /> {tante} <span className="conta">{tutte.filter((r) => r.momento === momento).length}</span>
          </button>
        ))}
      </div>
      <div className="barra"><Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca una ricetta" /></div>
      <Stato caricamento={!contenuto} errore={errore} vuoto={gruppi.length === 0}>
        {gruppi.map(([p, elenco]) => (
          <section key={p.momento}>
            {!pasto && <Reparto>{p.tante} · {elenco.length}</Reparto>}
            <div className="elenco">
              {elenco.map((r) => {
                const Icona = p.icona
                const prima = foto.get(r.id)?.[0]
                return (
                  <div key={r.id} className="scheda cliccabile" onClick={() => apri(r)} role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && apri(r)}>
                    <div className="simbolo">{prima ? <img src={prima.fotoUrl} alt="" loading="lazy" /> : <Icona size={22} aria-hidden />}</div>
                    <div className="principale">
                      <div className="nome">{r.nome}</div>
                      <div className="riga">
                        <span className="etichetta"><Clock size={12} aria-hidden /> {r.minutiPreparazione} min</span>
                        <span className="etichetta"><Users size={12} aria-hidden /> {r.porzioni} {r.porzioni === 1 ? 'porzione' : 'porzioni'}</span>
                        <span className={`etichetta ${r.carrelli.length ? 'salvia' : 'pomodoro'}`}>
                          {r.carrelli.length ? `in ${r.carrelli.length} ${r.carrelli.length === 1 ? 'carrello' : 'carrelli'}` : 'in nessun carrello'}
                        </span>
                        {r.tag.filter((t) => ESIGENZE.includes(t)).map((t) => <span key={t} className="etichetta sabbia">{TAG[t]}</span>)}
                        {!r.elettrodomestici && <span className="etichetta pomodoro">elettrodomestici da indicare</span>}
                      </div>
                    </div>
                    <ChevronRight size={20} className="tenue" aria-hidden />
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </Stato>

      {bozza && contenuto && (
        <Foglio titolo={bozza.nuovo ? 'Nuova ricetta' : 'Modifica ricetta'} onChiudi={chiudi}
          piede={<PiedeModifica inCorso={inCorso} disabilitato={!ricettaPronta(bozza.valore)} manca={cosaManca(bozza.valore)} onSalva={salvaBozza}
            onElimina={bozza.nuovo ? undefined : () => esegui(() => elimina('ricette', bozza.valore.id))} />}>
          <ModuloRicetta valore={bozza.valore} nuovo={bozza.nuovo} cambia={cambia}
            foto={fotoPerRicetta(piatti, true).get(bozza.valore.id) ?? []} onFotoCambiate={ricaricaPiatti}
            onModificaProdotto={prodotto.apri} />
        </Foglio>
      )}
      {prodotto.foglio}
    </>
  )
}

/**
 * Tutti i campi di una ricetta: nel foglio della sezione Ricette e nella terza colonna dell'Editor.
 * `foto` sono tutti i piatti della community fatti con la ricetta, anche quelli non ancora visibili.
 */
export function ModuloRicetta({ valore, nuovo, cambia, foto, onFotoCambiate, onModificaProdotto }: {
  valore: Ricetta; nuovo: boolean; cambia: (m: Partial<Ricetta>) => void
  foto: Piatto[]; onFotoCambiate: () => void; onModificaProdotto: (p: Prodotto) => void
}) {
  const { contenuto } = useContenuto()
  const Icona = iconaPasto(valore.momento)
  const prima = foto.find(visibile)

  return (
    <>
      <div className="testa-nome">
        <span className="cerchio-icona fisso" aria-hidden>{prima ? <img src={prima.fotoUrl} alt="" /> : <Icona size={28} />}</span>
        <Campo etichetta="Nome">
          <input className="input grande" value={valore.nome} maxLength={120} placeholder="Es. Pasta al pomodoro"
            onChange={(e) => cambia({ nome: e.target.value })} />
        </Campo>
      </div>
      <div className="dettagli-ricetta">
        <div className="campo">
          <span id="momento-ricetta">Pasto</span>
          <div className="segmentato" role="radiogroup" aria-labelledby="momento-ricetta">
            {PASTI.map(({ momento, nome, icona: I }) => (
              <button type="button" key={momento} role="radio" aria-checked={valore.momento === momento} onClick={() => cambia({ momento })}>
                <I size={18} aria-hidden /><strong>{nome}</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span>Tempo</span>
          <Contatore etichetta="Minuti di preparazione" unita="min" passo={5} min={0} max={1440}
            valore={valore.minutiPreparazione} onCambia={(minutiPreparazione) => cambia({ minutiPreparazione })} />
        </div>
        <div className="campo">
          <span>Porzioni</span>
          <Contatore etichetta="Porzioni" min={1} max={50} valore={valore.porzioni} onCambia={(porzioni) => cambia({ porzioni })} />
        </div>
      </div>
      <Elettrodomestici valore={valore.elettrodomestici} passaggi={valore.passaggi}
        onCambia={(elettrodomestici) => cambia({ elettrodomestici })} />
      <Campo etichetta="Descrizione" aiuto="La legge l’utente sulla scheda della ricetta">
        <textarea className="area" value={valore.descrizione} maxLength={1000} placeholder="Es. Il piatto che si fa quando non si è deciso niente."
          onChange={(e) => cambia({ descrizione: e.target.value })} />
      </Campo>
      <div className="campo">
        <span>Carrelli</span>
        <SceltaMultipla etichetta="Carrelli" nessuna="Nessun carrello: non la vede nessuno" cercaSegnaposto="Cerca un carrello"
          opzioni={[...(contenuto?.carrelli ?? [])].sort(perNome).map((c) => [c.id, c.nome])}
          valori={valore.carrelli} onCambia={(carrelli) => cambia({ carrelli })} />
        <small>Chi ha scelto uno di questi carrelli si vede proporre la ricetta.</small>
      </div>
      <Ingredienti righe={valore.ingredienti} onCambia={(ingredienti) => cambia({ ingredienti })} onModificaProdotto={onModificaProdotto} />
      <EsigenzeRicetta ingredienti={valore.ingredienti} />
      <Passaggi righe={valore.passaggi} onCambia={(passaggi) => cambia({ passaggi })} />
      <FotoCommunity piatti={foto} ricetta={nuovo ? null : valore} onCambiate={onFotoCambiate} />
    </>
  )
}

/**
 * Un prodotto del catalogo da cercare per nome: per aggiungere un ingrediente e per collegarne
 * uno scritto a mano. Su, giu' e invio scelgono senza mouse.
 */
function ScegliProdotto({ children, classe, etichetta, onScegli, onTesto, onScollega }: {
  children: ReactNode; classe: string; etichetta: string
  onScegli: (p: Prodotto) => void; onTesto?: (t: string) => void; onScollega?: () => void
}) {
  const { contenuto } = useContenuto()
  const { aperta, impostaAperta, contenitore, alEsc } = useComparsa()
  const bottone = useRef<HTMLButtonElement>(null)
  const [filtro, impostaFiltro] = useState('')
  const [attivo, impostaAttivo] = useState(0)
  const risultati = cerca(contenuto!.prodotti, filtro, (p) => p.nome).sort(perNome).slice(0, 60)
  const chiudi = () => { impostaAperta(false); bottone.current?.focus() }
  const scegli = (p: Prodotto) => { onScegli(p); impostaAperta(false) }

  return (
    <div className="scegli-prodotto" ref={contenitore} onKeyDown={(e) => alEsc(e, () => bottone.current?.focus())}>
      <button type="button" ref={bottone} className={classe} aria-haspopup="listbox" aria-expanded={aperta}
        onClick={() => { impostaFiltro(''); impostaAttivo(0); impostaAperta(!aperta) }}>{children}</button>
      {aperta && (
        <div className="comparsa">
          <label className="cerca">
            <Search size={16} aria-hidden />
            <span className="sr-only">{etichetta}</span>
            <input className="input" type="search" autoFocus value={filtro} placeholder="Cerca nel catalogo"
              onChange={(e) => { impostaFiltro(e.target.value); impostaAttivo(0) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); impostaAttivo((a) => Math.min(a + 1, risultati.length - 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); impostaAttivo((a) => Math.max(a - 1, 0)) }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (risultati[attivo]) scegli(risultati[attivo])
                  else if (onTesto && filtro.trim()) { onTesto(filtro.trim()); impostaAperta(false) }
                }
              }} />
          </label>
          <div className="voci" role="listbox" aria-label={etichetta}>
            {risultati.map((p, n) => {
              const I = ICONE_REPARTO[p.categoria] ?? Package
              return (
                <button type="button" key={p.id} role="option" aria-selected={n === attivo} className="voce-prodotto-scelta"
                  onMouseEnter={() => impostaAttivo(n)} onClick={() => scegli(p)}>
                  <I size={16} aria-hidden /><span className="nome">{p.nome}</span><span className="tenue piccolo">{CATEGORIE[p.categoria]}</span>
                </button>
              )
            })}
            {onTesto && filtro.trim() && (
              <button type="button" className="voce-prodotto-scelta a-mano" onClick={() => { onTesto(filtro.trim()); impostaAperta(false) }}>
                <Plus size={16} aria-hidden /><span className="nome">Scrivi a mano «{filtro.trim()}»</span><span className="tenue piccolo">non va in lista</span>
              </button>
            )}
            {!risultati.length && !onTesto && <p className="tenue piccolo" style={{ margin: 8 }}>Nessun prodotto con «{filtro.trim()}».</p>}
          </div>
          {onScollega && (
            <div className="piede-comparsa">
              <button type="button" className="bottone secondario compatto" onClick={() => { onScollega(); chiudi() }}>Scollega dal catalogo</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Ingredienti({ righe, onCambia, onModificaProdotto }: {
  righe: Ingrediente[]; onCambia: (r: Ingrediente[]) => void; onModificaProdotto: (p: Prodotto) => void
}) {
  const { contenuto } = useContenuto()
  const perId = new Map(contenuto!.prodotti.map((p) => [p.id, p]))
  const elenco = useRef<HTMLDivElement>(null)
  // Dopo "Aggiungi" il cursore va sulla quantita' della riga nuova: il nome c'e' gia'.
  const daSelezionare = useRef<number | null>(null)
  useEffect(() => {
    if (daSelezionare.current == null) return
    const campo = elenco.current?.querySelectorAll<HTMLInputElement>('.quantita-unita .numero')[daSelezionare.current]
    campo?.focus()
    campo?.select()
    daSelezionare.current = null
  })
  const aggiorna = (i: number, modifica: Partial<Ingrediente>) => onCambia(righe.map((r, n) => n === i ? { ...r, ...modifica } : r))
  const aggiungi = (riga: Ingrediente) => { daSelezionare.current = righe.length; onCambia([...righe, riga]) }

  return (
    <div className="campo">
      <Reparto>Ingredienti · {righe.length}</Reparto>
      <small>Collega ogni ingrediente a un prodotto del catalogo: così finisce nella lista della spesa e conta per le esigenze.</small>
      <div className="righe" ref={elenco}>
        {righe.map((r, i) => {
          const prodotto = r.prodottoID ? perId.get(r.prodottoID) : undefined
          return (
            <div key={i} className="ingrediente-riga">
              <div className="principale">
                <input className="input" aria-label={`Ingrediente ${i + 1}: nome nella ricetta`} placeholder="Come lo chiama la ricetta"
                  value={r.nome} aria-invalid={!r.nome.trim() && !r.prodottoID} onChange={(e) => aggiorna(i, { nome: e.target.value })} />
                <div className="collegamenti">
                  <ScegliProdotto etichetta={`Prodotto dell'ingrediente ${i + 1}`} classe={`collegamento${prodotto ? '' : ' scollegato'}`}
                    onScegli={(p) => aggiorna(i, { prodottoID: p.id, ...(r.nome.trim() ? {} : { nome: p.nome }) })}
                    onScollega={prodotto ? () => aggiorna(i, { prodottoID: undefined }) : undefined}>
                    {prodotto
                      ? <><Link2 size={14} aria-hidden /> {prodotto.nome}</>
                      : <><Plus size={14} aria-hidden /> {r.prodottoID ? 'Prodotto eliminato: collegane un altro' : 'Collega a un prodotto · ora non va in lista'}</>}
                    <ChevronDown size={14} aria-hidden />
                  </ScegliProdotto>
                  {prodotto && (
                    <button type="button" className="collegamento leggero" onClick={() => onModificaProdotto(prodotto)}>
                      <Pencil size={13} aria-hidden /> Modifica prodotto
                    </button>
                  )}
                </div>
              </div>
              <div className="quantita-unita piccola" role="group" aria-label={`Quantità dell'ingrediente ${i + 1}`}>
                <input className="numero" type="number" min="0" step="any" inputMode="decimal" aria-label="Quantità"
                  aria-invalid={!(r.quantita > 0)} value={Number.isFinite(r.quantita) ? r.quantita : ''}
                  onChange={(e) => aggiorna(i, { quantita: e.target.valueAsNumber })} />
                <Tendina etichetta="Unità" classe="unita" valore={r.unita} opzioni={UNITA_INGREDIENTE} onCambia={(unita) => aggiorna(i, { unita })} />
              </div>
              <button type="button" className="tondo piccolo pericolo" aria-label={`Togli ${r.nome || `l'ingrediente ${i + 1}`}`}
                onClick={() => onCambia(righe.filter((_, n) => n !== i))}><X size={16} /></button>
            </div>
          )
        })}
        {righe.length === 0 && <p className="tenue piccolo" style={{ margin: 0 }}>Ancora nessun ingrediente.</p>}
      </div>
      <div>
        <ScegliProdotto etichetta="Aggiungi un ingrediente" classe="bottone secondario compatto"
          onScegli={(p) => aggiungi({ prodottoID: p.id, nome: p.nome, ...INGREDIENTE_DA[p.unita] ?? { quantita: 1, unita: p.unita } })}
          onTesto={(nome) => aggiungi({ nome, quantita: 100, unita: 'grammo' })}>
          <Plus size={16} aria-hidden /> Aggiungi ingrediente
        </ScegliProdotto>
      </div>
    </div>
  )
}

/**
 * Gli elettrodomestici che servono, da indicare sempre: chi non li ha non si vede proporre la
 * ricetta. «Solo fornelli» e' una risposta ([]); nessuna scelta (undefined) non si salva. Dai
 * passaggi si propongono quelli che nominano, con le regole dell'app.
 */
function Elettrodomestici({ valore, passaggi, onCambia }: { valore?: string[]; passaggi: string[]; onCambia: (v: string[]) => void }) {
  const daiPassaggi = elettrodomesticiDaiPassaggi(passaggi)
  const scelti = valore ?? []
  const elenco = (ids: string[]) => ids.map((id) => ELETTRODOMESTICI.find((e) => e.id === id)?.nome ?? id).join(', ')
  const nominati = valore ? daiPassaggi.filter((id) => !valore.includes(id)) : []
  const alterna = (id: string) => onCambia(scelti.includes(id)
    ? scelti.filter((x) => x !== id)
    : ELETTRODOMESTICI.map((e) => e.id).filter((x) => x === id || scelti.includes(x)))

  return (
    <div className="campo">
      <span id="elettrodomestici-ricetta">
        Elettrodomestici necessari {!valore && <span className="etichetta pomodoro">da indicare</span>}
      </span>
      <div className="elettrodomestici" role="group" aria-labelledby="elettrodomestici-ricetta">
        <button type="button" className="elettrodomestico" aria-pressed={valore?.length === 0} onClick={() => onCambia([])}>
          <span className="spunta" aria-hidden>{valore?.length === 0 && <Check size={12} strokeWidth={3.5} />}</span>
          <span className="figura"><CookingPot size={34} aria-hidden /></span>
          Solo fornelli
        </button>
        {ELETTRODOMESTICI.map((e) => {
          const si = scelti.includes(e.id)
          return (
            <button type="button" key={e.id} className="elettrodomestico" aria-pressed={si} onClick={() => alterna(e.id)}>
              <span className="spunta" aria-hidden>{si && <Check size={12} strokeWidth={3.5} />}</span>
              <img className="figura" src={`/cucina/${e.file}${si ? '' : '-spento'}.svg`} alt="" />
              {e.nome}
            </button>
          )
        })}
      </div>
      {!valore && daiPassaggi.length > 0 && (
        <div className="proposta">
          <span>Dai passaggi servono: <strong>{elenco(daiPassaggi)}</strong></span>
          <button type="button" className="bottone secondario compatto" onClick={() => onCambia(daiPassaggi)}>Usa questi</button>
        </div>
      )}
      {!valore && daiPassaggi.length === 0 && passaggi.some((p) => p.trim()) && (
        <div className="proposta">
          <span>I passaggi non nominano elettrodomestici.</span>
          <button type="button" className="bottone secondario compatto" onClick={() => onCambia([])}>Bastano i fornelli</button>
        </div>
      )}
      {nominati.length > 0 && (
        <small className="nota-avviso">I passaggi nominano anche: {elenco(nominati)}. Se serve davvero, segnalo.</small>
      )}
      <small>Chi non li ha in cucina non si vede proporre la ricetta. I fornelli ci sono sempre.</small>
    </div>
  )
}

/** Calcolate, non scelte: come nell'app, una ricetta rispetta un'esigenza se la rispettano tutti i suoi ingredienti. */
function EsigenzeRicetta({ ingredienti }: { ingredienti: Ingrediente[] }) {
  const { contenuto } = useContenuto()
  const stato = esigenzeDellaRicetta(ingredienti, contenuto!.prodotti)
  // Se tutte mancano per lo stesso motivo (ingredienti assenti o scollegati) lo si dice una volta sola.
  const motivi = new Set(Object.values(stato))
  const comune = motivi.size === 1 && !motivi.has(null) ? [...motivi][0] : null
  return (
    <div className="campo">
      <span id="esigenze-ricetta">Esigenze alimentari</span>
      <div className="esigenze" role="list" aria-labelledby="esigenze-ricetta">
        {ESIGENZE.map((t) => {
          const I = ICONE_ESIGENZA[t]
          const motivo = stato[t]
          return (
            <div key={t} role="listitem" className={`esigenza calcolata${motivo ? '' : ' si'}`}>
              <span className="spunta" aria-hidden>{motivo ? <X size={12} strokeWidth={3.5} /> : <Check size={12} strokeWidth={3.5} />}</span>
              <I size={24} aria-hidden />
              {TAG[t]}
              <small>{motivo ? (comune ? 'No' : `No: ${motivo}`) : 'Sì'}</small>
            </div>
          )
        })}
      </div>
      {comune && <div className="avviso" style={{ margin: 0 }}>Nessuna esigenza: {comune}.</div>}
      <small>Si calcolano da sole dagli ingredienti collegati: è così che l’app decide chi può mangiare la ricetta.</small>
    </div>
  )
}

function Passaggi({ righe, onCambia }: { righe: string[]; onCambia: (r: string[]) => void }) {
  const elenco = useRef<HTMLOListElement>(null)
  const daScrivere = useRef<number | null>(null)
  useEffect(() => {
    if (daScrivere.current == null) return
    elenco.current?.querySelectorAll('textarea')[daScrivere.current]?.focus()
    daScrivere.current = null
  })
  const sposta = (i: number, verso: number) => {
    const copia = [...righe]
    ;[copia[i], copia[i + verso]] = [copia[i + verso], copia[i]]
    onCambia(copia)
  }
  return (
    <div className="campo">
      <Reparto>Procedimento · {righe.length} {righe.length === 1 ? 'passaggio' : 'passaggi'}</Reparto>
      {righe.length === 0 && <p className="tenue piccolo" style={{ margin: 0 }}>Ancora nessun passaggio.</p>}
      <ol className="passaggi" ref={elenco}>
        {righe.map((p, i) => (
          <li key={i} className="passaggio">
            <span className="numero-passo" aria-hidden>{i + 1}</span>
            <textarea className="area" aria-label={`Passaggio ${i + 1}`} value={p}
              placeholder={i === 0 ? 'Es. Porta a bollore l’acqua e sala.' : 'E poi?'}
              onChange={(e) => onCambia(righe.map((r, n) => n === i ? e.target.value : r))} />
            <div className="azioni-passo">
              <button type="button" className="tondo piccolo" aria-label={`Sposta su il passaggio ${i + 1}`} disabled={i === 0} onClick={() => sposta(i, -1)}><ArrowUp size={16} /></button>
              <button type="button" className="tondo piccolo" aria-label={`Sposta giù il passaggio ${i + 1}`} disabled={i === righe.length - 1} onClick={() => sposta(i, 1)}><ArrowDown size={16} /></button>
              <button type="button" className="tondo piccolo pericolo" aria-label={`Togli il passaggio ${i + 1}`} onClick={() => onCambia(righe.filter((_, n) => n !== i))}><X size={16} /></button>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <button type="button" className="bottone secondario compatto" onClick={() => { daScrivere.current = righe.length; onCambia([...righe, '']) }}>
          <Plus size={16} aria-hidden /> Aggiungi passaggio
        </button>
      </div>
    </div>
  )
}

/**
 * Le foto dei piatti della community fatti con questa ricetta: sono quelle che l'app mostra.
 * Se ne aggiunge una a nome della redazione; le proprie si tolgono qui, quelle degli utenti si
 * moderano da Post community.
 */
function FotoCommunity({ piatti, ricetta, onCambiate }: { piatti: Piatto[]; ricetta: Ricetta | null; onCambiate: () => void }) {
  const notifica = useNotifica()
  const [nuova, impostaNuova] = useState(false)
  const chiudiNuova = useCallback(() => impostaNuova(false), [])
  const [daTogliere, impostaDaTogliere] = useState<string | null>(null)
  const togli = async (id: string) => {
    try {
      await chiama('piatti.elimina', { id })
      notifica('Foto tolta')
      onCambiate()
    } catch (e) {
      notifica((e as Error).message, true)
    }
    impostaDaTogliere(null)
  }
  const stato = (p: Piatto) => p.moderazione === 'in_attesa' ? 'in moderazione'
    : p.moderazione !== 'ok' ? 'nascosta' : p.segnalazioni >= 3 ? 'segnalata' : null

  return (
    <div className="campo">
      <Reparto>Foto dalla community · {piatti.length}</Reparto>
      <div className="foto-community">
        {ricetta && (
          <button type="button" className="aggiungi-foto" onClick={() => impostaNuova(true)}>
            <ImagePlus size={26} aria-hidden /> Aggiungi foto
          </button>
        )}
        {piatti.slice(0, 24).map((p) => (
          <div key={p.id} className={`foto${stato(p) ? ' non-visibile' : ''}`}>
            <a href={p.fotoUrl} target="_blank" rel="noreferrer">
              <img src={p.fotoUrl} alt={p.didascalia || `Il piatto di ${p.autore ?? 'un utente'}`} loading="lazy" />
            </a>
            {stato(p) && <span className="stato-foto">{stato(p)}</span>}
            {p.redazione && (daTogliere === p.id
              ? <button type="button" className="togli-foto conferma" onClick={() => togli(p.id)}>Togli?</button>
              : <button type="button" className="togli-foto" aria-label="Togli la foto" onClick={() => impostaDaTogliere(p.id)}><X size={14} /></button>)}
            <span className="didascalia">{p.autore ?? 'utente'} · <Heart size={11} aria-hidden /> {p.mi_piace}</span>
          </div>
        ))}
      </div>
      <small>
        {ricetta ? 'Sono le foto che l’app mostra sulla ricetta. Quelle degli utenti si moderano da Post community.'
          : 'Le foto si aggiungono dopo aver salvato la ricetta.'}
      </small>
      {nuova && ricetta && (
        <FoglioNuovaFoto ricettaId={ricetta.id} ricettaNome={ricetta.nome} onChiudi={chiudiNuova} onPubblicata={onCambiate} />
      )}
    </div>
  )
}
