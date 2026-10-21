import { useState } from 'react'
import {
  Carrot, Check, ChevronRight, Croissant, CupSoda, Droplet, Drumstick, LayoutGrid, type LucideIcon, Milk, MilkOff,
  Package, Salad, Snowflake, Vegan, Wheat, WheatOff,
} from 'lucide-react'
import { CATEGORIE, cerca, ESIGENZE, idDaNome, perNome, type Prodotto, TAG, UNITA } from '../dominio'
import { BottoneNuovo, Campo, Cerca, Foglio, Intestazione, PiedeModifica, Reparto, Stato, Tendina, useBozza, useContenuto } from '../ui'

// Rilevanza e supermercati non si mostrano piu': restano nel dato col valore che hanno (l'app
// pesa gli ingredienti con la rilevanza), e un prodotto nuovo prende quelli di partenza.
export const VUOTO: Prodotto = { id: '', nome: '', categoria: 'fruttaVerdura', tag: [], supermercati: [], unita: 'pezzo', quantitaBase: 1, rilevanza: 60 }

export const ICONE_REPARTO: Record<string, LucideIcon> = {
  fruttaVerdura: Carrot, proteine: Drumstick, latticini: Milk, cereali: Wheat, colazione: Croissant,
  dispensa: Package, surgelati: Snowflake, condimenti: Droplet, bevande: CupSoda,
}

// Nel menu le unita' per intero; nelle schede la forma breve di UNITA.
const UNITA_PER_ESTESO: [string, string][] = [
  ['pezzo', 'pezzi'], ['grammo', 'grammi (g)'], ['chilogrammo', 'chili (kg)'],
  ['millilitro', 'millilitri (ml)'], ['litro', 'litri (l)'], ['confezione', 'confezioni'],
]
const SINGOLARE: Record<string, string> = { pezzo: 'pezzo', confezione: 'confezione' }
const quanto = (p: Prodotto) =>
  `${p.quantitaBase.toLocaleString('it-IT')} ${(p.quantitaBase === 1 && SINGOLARE[p.unita]) || UNITA[p.unita] || p.unita}`

export const ICONE_ESIGENZA: Record<string, LucideIcon> = { vegano: Vegan, vegetariano: Salad, senzaGlutine: WheatOff, senzaLattosio: MilkOff }

/**
 * Il foglio di un prodotto aperto da dove serve (sezione Prodotti, ingredienti di una ricetta,
 * Editor): `apri(p)` per modificarlo, `nuovo()` per crearne uno, `foglio` va messo nella pagina.
 */
export function useFoglioProdotto() {
  const { salva, elimina } = useContenuto()
  const { bozza, apri, chiudi, cambia, inCorso, esegui } = useBozza<Prodotto>()
  const foglio = bozza && (
    <FoglioProdotto valore={bozza.valore} nuovo={bozza.nuovo} cambia={cambia} chiudi={chiudi} inCorso={inCorso}
      onSalva={() => esegui(() => salva('prodotti', bozza.valore, bozza.nuovo))}
      onElimina={bozza.nuovo ? undefined : () => esegui(() => elimina('prodotti', bozza.valore.id))} />
  )
  return { apri: (p: Prodotto) => apri(p), nuovo: () => apri(VUOTO, true), foglio }
}

export default function Prodotti() {
  const { contenuto, errore } = useContenuto()
  const prodotto = useFoglioProdotto()
  const [filtro, impostaFiltro] = useState('')
  const [categoria, impostaCategoria] = useState('')

  const prodotti = cerca(contenuto?.prodotti ?? [], filtro, (p) => p.nome)
    .filter((p) => !categoria || p.categoria === categoria)
  const reparti = Object.keys(CATEGORIE)
    .map((c) => [c, prodotti.filter((p) => p.categoria === c).sort(perNome)] as const)
    .filter(([, elenco]) => elenco.length > 0)
  const usi = new Map<string, number>()
  for (const r of contenuto?.ricette ?? []) {
    for (const id of new Set(r.ingredienti.map((i) => i.prodottoID))) if (id) usi.set(id, (usi.get(id) ?? 0) + 1)
  }

  return (
    <>
      <Intestazione titolo="Prodotti" sottotitolo={`${contenuto?.prodotti.length ?? 0} prodotti nel catalogo, divisi per reparto`}
        azione={<BottoneNuovo testo="Nuovo prodotto" onClick={prodotto.nuovo} />} />
      <div className="barra">
        <Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca un prodotto" />
        <Tendina etichetta="Reparto" classe="compatta" valore={categoria} onCambia={impostaCategoria}
          icona={ICONE_REPARTO[categoria] ?? LayoutGrid} opzioni={[['', 'Tutti i reparti'], ...Object.entries(CATEGORIE)]} />
      </div>
      <Stato caricamento={!contenuto} errore={errore} vuoto={prodotti.length === 0}>
        {reparti.map(([c, elenco]) => {
          const Icona = ICONE_REPARTO[c] ?? Package
          return (
            <section key={c}>
              <Reparto>{CATEGORIE[c]} · {elenco.length}</Reparto>
              <div className="elenco">
                {elenco.map((p) => (
                  <div key={p.id} className="scheda cliccabile" onClick={() => prodotto.apri(p)} role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && prodotto.apri(p)}>
                    <div className="simbolo"><Icona size={22} aria-hidden /></div>
                    <div className="principale">
                      <div className="nome">{p.nome}</div>
                      <div className="riga">
                        <span className="etichetta salvia">{quanto(p)} a persona al giorno</span>
                        {p.tag.filter((t) => ESIGENZE.includes(t)).map((t) => <span key={t} className="etichetta sabbia">{TAG[t]}</span>)}
                        {(usi.get(p.id) ?? 0) > 0 && (
                          <span className="etichetta">in {usi.get(p.id)} {usi.get(p.id) === 1 ? 'ricetta' : 'ricette'}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={20} className="tenue" aria-hidden />
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </Stato>

      {prodotto.foglio}
    </>
  )
}

/** Il foglio di modifica di un prodotto: dalla sezione Prodotti e dagli abbinamenti dei punti vendita. */
export function FoglioProdotto({ valore, nuovo, cambia, chiudi, inCorso, onSalva, onElimina }: {
  valore: Prodotto; nuovo: boolean; cambia: (m: Partial<Prodotto>) => void; chiudi: () => void
  inCorso: boolean; onSalva: () => void; onElimina?: () => void
}) {
  const { contenuto } = useContenuto()
  const Icona = ICONE_REPARTO[valore.categoria] ?? Package
  // L'id non si vede: nasce dal nome e dopo la creazione non cambia piu' (lo citano ricette e liste).
  const presi = contenuto?.prodotti.map((p) => p.id) ?? []
  const ricette = contenuto?.ricette.filter((r) => r.ingredienti.some((i) => i.prodottoID === valore.id)).length ?? 0
  const pronto = valore.nome.trim() !== '' && valore.quantitaBase > 0

  return (
    <Foglio titolo={nuovo ? 'Nuovo prodotto' : 'Modifica prodotto'} onChiudi={chiudi}
      piede={<PiedeModifica inCorso={inCorso} disabilitato={!pronto} onSalva={onSalva} onElimina={onElimina} />}>
      <div className="testa-nome">
        <span className="cerchio-icona fisso" aria-hidden><Icona size={28} /></span>
        <Campo etichetta="Nome">
          <input className="input grande" value={valore.nome} maxLength={120} placeholder="Es. Pomodori ciliegini"
            onChange={(e) => cambia({ nome: e.target.value, ...(nuovo ? { id: idDaNome(e.target.value, presi, 'prodotto') } : {}) })} />
        </Campo>
      </div>
      <Campo etichetta="Reparto">
        <Tendina etichetta="Reparto" valore={valore.categoria} icona={Icona} opzioni={Object.entries(CATEGORIE)}
          onCambia={(categoria) => cambia({ categoria })} />
      </Campo>
      <div className="campo">
        <span id="quantita-prodotto">Quantità a persona, al giorno</span>
        <div className="quantita-unita" role="group" aria-labelledby="quantita-prodotto">
          <input className="numero" type="number" min="0.001" step="any" inputMode="decimal" aria-label="Quantità"
            value={Number.isFinite(valore.quantitaBase) ? valore.quantitaBase : ''}
            onChange={(e) => cambia({ quantitaBase: e.target.valueAsNumber })} />
          <Tendina etichetta="Unità di misura" classe="unita" valore={valore.unita} opzioni={UNITA_PER_ESTESO}
            onCambia={(unita) => cambia({ unita })} />
        </div>
        <small>Quanto ne usa di solito una persona in un giorno.</small>
      </div>
      <Esigenze valori={valore.tag} onCambia={(tag) => cambia({ tag })} />
      {!nuovo && ricette > 0 && (
        <p className="tenue piccolo" style={{ margin: 0 }}>
          Usato in {ricette} {ricette === 1 ? 'ricetta' : 'ricette'}. Eliminandolo, nelle ricette resta come ingrediente scritto a mano.
        </p>
      )}
    </Foglio>
  )
}

function Esigenze({ valori, onCambia }: { valori: string[]; onCambia: (v: string[]) => void }) {
  const scelte = valori.filter((t) => ESIGENZE.includes(t))
  // Vegano vuol dire anche vegetariano: si accende insieme, e spegnendo vegetariano si spegne anche lui.
  const cambiaUna = (t: string, si: boolean) => {
    if (si) onCambia([...new Set([...scelte, t, ...(t === 'vegano' ? ['vegetariano'] : [])])])
    else onCambia(scelte.filter((v) => v !== t && !(t === 'vegetariano' && v === 'vegano')))
  }
  return (
    <div className="campo">
      <span id="esigenze-prodotto">Esigenze alimentari</span>
      <div className="esigenze" role="group" aria-labelledby="esigenze-prodotto">
        {ESIGENZE.map((t) => {
          const Icona = ICONE_ESIGENZA[t]
          const si = scelte.includes(t)
          return (
            <button type="button" key={t} className="esigenza" aria-pressed={si} onClick={() => cambiaUna(t, !si)}>
              <span className="spunta" aria-hidden>{si && <Check size={12} strokeWidth={3.5} />}</span>
              <Icona size={24} aria-hidden />
              {TAG[t]}
            </button>
          )
        })}
      </div>
      <small>Spunta solo quelle che il prodotto rispetta davvero: decidono a chi si propongono le ricette che lo usano.</small>
    </div>
  )
}
