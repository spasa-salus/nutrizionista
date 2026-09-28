import { useState } from 'react'
import { CATEGORIE, cerca, perNome, type Prodotto, slug, TAG, UNITA } from '../dominio'
import { BottoneNuovo, Campo, Cerca, Foglio, Intestazione, Pastiglie, PiedeModifica, Reparto, Stato, useBozza, useContenuto } from '../ui'

export const VUOTO: Prodotto = { id: '', nome: '', categoria: 'fruttaVerdura', tag: [], supermercati: [], unita: 'pezzo', quantitaBase: 1, rilevanza: 60 }

export default function Prodotti() {
  const { contenuto, errore, salva, elimina } = useContenuto()
  const { bozza, apri, chiudi, cambia, inCorso, esegui } = useBozza<Prodotto>()
  const [filtro, impostaFiltro] = useState('')
  const [categoria, impostaCategoria] = useState('')

  const prodotti = cerca(contenuto?.prodotti ?? [], filtro, (p) => p.nome + p.id)
    .filter((p) => !categoria || p.categoria === categoria)
  const reparti = Object.keys(CATEGORIE)
    .map((c) => [c, prodotti.filter((p) => p.categoria === c).sort(perNome)] as const)
    .filter(([, elenco]) => elenco.length > 0)

  return (
    <>
      <Intestazione titolo="Prodotti" sottotitolo={`${contenuto?.prodotti.length ?? 0} prodotti nel catalogo`}
        azione={<BottoneNuovo testo="Nuovo prodotto" onClick={() => apri(VUOTO, true)} />} />
      <div className="barra">
        <Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca un prodotto" />
        <select className="select" style={{ width: 'auto' }} value={categoria} onChange={(e) => impostaCategoria(e.target.value)} aria-label="Reparto">
          <option value="">Tutti i reparti</option>
          {Object.entries(CATEGORIE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Stato caricamento={!contenuto} errore={errore} vuoto={prodotti.length === 0}>
        {reparti.map(([c, elenco]) => (
          <section key={c}>
            <Reparto>{CATEGORIE[c]} · {elenco.length}</Reparto>
            <div className="elenco">
              {elenco.map((p) => (
                <div key={p.id} className="scheda cliccabile" onClick={() => apri(p)} role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && apri(p)}>
                  <div className="principale">
                    <div className="nome">{p.nome}</div>
                    <div className="riga">
                      <span className="etichetta salvia">{p.quantitaBase} {UNITA[p.unita]} / persona / giorno</span>
                      <span className="etichetta">rilevanza {p.rilevanza}</span>
                      {p.tag.map((t) => <span key={t} className="etichetta sabbia">{TAG[t] ?? t}</span>)}
                    </div>
                  </div>
                  <span className="stampa tenue">{p.id}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </Stato>

      {bozza && (
        <FoglioProdotto valore={bozza.valore} nuovo={bozza.nuovo} cambia={cambia} chiudi={chiudi} inCorso={inCorso}
          onSalva={() => esegui(() => salva('prodotti', bozza.valore, bozza.nuovo))}
          onElimina={bozza.nuovo ? undefined : () => esegui(() => elimina('prodotti', bozza.valore.id))} />
      )}
    </>
  )
}

/** Il foglio di modifica di un prodotto: dalla sezione Prodotti e dagli abbinamenti dei punti vendita. */
export function FoglioProdotto({ valore, nuovo, cambia, chiudi, inCorso, onSalva, onElimina }: {
  valore: Prodotto; nuovo: boolean; cambia: (m: Partial<Prodotto>) => void; chiudi: () => void
  inCorso: boolean; onSalva: () => void; onElimina?: () => void
}) {
  const { contenuto } = useContenuto()
  // Dove il prodotto e' citato: lo dice il foglio prima di eliminarlo.
  const citazioni = (id: string) => ({
    carrelli: contenuto?.carrelli.filter((c) => c.prodotti.includes(id)).map((c) => c.nome) ?? [],
    ricette: contenuto?.ricette.filter((r) => r.ingredienti.some((i) => i.prodottoID === id)).length ?? 0,
  })

  return (
    <Foglio titolo={nuovo ? 'Nuovo prodotto' : valore.nome} onChiudi={chiudi}
      piede={<PiedeModifica inCorso={inCorso} onSalva={onSalva} onElimina={onElimina} />}>
      <div className="griglia-campi">
        <Campo etichetta="Nome">
          <input className="input" value={valore.nome} maxLength={120}
            onChange={(e) => cambia({ nome: e.target.value, ...(nuovo ? { id: slug(e.target.value) } : {}) })} />
        </Campo>
        <Campo etichetta="Id" aiuto={nuovo ? 'Non si cambia più dopo la creazione' : 'Fisso: lo citano liste e ricette'}>
          <input className="input stampa" value={valore.id} disabled={!nuovo} onChange={(e) => cambia({ id: e.target.value })} />
        </Campo>
      </div>
      <div className="griglia-campi">
        <Campo etichetta="Reparto">
          <select className="select" value={valore.categoria} onChange={(e) => cambia({ categoria: e.target.value })}>
            {Object.entries(CATEGORIE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo etichetta="Unità">
          <select className="select" value={valore.unita} onChange={(e) => cambia({ unita: e.target.value })}>
            {Object.entries(UNITA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo etichetta="Quantità base" aiuto="Per persona al giorno, se fosse l’unico del reparto">
          <input className="input" type="number" min="0.001" step="any" value={valore.quantitaBase}
            onChange={(e) => cambia({ quantitaBase: e.target.valueAsNumber })} />
        </Campo>
      </div>
      <Campo etichetta={`Rilevanza: ${valore.rilevanza}`} aiuto="0 = ci si arriva solo cercandolo · 90+ = spesa base, non lo sposta nessun carrello">
        <input type="range" min="0" max="100" value={valore.rilevanza} style={{ accentColor: 'var(--terracotta)' }}
          onChange={(e) => cambia({ rilevanza: e.target.valueAsNumber })} />
      </Campo>
      <Pastiglie etichetta="Tag" opzioni={Object.entries(TAG)} valori={valore.tag} onCambia={(tag) => cambia({ tag })} />
      <Pastiglie etichetta="Supermercati che lo vendono" valori={valore.supermercati}
        opzioni={[...(contenuto?.supermercati ?? [])].sort(perNome).map((s) => [s.id, s.nome])}
        onCambia={(supermercati) => cambia({ supermercati })} />
      {!nuovo && (() => {
        const c = citazioni(valore.id)
        return (c.carrelli.length > 0 || c.ricette > 0) && (
          <p className="tenue piccolo" style={{ margin: 0 }}>
            Citato in {c.ricette} ricette{c.carrelli.length ? ` e nei carrelli ${c.carrelli.join(', ')}` : ''}.
            Eliminandolo, nelle ricette resta come ingrediente scritto a mano.
          </p>
        )
      })()}
    </Foglio>
  )
}
