import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Clock, Plus, Sparkles, Users, X } from 'lucide-react'
import { chiama } from '../api'
import { cerca, data, type Ingrediente, MOMENTI, perNome, type Ricetta, slug, TAG, UNITA } from '../dominio'
import { BottoneNuovo, Campo, Cerca, Foglio, Intestazione, Pastiglie, PiedeModifica, Reparto, Stato, useBozza, useContenuto, useNotifica } from '../ui'

const VUOTA: Ricetta = {
  id: '', nome: '', descrizione: '', ingredienti: [], carrelli: [], tag: [],
  minutiPreparazione: 20, porzioni: 2, passaggi: [], momento: 'pranzo',
}

// Proposta dell'AI sui carrelli di una ricetta (funzione admin, ricette_ai.ts): solo quelle che
// cambiano qualcosa. Sposta l'ordine della griglia di un carrello, non chi puo' mangiare cosa.
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
      piede={<button className="bottone" disabled={inCorso || !scelte.size} onClick={applica}>
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

export default function Ricette() {
  const { contenuto, errore, salva, elimina } = useContenuto()
  const [revisioneAI, impostaRevisioneAI] = useState(false)
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
        azione={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="bottone secondario" onClick={() => impostaRevisioneAI(true)}>
            <Sparkles size={16} aria-hidden /> Carrelli con l'AI
          </button>
          <BottoneNuovo testo="Nuova ricetta" onClick={() => apri(VUOTA, true)} />
        </span>} />
      {revisioneAI && <RevisioneAI onChiudi={() => impostaRevisioneAI(false)} />}
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
