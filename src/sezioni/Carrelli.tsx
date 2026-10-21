import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity, Baby, Bike, Brain, Cake, Carrot, Check, ChevronRight, Clock, Coffee, CupSoda, Droplet, Dumbbell, Fish,
  Flame, Flower2, Footprints, GlassWater, Heart, HeartPulse, House, Leaf, type LucideIcon, Medal, Moon,
  Pencil, Pill, Scale, ShoppingBag, ShoppingBasket, ShoppingCart, Smile, Snowflake, Sparkles, Star,
  Stethoscope, Sun, Timer, TreePine, Trophy, User, Users, Utensils, Waves, Wheat, Wine,
} from 'lucide-react'
import { type Carrello, cerca, perNome, type Ricetta } from '../dominio'
import { BottoneNuovo, Campo, Cerca, Foglio, Intestazione, PiedeModifica, Stato, useContenuto, useElenco } from '../ui'
import { fotoPerRicetta, type Piatto } from './Ricette'

// I simboli che l'iPhone disegna sono SF Symbols: qui solo nomi che esistono da iOS 17, ognuno
// con l'icona web che gli somiglia di piu' per riconoscerlo nel pannello.
export const ICONE: { simbolo: string; nome: string; icona: LucideIcon }[] = [
  { simbolo: 'scalemass', nome: 'Bilancia', icona: Scale },
  { simbolo: 'heart', nome: 'Cuore', icona: Heart },
  { simbolo: 'bolt.heart', nome: 'Battito', icona: HeartPulse },
  { simbolo: 'figure.run', nome: 'Corsa', icona: Activity },
  { simbolo: 'figure.walk', nome: 'Camminata', icona: Footprints },
  { simbolo: 'bicycle', nome: 'Bici', icona: Bike },
  { simbolo: 'figure.pool.swim', nome: 'Nuoto', icona: Waves },
  { simbolo: 'dumbbell', nome: 'Pesi', icona: Dumbbell },
  { simbolo: 'trophy', nome: 'Coppa', icona: Trophy },
  { simbolo: 'medal', nome: 'Medaglia', icona: Medal },
  { simbolo: 'figure.2.and.child.holdinghands', nome: 'Famiglia', icona: Baby },
  { simbolo: 'person', nome: 'Persona', icona: User },
  { simbolo: 'person.2', nome: 'Coppia', icona: Users },
  { simbolo: 'figure.mind.and.body', nome: 'Benessere', icona: Flower2 },
  { simbolo: 'brain.head.profile', nome: 'Mente', icona: Brain },
  { simbolo: 'face.smiling', nome: 'Sorriso', icona: Smile },
  { simbolo: 'stethoscope', nome: 'Salute', icona: Stethoscope },
  { simbolo: 'pills', nome: 'Integratori', icona: Pill },
  { simbolo: 'leaf', nome: 'Foglia', icona: Leaf },
  { simbolo: 'carrot', nome: 'Carota', icona: Carrot },
  { simbolo: 'fish', nome: 'Pesce', icona: Fish },
  { simbolo: 'allergens', nome: 'Cereali', icona: Wheat },
  { simbolo: 'fork.knife', nome: 'Posate', icona: Utensils },
  { simbolo: 'cup.and.saucer', nome: 'Tazza', icona: Coffee },
  { simbolo: 'birthday.cake', nome: 'Torta', icona: Cake },
  { simbolo: 'takeoutbag.and.cup.and.straw', nome: 'Da asporto', icona: CupSoda },
  { simbolo: 'wineglass', nome: 'Calice', icona: Wine },
  { simbolo: 'waterbottle', nome: 'Borraccia', icona: GlassWater },
  { simbolo: 'drop', nome: 'Goccia', icona: Droplet },
  { simbolo: 'flame', nome: 'Fiamma', icona: Flame },
  { simbolo: 'snowflake', nome: 'Fiocco', icona: Snowflake },
  { simbolo: 'sun.max', nome: 'Sole', icona: Sun },
  { simbolo: 'moon', nome: 'Luna', icona: Moon },
  { simbolo: 'sparkles', nome: 'Scintille', icona: Sparkles },
  { simbolo: 'star', nome: 'Stella', icona: Star },
  { simbolo: 'tree', nome: 'Albero', icona: TreePine },
  { simbolo: 'house', nome: 'Casa', icona: House },
  { simbolo: 'clock', nome: 'Orologio', icona: Clock },
  { simbolo: 'timer', nome: 'Timer', icona: Timer },
  { simbolo: 'cart', nome: 'Carrello', icona: ShoppingCart },
  { simbolo: 'basket', nome: 'Cestino', icona: ShoppingBasket },
  { simbolo: 'bag', nome: 'Borsa', icona: ShoppingBag },
]

export const IconaCarrello = ({ simbolo, lato = 22 }: { simbolo: string; lato?: number }) => {
  const Icona = ICONE.find((i) => i.simbolo === simbolo)?.icona ?? ShoppingBasket
  return <Icona size={lato} aria-hidden />
}

// I tre pasti del piano settimanale, nell'ordine in cui l'app li fa scegliere. Chi ha scelto un
// carrello vede solo le sue ricette: un pasto senza ricette resta senza proposte.
const PASTI = [
  { momento: 'colazione', tante: 'Colazioni', una: 'colazione', nessuna: 'Nessuna colazione', cerca: 'Cerca una colazione' },
  { momento: 'pranzo', tante: 'Pranzi', una: 'pranzo', nessuna: 'Nessun pranzo', cerca: 'Cerca un pranzo' },
  { momento: 'cena', tante: 'Cene', una: 'cena', nessuna: 'Nessuna cena', cerca: 'Cerca una cena' },
]

// Le porzioni dei quattro carrelli di partenza: si sceglie a parole, il numero lo usa l'app.
const PORZIONI = [
  { valore: 0.7, nome: 'Piccole' },
  { valore: 0.85, nome: 'Leggere' },
  { valore: 1, nome: 'Normali' },
  { valore: 1.15, nome: 'Abbondanti' },
]
const per = (valore: number) => `×${valore.toLocaleString('it-IT')}`
const nomePorzioni = (valore: number) => PORZIONI.find((p) => p.valore === valore)?.nome ?? `Su misura ${per(valore)}`

type Bozza = Carrello & { ricette: string[] }
const VUOTO: Bozza = { id: '', nome: '', descrizione: '', simbolo: 'cart', moltiplicatorePorzione: 1, ricette: [] }

export default function Carrelli() {
  const { contenuto, errore } = useContenuto()
  const [filtro, impostaFiltro] = useState('')
  // Il foglio aperto: un carrello da modificare, null per uno nuovo.
  const [aperto, impostaAperto] = useState<{ carrello: Carrello | null } | null>(null)
  const chiudi = useCallback(() => impostaAperto(null), [])

  const carrelli = contenuto?.carrelli ?? []
  const ricette = contenuto?.ricette ?? []

  return (
    <>
      <Intestazione titolo="Carrelli"
        sottotitolo="Chi sceglie un carrello si vede proporre solo le sue colazioni, i suoi pranzi e le sue cene."
        azione={<BottoneNuovo testo="Nuovo carrello" onClick={() => impostaAperto({ carrello: null })} />} />
      {carrelli.length > 6 && <div className="barra"><Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca un carrello" /></div>}
      <Stato caricamento={!contenuto} errore={errore} vuoto={carrelli.length === 0}>
        <div className="elenco" style={{ marginTop: 20 }}>
          {cerca(carrelli, filtro, (c) => c.nome).map((c) => (
            <div key={c.id} className="scheda cliccabile" onClick={() => impostaAperto({ carrello: c })} role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && impostaAperto({ carrello: c })}>
              <div className="simbolo"><IconaCarrello simbolo={c.simbolo} /></div>
              <div className="principale">
                <div className="nome">{c.nome}</div>
                {c.descrizione && <div className="tenue piccolo">{c.descrizione}</div>}
                <div className="riga">
                  {PASTI.map((p) => {
                    const n = ricette.filter((r) => r.momento === p.momento && r.carrelli.includes(c.id)).length
                    return (
                      <span key={p.momento} className={`etichetta ${n ? 'salvia' : 'pomodoro'}`}>
                        {n ? `${n} ${n === 1 ? p.una : p.tante.toLowerCase()}` : p.nessuna}
                      </span>
                    )
                  })}
                  <span className="etichetta">Porzioni {nomePorzioni(c.moltiplicatorePorzione).toLowerCase()}</span>
                </div>
              </div>
              <ChevronRight size={20} className="tenue" aria-hidden />
            </div>
          ))}
        </div>
      </Stato>

      {aperto && contenuto && <FoglioCarrello carrello={aperto.carrello} onChiudi={chiudi} />}
    </>
  )
}

/**
 * Il foglio di un carrello, con il secondo foglio delle sue ricette: dalla sezione Carrelli e
 * dall'Editor. `carrello` null = nuovo. `onChiudi` deve restare la stessa funzione (useCallback):
 * il foglio la usa per Esc.
 */
export function FoglioCarrello({ carrello, onChiudi, onSalvato }: {
  carrello: Carrello | null; onChiudi: () => void; onSalvato?: (id: string | null) => void
}) {
  const { contenuto, salvaCarrello, elimina } = useContenuto()
  const carrelli = contenuto?.carrelli ?? []
  const ricette = contenuto?.ricette ?? []
  const nuovo = !carrello
  const [valore, imposta] = useState<Bozza>(() => carrello
    ? { ...carrello, ricette: ricette.filter((r) => r.carrelli.includes(carrello.id)).map((r) => r.id) }
    : VUOTO)
  const cambia = (modifica: Partial<Bozza>) => imposta((v) => ({ ...v, ...modifica }))
  const [inCorso, impostaInCorso] = useState(false)
  const [sceltaRicette, impostaSceltaRicette] = useState(false)
  const chiudiRicette = useCallback(() => impostaSceltaRicette(false), [])

  const esegui = async (operazione: () => Promise<boolean>, id: string | null) => {
    impostaInCorso(true)
    const ok = await operazione().finally(() => impostaInCorso(false))
    if (!ok) return
    onSalvato?.(id)
    onChiudi()
  }
  const salvaBozza = () => {
    const { ricette: scelte, ...dati } = valore
    // Il carrello nuovo prende l'id dal nome sul server: chi lo vuole selezionare lo ritrova da li'.
    esegui(() => salvaCarrello(dati, scelte, nuovo), nuovo ? null : dati.id)
  }

  return (
    <>
      <Foglio titolo={nuovo ? 'Nuovo carrello' : 'Modifica carrello'} onChiudi={onChiudi}
        piede={<PiedeModifica inCorso={inCorso} disabilitato={!valore.nome.trim()} onSalva={salvaBozza}
          onElimina={nuovo || carrelli.length < 2 ? undefined : () => esegui(() => elimina('carrelli', valore.id), null)} />}>
        <div className="testa-nome">
          <SceltaIcona simbolo={valore.simbolo} onScegli={(simbolo) => cambia({ simbolo })} />
          <Campo etichetta="Nome">
            <input className="input grande" value={valore.nome} maxLength={80} placeholder="Es. Controllo del peso"
              onChange={(e) => cambia({ nome: e.target.value })} />
          </Campo>
        </div>
        <Campo etichetta="Descrizione" aiuto="La legge l’utente quando sceglie il carrello">
          <textarea className="area" value={valore.descrizione} maxLength={300}
            placeholder="Es. Piatti leggeri e porzioni misurate, senza rinunciare al gusto"
            onChange={(e) => cambia({ descrizione: e.target.value })} />
        </Campo>
        <Porzioni valore={valore.moltiplicatorePorzione} onCambia={(moltiplicatorePorzione) => cambia({ moltiplicatorePorzione })} />
        <RiepilogoRicette scelte={valore.ricette} ricette={ricette} onApri={() => impostaSceltaRicette(true)} />
        {!nuovo && carrelli.length > 1 && (
          <p className="tenue piccolo" style={{ margin: 0 }}>
            Eliminandolo, chi lo usa passa a «{carrelli.find((c) => c.id !== valore.id)?.nome}».
          </p>
        )}
      </Foglio>
      {sceltaRicette && (
        <SceltaRicette carrello={valore} onCambia={(scelte) => cambia({ ricette: scelte })} onChiudi={chiudiRicette} />
      )}
    </>
  )
}

/** L'icona e' un cerchio accanto al nome: toccandolo si apre tutta la scelta. */
function SceltaIcona({ simbolo, onScegli }: { simbolo: string; onScegli: (s: string) => void }) {
  const [aperta, apri] = useState(false)
  const contenitore = useRef<HTMLDivElement>(null)
  const cerchio = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aperta) return
    contenitore.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const fuori = (e: MouseEvent) => { if (!contenitore.current?.contains(e.target as Node)) apri(false) }
    document.addEventListener('mousedown', fuori)
    return () => document.removeEventListener('mousedown', fuori)
  }, [aperta])

  const scegli = (s: string) => {
    onScegli(s)
    apri(false)
    cerchio.current?.focus()
  }

  return (
    // Esc chiude la scelta e non il foglio sotto: il foglio ascolta su window, qui ci si ferma prima.
    <div className="scelta-icona" ref={contenitore}
      onKeyDown={(e) => { if (e.key === 'Escape' && aperta) { e.stopPropagation(); apri(false); cerchio.current?.focus() } }}>
      <button type="button" ref={cerchio} className="cerchio-icona" aria-haspopup="true" aria-expanded={aperta}
        title="Cambia icona" onClick={() => apri(!aperta)}>
        <IconaCarrello simbolo={simbolo} lato={28} />
        <span className="matita" aria-hidden><Pencil size={11} strokeWidth={3} /></span>
        <span className="sr-only">Icona: {ICONE.find((i) => i.simbolo === simbolo)?.nome ?? 'Cestino'}. Cambia</span>
      </button>
      {aperta && (
        <div className="tavolozza" role="radiogroup" aria-label="Icona del carrello">
          {ICONE.map(({ simbolo: s, nome, icona: Icona }) => (
            <button type="button" key={s} role="radio" aria-checked={s === simbolo} title={nome}
              className="icona-scelta" onClick={() => scegli(s)}>
              <Icona size={22} aria-hidden />
              <span className="sr-only">{nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Porzioni({ valore, onCambia }: { valore: number; onCambia: (v: number) => void }) {
  // Un valore scritto prima, fuori dai quattro, resta visibile e scelto finche' non si cambia.
  const opzioni = PORZIONI.some((p) => p.valore === valore) ? PORZIONI : [...PORZIONI, { valore, nome: 'Su misura' }]
  return (
    <div className="campo">
      <span id="porzioni-carrello">Porzioni</span>
      <div className="segmentato" role="radiogroup" aria-labelledby="porzioni-carrello">
        {opzioni.map((p) => (
          <button type="button" key={p.valore} role="radio" aria-checked={p.valore === valore} onClick={() => onCambia(p.valore)}>
            <strong>{p.nome}</strong>
            <small>{per(p.valore)}</small>
          </button>
        ))}
      </div>
      <small>Quanto cibo finisce in lista per ogni persona: «Normali» è la porzione della ricetta.</small>
    </div>
  )
}

function RiepilogoRicette({ scelte, ricette, onApri }: { scelte: string[]; ricette: Ricetta[]; onApri: () => void }) {
  const conta = PASTI.map((p) => ricette.filter((r) => r.momento === p.momento && scelte.includes(r.id)).length)
  return (
    <div className="campo">
      <span>Ricette</span>
      <button type="button" className="riepilogo-ricette" onClick={onApri}>
        {PASTI.map((p, i) => (
          <span key={p.momento} className="pasto">
            <strong className={conta[i] ? undefined : 'zero'}>{conta[i]}</strong>
            <span>{p.tante}</span>
          </span>
        ))}
        <span className="vai">Scegli le ricette <ChevronRight size={18} aria-hidden /></span>
      </button>
      <small>
        {conta.some((n) => n === 0)
          ? 'Dove c’è 0, chi sceglie questo carrello non ha niente da scegliere per quel pasto.'
          : 'Chi sceglie questo carrello vede solo queste ricette.'}
      </small>
    </div>
  )
}

/** Il foglio delle ricette, sopra quello del carrello: si spunta, e si pubblica col carrello. */
function SceltaRicette({ carrello, onCambia, onChiudi }: {
  carrello: Bozza; onCambia: (scelte: string[]) => void; onChiudi: () => void
}) {
  const { contenuto } = useContenuto()
  // Le foto delle ricette sono quelle dei piatti della community.
  const foto = fotoPerRicetta(useElenco<Piatto>('piatti.elenco').righe)
  const [pasto, impostaPasto] = useState(PASTI[0].momento)
  const [filtro, impostaFiltro] = useState('')
  const scelte = new Set(carrello.ricette)
  const ricette = contenuto!.ricette
  const delPasto = ricette.filter((r) => r.momento === pasto).sort(perNome)
  const visibili = cerca(delPasto, filtro, (r) => r.nome)
  const nomeCarrello = (id: string) => contenuto!.carrelli.find((c) => c.id === id)?.nome ?? id
  const corrente = PASTI.find((p) => p.momento === pasto)!

  const imposta = (ids: string[], si: boolean) => {
    const via = new Set(ids)
    onCambia(si ? [...new Set([...carrello.ricette, ...ids])] : carrello.ricette.filter((id) => !via.has(id)))
  }

  return (
    <Foglio titolo={`Ricette di «${carrello.nome.trim() || 'nuovo carrello'}»`} onChiudi={onChiudi}
      piede={<>
        <span className="tenue piccolo" style={{ alignSelf: 'center', flex: '1 1 0', minWidth: 0 }}>
          {carrello.ricette.length} {carrello.ricette.length === 1 ? 'ricetta scelta' : 'ricette scelte'} · si pubblicano col carrello
        </span>
        <button className="bottone principale" onClick={onChiudi}>Fatto</button>
      </>}>
      <div className="segmentato schede" role="tablist" aria-label="Pasto">
        {PASTI.map((p) => {
          const delMomento = ricette.filter((r) => r.momento === p.momento)
          return (
            <button type="button" key={p.momento} role="tab" aria-selected={p.momento === pasto} onClick={() => impostaPasto(p.momento)}>
              {p.tante}
              <span className="conta">{delMomento.filter((r) => scelte.has(r.id)).length}/{delMomento.length}</span>
            </button>
          )
        })}
      </div>
      <div className="barra-ricette">
        <Cerca valore={filtro} onCambia={impostaFiltro} segnaposto={corrente.cerca} />
        <button type="button" className="bottone secondario compatto" disabled={visibili.every((r) => scelte.has(r.id))}
          onClick={() => imposta(visibili.map((r) => r.id), true)}>Tutte</button>
        <button type="button" className="bottone secondario compatto" disabled={!visibili.some((r) => scelte.has(r.id))}
          onClick={() => imposta(visibili.map((r) => r.id), false)}>Nessuna</button>
      </div>
      {visibili.length === 0
        ? <div className="vuoto">
            {delPasto.length === 0
              ? `Nel ricettario non ci sono ancora ${corrente.tante.toLowerCase()}: si aggiungono da Ricette.`
              : `Nessuna ricetta con «${filtro.trim()}».`}
          </div>
        : <div className="righe" role="group" aria-label={corrente.tante}>
            {visibili.map((r) => {
              const altri = r.carrelli.filter((k) => k !== carrello.id).map(nomeCarrello)
              return (
                <label key={r.id} className="riga-ricetta">
                  <input type="checkbox" checked={scelte.has(r.id)} onChange={(e) => imposta([r.id], e.target.checked)} />
                  <span className="casella" aria-hidden><Check size={16} strokeWidth={3} /></span>
                  {foto.get(r.id)?.[0]
                    ? <img src={foto.get(r.id)![0].fotoUrl} alt="" loading="lazy" />
                    : <span className="senza-foto" aria-hidden><Utensils size={20} /></span>}
                  <span className="principale">
                    <strong>{r.nome}</strong>
                    <span className="tenue piccolo">
                      <Clock size={12} aria-hidden /> {r.minutiPreparazione} min{altri.length > 0 && ` · anche in ${altri.join(', ')}`}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>}
    </Foglio>
  )
}
