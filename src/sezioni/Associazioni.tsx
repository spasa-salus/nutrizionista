import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { chiama } from '../api'
import { CATEGORIE, cerca, data } from '../dominio'
import { Cerca, Intestazione, Stato, useNotifica } from '../ui'

// Associazione fra gli articoli di un supermercato e i prodotti NutriQuore (funzione admin,
// associazione.ts). L'AI propone in batch, per ogni prodotto, gli articoli che lo sono; qui si
// sceglie quali tenere. Piu' articoli per lo stesso prodotto sono le alternative dell'algoritmo:
// sceglie lui il migliore per scadenza, giacenza e offerta, e passa a un altro se uno finisce.

type PuntoVendita = { id: string; nome: string; articoli: number; importato_il: string }
type ArticoloVista = { id: string; nome: string; prezzo: number | null; collegato: boolean; altrove: string | null; daAI: boolean }
type ProdottoVista = { id: string; nome: string; categoria: string; articoli: ArticoloVista[] }
type Lavoro = { stato: 'in_corso' | 'concluso' | 'fallito'; creatoIl: string; conclusoIl: string | null; errore: string | null }
type Dati = { lavoro: Lavoro | null; daAnalizzare: number; prodotti: ProdottoVista[] }

export default function Associazioni() {
  const [punti, impostaPunti] = useState<PuntoVendita[] | null>(null)
  const [pv, impostaPv] = useState('')
  const [dati, impostaDati] = useState<Dati | null>(null)
  const [errore, impostaErrore] = useState<string | null>(null)
  const [filtro, impostaFiltro] = useState('')
  const [soloDaGuardare, impostaSoloDaGuardare] = useState(true)
  const [inCorso, impostaInCorso] = useState(false)
  const notifica = useNotifica()

  useEffect(() => {
    chiama<PuntoVendita[]>('associazioni.puntiVendita').then((r) => {
      impostaPunti(r)
      if (r[0]) impostaPv(r[0].id)
    }, (e) => impostaErrore(e.message))
  }, [])

  const ricarica = () => pv && chiama<Dati>('associazioni.leggi', { puntoVenditaId: pv }).then(impostaDati, (e) => impostaErrore(e.message))
  useEffect(() => { impostaDati(null); ricarica() }, [pv])
  // Mentre l'AI lavora si ricontrolla ogni minuto: il batch torna da solo.
  const aperto = dati?.lavoro?.stato === 'in_corso'
  useEffect(() => {
    if (!aperto) return
    const t = setInterval(ricarica, 60_000)
    return () => clearInterval(t)
  }, [aperto, pv])

  async function avvia() {
    impostaInCorso(true)
    try {
      const r = await chiama<{ inviati: number }>('associazioni.avvia', { puntoVenditaId: pv })
      notifica(r.inviati ? `${r.inviati} articoli mandati all'AI: le proposte arrivano di solito in pochi minuti` : 'Nessun articolo nuovo da mandare all\'AI')
      ricarica()
    } catch (e) {
      notifica((e as Error).message, true)
    } finally {
      impostaInCorso(false)
    }
  }

  const nomeProdotto = (id: string) => dati?.prodotti.find((p) => p.id === id)?.nome ?? id
  // Da guardare: c'e' almeno una proposta dell'AI non ancora collegata.
  const daGuardare = (p: ProdottoVista) => p.articoli.some((a) => a.daAI && !a.collegato)
  const prodotti = cerca(dati?.prodotti ?? [], filtro, (p) => `${p.nome} ${p.articoli.map((a) => a.nome).join(' ')}`)
    .filter((p) => p.articoli.length && (!soloDaGuardare || daGuardare(p)))

  return (
    <>
      <Intestazione titolo="Associazioni" sottotitolo="Quali articoli di ogni supermercato sono i prodotti NutriQuore"
        azione={
          <button className="bottone" onClick={avvia} disabled={!pv || inCorso || aperto}>
            <Sparkles size={16} aria-hidden /> {aperto ? 'L\'AI sta lavorando…' : 'Cerca con l\'AI'}
          </button>
        } />
      <div className="barra">
        <select className="select" style={{ width: 'auto' }} value={pv} onChange={(e) => impostaPv(e.target.value)} aria-label="Punto vendita">
          {(punti ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.articoli} articoli</option>)}
        </select>
        <Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca un prodotto o un articolo" />
        <button className="pastiglia" aria-pressed={soloDaGuardare} onClick={() => impostaSoloDaGuardare(!soloDaGuardare)}>
          Solo proposte da guardare
        </button>
      </div>
      {dati && (
        <p className="tenue piccolo">
          {dati.lavoro?.stato === 'in_corso' && `L'AI sta lavorando dal ${data(dati.lavoro.creatoIl)}: la pagina si aggiorna da sola. `}
          {dati.lavoro?.stato === 'concluso' && `Ultime proposte: ${data(dati.lavoro.conclusoIl)}. `}
          {dati.lavoro?.stato === 'fallito' && `L'ultima richiesta non è andata: ${dati.lavoro.errore ?? 'errore di OpenAI'}. `}
          {dati.daAnalizzare > 0 ? `${dati.daAnalizzare} articoli non ancora visti dall'AI.` : 'L\'AI ha già visto tutti gli articoli.'}
        </p>
      )}
      <Stato caricamento={!errore && (!punti || (!!pv && !dati))} errore={errore} vuoto={!!dati && prodotti.length === 0}>
        <div className="elenco">
          {prodotti.map((p) => <SchedaProdotto key={`${pv}-${p.id}`} pv={pv} prodotto={p} nomeProdotto={nomeProdotto} onSalvato={ricarica} />)}
        </div>
      </Stato>
    </>
  )
}

function SchedaProdotto({ pv, prodotto, nomeProdotto, onSalvato }: {
  pv: string; prodotto: ProdottoVista; nomeProdotto: (id: string) => string; onSalvato: () => void
}) {
  const iniziali = () => new Set(prodotto.articoli.filter((a) => a.collegato).map((a) => a.id))
  const [scelti, impostaScelti] = useState(iniziali)
  const [inCorso, impostaInCorso] = useState(false)
  const notifica = useNotifica()
  useEffect(() => impostaScelti(iniziali()), [prodotto])
  const cambiato = prodotto.articoli.some((a) => a.collegato !== scelti.has(a.id))

  const alterna = (id: string) => impostaScelti((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  async function salva() {
    impostaInCorso(true)
    try {
      await chiama('associazioni.salva', { puntoVenditaId: pv, prodottoId: prodotto.id, articoli: [...scelti] })
      notifica(`${prodotto.nome}: ${scelti.size} ${scelti.size === 1 ? 'articolo collegato' : 'articoli collegati'}`)
      onSalvato()
    } catch (e) {
      notifica((e as Error).message, true)
    } finally {
      impostaInCorso(false)
    }
  }

  return (
    <div className="scheda">
      <div className="principale">
        <div className="nome">{prodotto.nome}<span className="tenue piccolo"> · {CATEGORIE[prodotto.categoria] ?? prodotto.categoria}</span></div>
        {prodotto.articoli.map((a, i) => (
          <label key={a.id} className="riga" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={scelti.has(a.id)} onChange={() => alterna(a.id)} />
            <span>{a.nome}</span>
            {a.prezzo != null && <span className="tenue piccolo">€ {a.prezzo.toFixed(2)}</span>}
            {a.daAI && <span className="etichetta salvia">AI #{i + 1}</span>}
            {a.collegato && <span className="etichetta">collegato</span>}
            {a.altrove && <span className="etichetta sabbia">ora è {nomeProdotto(a.altrove)}</span>}
          </label>
        ))}
        {cambiato && (
          <div className="riga">
            <button className="bottone" disabled={inCorso} onClick={salva}>{inCorso ? 'Salvo…' : 'Salva la scelta'}</button>
            <span className="tenue piccolo">Gli articoli non spuntati che oggi sono collegati qui escono da questo prodotto.</span>
          </div>
        )}
      </div>
    </div>
  )
}
