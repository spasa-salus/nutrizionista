import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { chiama } from '../api'
import { cerca, data } from '../dominio'
import { BottoneNuovo, Campo, Cerca, Foglio, Intestazione, PiedeModifica, Stato, useBozza, useElenco, useNotifica } from '../ui'
type Utente = { id: string; email: string; nome_utente: string | null }

type Domanda = { id: string; utente_id: string; testo: string; creata_il: string; email: string | null; nome_utente: string | null }
type Bozza = { id?: string; utenteId: string; testo: string }

export default function Domande() {
  const { righe, errore, ricarica } = useElenco<Domanda>('domande.elenco')
  const utenti = useElenco<Utente>('utenti.autori').righe ?? []
  const { bozza, apri, chiudi, cambia, inCorso, esegui } = useBozza<Bozza>()
  const [filtro, impostaFiltro] = useState('')
  const notifica = useNotifica()

  const domande = cerca(righe ?? [], filtro, (d) => `${d.testo} ${d.email ?? ''} ${d.nome_utente ?? ''}`)

  const azione = (nome: string, parametri: object, messaggio: string) => esegui(async () => {
    try {
      await chiama(nome, parametri)
      notifica(messaggio)
      ricarica()
      return true
    } catch (e) {
      notifica((e as Error).message, true)
      return false
    }
  })

  return (
    <>
      <Intestazione titolo="Domande Q&A" sottotitolo="Le domande per la live mensile della nutrizionista, dalla più recente."
        azione={<BottoneNuovo testo="Nuova domanda" onClick={() => apri({ utenteId: utenti[0]?.id ?? '', testo: '' }, true)} />} />
      <div className="barra"><Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca nel testo o per autore" /></div>
      <Stato caricamento={!righe} errore={errore} vuoto={domande.length === 0}>
        <div className="elenco">
          {domande.map((d) => (
            <article key={d.id} className="foglio-quaderno">
              <div className="testo">{d.testo}</div>
              <div className="firma">
                <span>{d.nome_utente ? `@${d.nome_utente}` : d.email ?? 'utente eliminato'}</span>
                <span>·</span>
                <span>{data(d.creata_il)}</span>
              </div>
              <div className="azioni">
                <button className="tondo piccolo" aria-label="Modifica domanda"
                  onClick={() => apri({ id: d.id, utenteId: d.utente_id, testo: d.testo })}><Pencil size={15} /></button>
              </div>
            </article>
          ))}
        </div>
      </Stato>

      {bozza && (
        <Foglio stretto titolo={bozza.nuovo ? 'Nuova domanda' : 'Modifica domanda'} onChiudi={chiudi}
          piede={<PiedeModifica inCorso={inCorso} testoSalva="Salva"
            onSalva={() => azione('domande.salva', bozza.valore, 'Domanda salvata')}
            onElimina={bozza.nuovo ? undefined : () => azione('domande.elimina', { id: bozza.valore.id }, 'Domanda eliminata')} />}>
          {bozza.nuovo && (
            <Campo etichetta="A nome di">
              <select className="select" value={bozza.valore.utenteId} onChange={(e) => cambia({ utenteId: e.target.value })}>
                {utenti.map((u) => <option key={u.id} value={u.id}>{u.nome_utente ? `@${u.nome_utente} · ` : ''}{u.email}</option>)}
              </select>
            </Campo>
          )}
          <Campo etichetta={`Domanda · ${bozza.valore.testo.trim().length}/500`} aiuto="Almeno 10 caratteri">
            <textarea className="area" style={{ minHeight: 140 }} maxLength={500} value={bozza.valore.testo}
              onChange={(e) => cambia({ testo: e.target.value })} />
          </Campo>
        </Foglio>
      )}
    </>
  )
}
