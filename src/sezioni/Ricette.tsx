import { useState } from 'react'
import { ArrowDown, ArrowUp, Clock, Plus, Users, X } from 'lucide-react'
import { cerca, type Ingrediente, MOMENTI, perNome, type Ricetta, slug, TAG, UNITA } from '../dominio'
import { BottoneNuovo, Campo, Cerca, Foglio, Intestazione, Pastiglie, PiedeModifica, Reparto, Stato, useBozza, useContenuto } from '../ui'

const VUOTA: Ricetta = {
  id: '', nome: '', descrizione: '', ingredienti: [], carrelli: [], tag: [],
  minutiPreparazione: 20, porzioni: 2, passaggi: [], momento: 'pranzo',
}

export default function Ricette() {
  const { contenuto, errore, salva, elimina } = useContenuto()
  const { bozza, apri, chiudi, cambia, inCorso, esegui } = useBozza<Ricetta>()
  const [filtro, impostaFiltro] = useState('')
  const [momento, impostaMomento] = useState('')

  const ricette = cerca(contenuto?.ricette ?? [], filtro, (r) => r.nome + r.id)
    .filter((r) => !momento || r.momento === momento)
    .sort(perNome)
  const nomeCarrello = (id: string) => contenuto?.carrelli.find((c) => c.id === id)?.nome ?? id

  return (
    <>
      <Intestazione titolo="Ricette" sottotitolo={`${contenuto?.ricette.length ?? 0} ricette nel ricettario`}
        azione={<BottoneNuovo testo="Nuova ricetta" onClick={() => apri(VUOTA, true)} />} />
      <div className="barra">
        <Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca una ricetta" />
        <select className="select" style={{ width: 'auto' }} value={momento} onChange={(e) => impostaMomento(e.target.value)} aria-label="Momento">
          <option value="">Tutti i momenti</option>
          {Object.entries(MOMENTI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Stato caricamento={!contenuto} errore={errore} vuoto={ricette.length === 0}>
        <div className="elenco">
          {ricette.map((r) => (
            <div key={r.id} className="scheda cliccabile" onClick={() => apri(r)} role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && apri(r)}>
              <div className="principale">
                <div className="nome">{r.nome}</div>
                <div className="riga">
                  <span className="etichetta salvia">{MOMENTI[r.momento]}</span>
                  <span className="etichetta"><Clock size={12} /> {r.minutiPreparazione} min</span>
                  <span className="etichetta"><Users size={12} /> {r.porzioni}</span>
                  <span className="etichetta">{r.ingredienti.length} ingredienti</span>
                  {r.carrelli.map((c) => <span key={c} className="etichetta sabbia">{nomeCarrello(c)}</span>)}
                </div>
              </div>
              <span className="stampa tenue">{r.id}</span>
            </div>
          ))}
        </div>
      </Stato>

      {bozza && contenuto && (
        <Foglio titolo={bozza.nuovo ? 'Nuova ricetta' : bozza.valore.nome} onChiudi={chiudi}
          piede={<PiedeModifica inCorso={inCorso}
            onSalva={() => esegui(() => salva('ricette', bozza.valore, bozza.nuovo))}
            onElimina={bozza.nuovo ? undefined : () => esegui(() => elimina('ricette', bozza.valore.id))} />}>
          <div className="griglia-campi">
            <Campo etichetta="Nome">
              <input className="input" value={bozza.valore.nome} maxLength={120}
                onChange={(e) => cambia({ nome: e.target.value, ...(bozza.nuovo ? { id: slug(e.target.value) } : {}) })} />
            </Campo>
            <Campo etichetta="Id" aiuto={bozza.nuovo ? 'Non si cambia più dopo la creazione' : 'Fisso: lo citano i piatti della community'}>
              <input className="input stampa" value={bozza.valore.id} disabled={!bozza.nuovo} onChange={(e) => cambia({ id: e.target.value })} />
            </Campo>
          </div>
          <Campo etichetta="Descrizione">
            <textarea className="area" value={bozza.valore.descrizione} maxLength={1000} onChange={(e) => cambia({ descrizione: e.target.value })} />
          </Campo>
          <div className="griglia-campi">
            <Campo etichetta="Momento">
              <select className="select" value={bozza.valore.momento} onChange={(e) => cambia({ momento: e.target.value })}>
                {Object.entries(MOMENTI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo etichetta="Minuti">
              <input className="input" type="number" min="0" max="1440" value={bozza.valore.minutiPreparazione}
                onChange={(e) => cambia({ minutiPreparazione: e.target.valueAsNumber })} />
            </Campo>
            <Campo etichetta="Porzioni">
              <input className="input" type="number" min="1" max="50" value={bozza.valore.porzioni}
                onChange={(e) => cambia({ porzioni: e.target.valueAsNumber })} />
            </Campo>
          </div>
          <Campo etichetta="Immagine" aiuto="Indirizzo https dell’immagine, facoltativo">
            <input className="input" type="url" value={bozza.valore.immagine ?? ''} placeholder="https://…"
              onChange={(e) => cambia({ immagine: e.target.value || undefined })} />
          </Campo>
          <Pastiglie etichetta="Carrelli" opzioni={contenuto.carrelli.map((c) => [c.id, c.nome])} valori={bozza.valore.carrelli}
            onCambia={(carrelli) => cambia({ carrelli })} />
          <Pastiglie etichetta="Tag" opzioni={Object.entries(TAG)} valori={bozza.valore.tag} onCambia={(tag) => cambia({ tag })} />
          <Ingredienti righe={bozza.valore.ingredienti} onCambia={(ingredienti) => cambia({ ingredienti })} />
          <Passaggi righe={bozza.valore.passaggi} onCambia={(passaggi) => cambia({ passaggi })} />
        </Foglio>
      )}
    </>
  )
}

function Ingredienti({ righe, onCambia }: { righe: Ingrediente[]; onCambia: (r: Ingrediente[]) => void }) {
  const { contenuto } = useContenuto()
  const prodotti = [...contenuto!.prodotti].sort(perNome)
  const aggiorna = (i: number, modifica: Partial<Ingrediente>) =>
    onCambia(righe.map((r, n) => n === i ? { ...r, ...modifica } : r))

  return (
    <div className="campo">
      <Reparto>Ingredienti · {righe.length}</Reparto>
      <small>Collegato a un prodotto, l’ingrediente si ritrova nella lista della spesa.</small>
      <div className="righe">
        {righe.map((r, i) => (
          <div key={i} className="ingrediente">
            <select className="select" aria-label="Prodotto" value={r.prodottoID ?? ''}
              onChange={(e) => {
                const p = prodotti.find((x) => x.id === e.target.value)
                aggiorna(i, { prodottoID: p?.id, ...(p && !r.nome ? { nome: p.nome, unita: p.unita } : {}) })
              }}>
              <option value="">— scritto a mano —</option>
              {prodotti.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <input className="input" aria-label="Nome in ricetta" placeholder="Nome" value={r.nome} onChange={(e) => aggiorna(i, { nome: e.target.value })} />
            <input className="input" aria-label="Quantità" type="number" min="0" step="any" value={r.quantita}
              onChange={(e) => aggiorna(i, { quantita: e.target.valueAsNumber })} />
            <select className="select" aria-label="Unità" value={r.unita} onChange={(e) => aggiorna(i, { unita: e.target.value })}>
              {Object.entries(UNITA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="button" className="tondo piccolo pericolo" aria-label="Togli ingrediente"
              onClick={() => onCambia(righe.filter((_, n) => n !== i))}><X size={16} /></button>
          </div>
        ))}
      </div>
      <div>
        <button type="button" className="bottone secondario compatto"
          onClick={() => onCambia([...righe, { nome: '', quantita: 1, unita: 'pezzo' }])}><Plus size={16} />Ingrediente</button>
      </div>
    </div>
  )
}

function Passaggi({ righe, onCambia }: { righe: string[]; onCambia: (r: string[]) => void }) {
  const sposta = (i: number, verso: number) => {
    const copia = [...righe]
    ;[copia[i], copia[i + verso]] = [copia[i + verso], copia[i]]
    onCambia(copia)
  }
  return (
    <div className="campo">
      <Reparto>Procedimento · {righe.length} passaggi</Reparto>
      <div className="righe">
        {righe.map((p, i) => (
          <div key={i} className="riga-modifica">
            <span className="numero-passo">{i + 1}</span>
            <textarea className="area" style={{ minHeight: 64 }} aria-label={`Passaggio ${i + 1}`} value={p}
              onChange={(e) => onCambia(righe.map((r, n) => n === i ? e.target.value : r))} />
            <div style={{ display: 'grid', gap: 4 }}>
              <button type="button" className="tondo piccolo" aria-label="Sposta su" disabled={i === 0} onClick={() => sposta(i, -1)}><ArrowUp size={16} /></button>
              <button type="button" className="tondo piccolo" aria-label="Sposta giù" disabled={i === righe.length - 1} onClick={() => sposta(i, 1)}><ArrowDown size={16} /></button>
              <button type="button" className="tondo piccolo pericolo" aria-label="Togli passaggio" onClick={() => onCambia(righe.filter((_, n) => n !== i))}><X size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      <div>
        <button type="button" className="bottone secondario compatto" onClick={() => onCambia([...righe, ''])}><Plus size={16} />Passaggio</button>
      </div>
    </div>
  )
}
