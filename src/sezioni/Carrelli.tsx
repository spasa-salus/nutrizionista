import { useState } from 'react'
import {
  Activity, Baby, Bike, Brain, Cake, Carrot, Check, Clock, Coffee, CupSoda, Droplet, Dumbbell, Fish,
  Flame, Flower2, Footprints, GlassWater, Heart, HeartPulse, House, Leaf, type LucideIcon, Medal, Moon,
  Pill, Plus, Scale, ShoppingBag, ShoppingBasket, ShoppingCart, Smile, Snowflake, Sparkles, Star,
  Stethoscope, Sun, Timer, TreePine, Trophy, User, Users, Utensils, Waves, Wheat, Wine, X,
} from 'lucide-react'
import { type Carrello, CATEGORIE, cerca, perNome, slug, TAG } from '../dominio'
import { BottoneNuovo, Campo, Cerca, Foglio, Intestazione, Pastiglie, PiedeModifica, Reparto, Stato, useBozza, useContenuto } from '../ui'

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

function CatalogoIcone({ scelto, onScegli }: { scelto: string; onScegli: (s: string) => void }) {
  return (
    <div className="campo">
      <span>Icona</span>
      <div className="catalogo-icone" role="radiogroup" aria-label="Icona del carrello">
        {ICONE.map(({ simbolo, nome, icona: Icona }) => (
          <button type="button" key={simbolo} role="radio" aria-checked={scelto === simbolo} title={nome}
            className="icona-scelta" onClick={() => onScegli(simbolo)}>
            <Icona size={22} aria-hidden />
            <span className="sr-only">{nome}</span>
            {scelto === simbolo && <Check size={12} strokeWidth={3} className="spunta" aria-hidden />}
          </button>
        ))}
      </div>
    </div>
  )
}

const VUOTO: Carrello = { id: '', nome: '', descrizione: '', simbolo: 'cart', tagPreferiti: [], moltiplicatorePorzione: 1, prodotti: [] }

export default function Carrelli() {
  const { contenuto, errore, salva, elimina } = useContenuto()
  const { bozza, apri, chiudi, cambia, inCorso, esegui } = useBozza<Carrello>()
  const [filtro, impostaFiltro] = useState('')

  const carrelli = contenuto?.carrelli ?? []
  const ricettePer = (id: string) => contenuto?.ricette.filter((r) => r.carrelli.includes(id)).length ?? 0

  return (
    <>
      <Intestazione titolo="Carrelli" sottotitolo="I percorsi che l’utente sceglie: gusto, porzioni e prodotti che spingono nella lista."
        azione={<BottoneNuovo testo="Nuovo carrello" onClick={() => apri(VUOTO, true)} />} />
      <div className="barra"><Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca un carrello" /></div>
      <Stato caricamento={!contenuto} errore={errore} vuoto={carrelli.length === 0}>
        <div className="elenco">
          {cerca(carrelli, filtro, (c) => c.nome + c.id).map((c) => (
            <div key={c.id} className="scheda cliccabile" onClick={() => apri(c)} role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && apri(c)}>
              <div className="simbolo"><IconaCarrello simbolo={c.simbolo} /></div>
              <div className="principale">
                <div className="nome">{c.nome}</div>
                <div className="tenue piccolo">{c.descrizione}</div>
                <div className="riga">
                  <span className="etichetta salvia">{c.prodotti.length} {c.prodotti.length === 1 ? 'prodotto' : 'prodotti'}</span>
                  <span className="etichetta">{ricettePer(c.id)} {ricettePer(c.id) === 1 ? 'ricetta' : 'ricette'}</span>
                  <span className="etichetta">porzioni ×{c.moltiplicatorePorzione}</span>
                  {c.tagPreferiti.map((t) => <span key={t} className="etichetta sabbia">{TAG[t] ?? t}</span>)}
                </div>
              </div>
              <span className="stampa tenue">{c.id}</span>
            </div>
          ))}
        </div>
      </Stato>

      {bozza && contenuto && (
        <Foglio titolo={bozza.nuovo ? 'Nuovo carrello' : bozza.valore.nome} onChiudi={chiudi}
          piede={<PiedeModifica inCorso={inCorso}
            onSalva={() => esegui(() => salva('carrelli', bozza.valore, bozza.nuovo))}
            onElimina={bozza.nuovo || carrelli.length < 2 ? undefined : () => esegui(() => elimina('carrelli', bozza.valore.id))} />}>
          <div className="griglia-campi">
            <Campo etichetta="Nome">
              <input className="input" value={bozza.valore.nome} maxLength={80}
                onChange={(e) => cambia({ nome: e.target.value, ...(bozza.nuovo ? { id: slug(e.target.value) } : {}) })} />
            </Campo>
            <Campo etichetta="Id" aiuto={bozza.nuovo ? 'Non si cambia più dopo la creazione' : 'Fisso: lo citano profili e ricette'}>
              <input className="input stampa" value={bozza.valore.id} disabled={!bozza.nuovo} onChange={(e) => cambia({ id: e.target.value })} />
            </Campo>
          </div>
          <Campo etichetta="Descrizione">
            <textarea className="area" value={bozza.valore.descrizione} maxLength={300} onChange={(e) => cambia({ descrizione: e.target.value })} />
          </Campo>
          <div className="griglia-campi">
            <Campo etichetta="Moltiplicatore porzioni" aiuto="1 = porzione piena, 0.7 = più piccola">
              <input className="input" type="number" step="0.05" min="0.1" max="3" value={bozza.valore.moltiplicatorePorzione}
                onChange={(e) => cambia({ moltiplicatorePorzione: e.target.valueAsNumber })} />
            </Campo>
          </div>
          <CatalogoIcone scelto={bozza.valore.simbolo} onScegli={(simbolo) => cambia({ simbolo })} />
          <Pastiglie etichetta="Gusto: tag preferiti" opzioni={Object.entries(TAG)} valori={bozza.valore.tagPreferiti}
            onCambia={(tagPreferiti) => cambia({ tagPreferiti })} />
          <ProdottiDelCarrello scelti={bozza.valore.prodotti} onCambia={(prodotti) => cambia({ prodotti })} />
          {!bozza.nuovo && carrelli.length > 1 && (
            <p className="tenue piccolo" style={{ margin: 0 }}>
              Eliminandolo, chi lo usa passa a «{carrelli.find((c) => c.id !== bozza.valore.id)?.nome}» e le ricette lo perdono.
            </p>
          )}
        </Foglio>
      )}
    </>
  )
}

function ProdottiDelCarrello({ scelti, onCambia }: { scelti: string[]; onCambia: (p: string[]) => void }) {
  const { contenuto } = useContenuto()
  const [filtro, impostaFiltro] = useState('')
  const catalogo = contenuto!.prodotti
  const perId = new Map(catalogo.map((p) => [p.id, p]))
  const proposte = filtro.trim()
    ? cerca(catalogo.filter((p) => !scelti.includes(p.id)), filtro, (p) => p.nome + p.id).sort(perNome).slice(0, 30)
    : []

  return (
    <div className="campo">
      <Reparto>Prodotti del carrello · {scelti.length}</Reparto>
      <small className="tenue">Passano davanti agli altri del loro reparto quando si compone la lista. I prodotti base (rilevanza ≥ 90) restano comunque.</small>
      <div className="righe">
        {scelti.map((id) => (
          <div key={id} className="voce-prodotto">
            <div className="principale">
              <strong>{perId.get(id)?.nome ?? id}</strong>{' '}
              <span className="tenue piccolo">{CATEGORIE[perId.get(id)?.categoria ?? ''] ?? 'prodotto eliminato'}</span>
            </div>
            <button type="button" className="tondo piccolo pericolo" aria-label={`Togli ${perId.get(id)?.nome ?? id}`}
              onClick={() => onCambia(scelti.filter((s) => s !== id))}><X size={16} /></button>
          </div>
        ))}
      </div>
      <Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Aggiungi un prodotto…" />
      {proposte.length > 0 && (
        <div className="suggerimenti">
          {proposte.map((p) => (
            <button type="button" key={p.id} onClick={() => { onCambia([...scelti, p.id]); impostaFiltro('') }}>
              <span><Plus size={14} /> {p.nome}</span><span className="tenue piccolo">{CATEGORIE[p.categoria]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
