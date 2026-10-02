import { useState } from 'react'
import { chiama } from '../api'
import { cerca, data } from '../dominio'
import { BottoneElimina, Cerca, Intestazione, Stato, useElenco, useNotifica } from '../ui'

// Le domande le scrivono solo gli utenti dall'app: qui si leggono e, se serve, si eliminano.
type Domanda = { id: string; utente_id: string; testo: string; creata_il: string; email: string | null; nome_utente: string | null }

export default function Domande() {
  const { righe, errore, ricarica } = useElenco<Domanda>('domande.elenco')
  const [filtro, impostaFiltro] = useState('')
  const [inCorso, impostaInCorso] = useState(false)
  const notifica = useNotifica()

  const domande = cerca(righe ?? [], filtro, (d) => `${d.testo} ${d.email ?? ''} ${d.nome_utente ?? ''}`)

  async function elimina(id: string) {
    impostaInCorso(true)
    try {
      await chiama('domande.elimina', { id })
      notifica('Domanda eliminata')
      ricarica()
    } catch (e) {
      notifica((e as Error).message, true)
    } finally {
      impostaInCorso(false)
    }
  }

  return (
    <>
      <Intestazione titolo="Domande Q&A" sottotitolo="Le domande per la live mensile della nutrizionista, dalla più recente." />
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
                <BottoneElimina disabilitato={inCorso} onConferma={() => elimina(d.id)} />
              </div>
            </article>
          ))}
        </div>
      </Stato>
    </>
  )
}
