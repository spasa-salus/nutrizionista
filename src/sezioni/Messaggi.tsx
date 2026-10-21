import { useEffect, useState } from 'react'
import { Building2, Mail, MailOpen, Reply, User } from 'lucide-react'
import { chiama } from '../api'
import { cerca, data } from '../dominio'
import { BottoneElimina, Campo, Cerca, Foglio, Intestazione, Stato, useElenco, useNotifica } from '../ui'

// I messaggi del modulo «Vuoi saperne di più?» della landing. Li salva la funzione `contatti`,
// che li inoltra anche a info@nutriquore.it: qui si leggono, si risponde dal proprio programma di
// posta e si eliminano. «Letto» vale per tutti e due i pannelli (admin e nutrizionista).
export type Messaggio = {
  id: string; email: string; tipo: 'privato' | 'azienda'; oggetto: string; messaggio: string; creato_il: string
  inoltrato: boolean; errore_inoltro: string | null; letto_il: string | null; letto_da: 'admin' | 'nutrizionista' | null
}

const TIPI = { privato: { nome: 'Privato', icona: User }, azienda: { nome: 'Azienda', icona: Building2 } }
const FILTRI = [['tutti', 'Tutti'], ['privato', 'Privati'], ['azienda', 'Aziende']] as const

const rispondi = (m: Messaggio) => `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.oggetto}`)}`

export default function Messaggi() {
  const { righe, errore, ricarica } = useElenco<Messaggio>('contatti.elenco')
  const [filtro, impostaFiltro] = useState('')
  const [tipo, impostaTipo] = useState<(typeof FILTRI)[number][0]>('tutti')
  const [soloDaLeggere, impostaSoloDaLeggere] = useState(false)
  const [aperto, apri] = useState<Messaggio | null>(null)
  const [inCorso, impostaInCorso] = useState(false)
  const notifica = useNotifica()

  const daLeggere = (righe ?? []).filter((m) => !m.letto_il).length
  const messaggi = cerca(
    (righe ?? []).filter((m) => (tipo === 'tutti' || m.tipo === tipo) && (!soloDaLeggere || !m.letto_il)),
    filtro, (m) => `${m.email} ${m.oggetto} ${m.messaggio}`)

  // Aprirlo è leggerlo. Nell'elenco cambia subito, il server si allinea dietro.
  useEffect(() => {
    if (!aperto || aperto.letto_il) return
    chiama('contatti.letto', { id: aperto.id }).then(ricarica, () => {})
  }, [aperto, ricarica])

  async function esegui(azione: string, id: string, fatto: string, parametri: object = {}) {
    impostaInCorso(true)
    try {
      await chiama(azione, { id, ...parametri })
      notifica(fatto)
      apri(null)
      ricarica()
    } catch (e) {
      notifica((e as Error).message, true)
    } finally {
      impostaInCorso(false)
    }
  }

  return (
    <>
      <Intestazione titolo="Messaggi dal sito"
        sottotitolo={righe ? `${daLeggere} da leggere · dal modulo «Vuoi saperne di più?», arrivano anche a info@nutriquore.it` : undefined} />
      <div className="barra">
        <Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca per email, oggetto o testo" />
        {FILTRI.map(([id, nome]) => (
          <button key={id} className="pastiglia" aria-pressed={tipo === id} onClick={() => impostaTipo(id)}>{nome}</button>
        ))}
        <button className="pastiglia" aria-pressed={soloDaLeggere} onClick={() => impostaSoloDaLeggere(!soloDaLeggere)}>Solo da leggere</button>
      </div>
      <Stato caricamento={!righe} errore={errore} vuoto={messaggi.length === 0}>
        <div className="elenco">
          {messaggi.map((m) => {
            const Icona = TIPI[m.tipo].icona
            return (
              <div key={m.id} className={`scheda cliccabile messaggio${m.letto_il ? '' : ' da-leggere'}`} role="button" tabIndex={0}
                onClick={() => apri(m)} onKeyDown={(e) => e.key === 'Enter' && apri(m)}>
                <div className="simbolo"><Icona size={22} aria-hidden /></div>
                <div className="principale">
                  <div className="nome">{m.oggetto}</div>
                  <div className="riga">
                    {!m.letto_il && <span className="etichetta pomodoro"><Mail size={12} aria-hidden />da leggere</span>}
                    <span className="etichetta salvia">{TIPI[m.tipo].nome}</span>
                    {!m.inoltrato && <span className="etichetta sabbia">non arrivato a info@</span>}
                    <span className="tenue piccolo">{m.email} · {data(m.creato_il)}</span>
                  </div>
                  <div className="tenue piccolo anteprima">{m.messaggio}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Stato>

      {aperto && (
        <Foglio titolo={aperto.oggetto} onChiudi={() => apri(null)}
          piede={<>
            <BottoneElimina disabilitato={inCorso} onConferma={() => esegui('contatti.elimina', aperto.id, 'Messaggio eliminato')} />
            <span className="spazio" />
            <button className="bottone secondario" disabled={inCorso}
              onClick={() => esegui('contatti.letto', aperto.id, 'Segnato da leggere', { letto: false })}>
              <Mail size={18} aria-hidden />Da leggere
            </button>
            <a className="bottone principale" href={rispondi(aperto)}><Reply size={18} aria-hidden />Rispondi</a>
          </>}>
          <Campo etichetta="Da">
            <div>
              <a className="link-messaggio" href={rispondi(aperto)}>{aperto.email}</a>
              <div className="tenue piccolo">{TIPI[aperto.tipo].nome} · ricevuto {data(aperto.creato_il)}</div>
            </div>
          </Campo>
          <Campo etichetta="Messaggio">
            <div className="testo-messaggio">{aperto.messaggio}</div>
          </Campo>
          {aperto.inoltrato
            ? <div className="tenue piccolo"><MailOpen size={14} aria-hidden /> Inoltrato a info@nutriquore.it{aperto.letto_da && aperto.letto_il
              ? ` · letto ${aperto.letto_da === 'admin' ? 'dall’admin' : 'dalla nutrizionista'} il ${data(aperto.letto_il)}` : ''}</div>
            : <div className="avviso errore">L’email a info@nutriquore.it non è partita: il messaggio c’è solo qui. Rispondi da questo pannello.
              {aperto.errore_inoltro && <div className="tenue piccolo">{aperto.errore_inoltro}</div>}</div>}
        </Foglio>
      )}
    </>
  )
}
