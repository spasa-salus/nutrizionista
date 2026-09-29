import { useState } from 'react'
import { Flag, Heart, ImageUp, ShieldAlert } from 'lucide-react'
import { chiama } from '../api'
import { cerca, data, perNome } from '../dominio'
import { Campo, BottoneNuovo, Cerca, Foglio, Intestazione, PiedeModifica, Stato, useBozza, useContenuto, useElenco, useNotifica } from '../ui'
type Utente = { id: string; email: string; nome_utente: string | null }

type Piatto = {
  id: string; utente_id: string; autore: string | null; email: string | null
  ricetta_id: string; ricetta_nome: string; foto: string; fotoUrl: string; didascalia: string
  creato_il: string; mi_piace: number; segnalazioni: number
  moderazione: Moderazione; motivo_moderazione: string | null; deciso_da: 'ai' | 'admin' | null
}
type Bozza = {
  id?: string; utenteId: string; ricettaId: string; didascalia: string; foto?: string; anteprima?: string
  segnalazioni?: number; moderazione?: Moderazione
}
// Verdetto dell'auto-moderazione (moderazione.ts nella funzione admin). Solo "ok" e' visibile a tutti.
type Moderazione = 'ok' | 'nascosto' | 'da_rivedere' | 'in_attesa'
const TESTO_MODERAZIONE: Record<Exclude<Moderazione, 'ok'>, string> = {
  nascosto: "nascosto dall'AI", da_rivedere: 'da rivedere', in_attesa: 'in moderazione',
}

// Come l'app: tre segnalazioni nascondono il post a tutti tranne l'autore.
const SOGLIA_NASCOSTO = 3
const nascosto = (p: Piatto) => p.segnalazioni >= SOGLIA_NASCOSTO || p.moderazione !== 'ok'

/** Riduce la foto a JPEG sotto i 2 MB del bucket, lato lungo al massimo 1600 px. */
async function jpeg(file: File): Promise<{ base64: string; anteprima: string }> {
  const immagine = await createImageBitmap(file)
  const scala = Math.min(1, 1600 / Math.max(immagine.width, immagine.height))
  const tela = document.createElement('canvas')
  tela.width = Math.round(immagine.width * scala)
  tela.height = Math.round(immagine.height * scala)
  tela.getContext('2d')!.drawImage(immagine, 0, 0, tela.width, tela.height)
  let blob: Blob | null = null
  for (const qualita of [0.85, 0.75, 0.6, 0.45]) {
    blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', qualita))
    if (blob && blob.size < 1.9 * 1024 * 1024) break
  }
  if (!blob) throw new Error('Non riesco a leggere la foto')
  const url = await new Promise<string>((ok) => {
    const lettore = new FileReader()
    lettore.onload = () => ok(lettore.result as string)
    lettore.readAsDataURL(blob!)
  })
  return { base64: url.split(',')[1], anteprima: url }
}

// Inclinazione fissa per id, come le polaroid dell'app.
const inclinazione = (id: string) => ((parseInt(id.slice(0, 2), 16) % 7) - 3) * 0.6

export default function Piatti() {
  const { righe, errore, ricarica } = useElenco<Piatto>('piatti.elenco')
  const utenti = useElenco<Utente>('utenti.autori').righe
  const { contenuto } = useContenuto()
  const { bozza, apri, chiudi, cambia, inCorso, esegui } = useBozza<Bozza>()
  const [filtro, impostaFiltro] = useState('')
  const [soloSegnalati, impostaSoloSegnalati] = useState(false)
  const [soloDaRivedere, impostaSoloDaRivedere] = useState(false)
  const notifica = useNotifica()

  const piatti = cerca(righe ?? [], filtro, (p) => `${p.ricetta_nome} ${p.autore ?? ''} ${p.didascalia}`)
    .filter((p) => !soloSegnalati || p.segnalazioni > 0)
    .filter((p) => !soloDaRivedere || p.moderazione === 'nascosto' || p.moderazione === 'da_rivedere')
  const conProfilo = (utenti ?? []).filter((u) => u.nome_utente)
  const ricette = [...(contenuto?.ricette ?? [])].sort(perNome)

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

  async function scegliFoto(file: File | undefined) {
    if (!file) return
    try {
      const { base64, anteprima } = await jpeg(file)
      cambia({ foto: base64, anteprima })
    } catch (e) {
      notifica((e as Error).message, true)
    }
  }

  return (
    <>
      <Intestazione titolo="Post della community" sottotitolo={righe ? `${righe.length} ${righe.length === 1 ? 'piatto pubblicato' : 'piatti pubblicati'}` : undefined}
        azione={<BottoneNuovo testo="Nuovo post" onClick={() => apri({ utenteId: conProfilo[0]?.id ?? '', ricettaId: ricette[0]?.id ?? '', didascalia: '' }, true)} />} />
      <div className="barra">
        <Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca per ricetta, autore o testo" />
        <button className="pastiglia" aria-pressed={soloSegnalati} onClick={() => impostaSoloSegnalati(!soloSegnalati)}>
          <Flag size={14} /> Solo segnalati
        </button>
        <button className="pastiglia" aria-pressed={soloDaRivedere} onClick={() => impostaSoloDaRivedere(!soloDaRivedere)}>
          <ShieldAlert size={14} /> Fermati dall'AI
        </button>
      </div>
      <Stato caricamento={!righe} errore={errore} vuoto={piatti.length === 0}>
        <div className="polaroid-griglia">
          {piatti.map((p) => (
            <article key={p.id} className={`polaroid${nascosto(p) ? ' nascosto' : ''}`}
              style={{ transform: `rotate(${inclinazione(p.id)}deg)` }} tabIndex={0} role="button"
              onClick={() => apri({ id: p.id, utenteId: p.utente_id, ricettaId: p.ricetta_id, didascalia: p.didascalia, anteprima: p.fotoUrl, segnalazioni: p.segnalazioni, moderazione: p.moderazione })}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLElement).click()}>
              <img src={p.fotoUrl} alt={p.ricetta_nome} loading="lazy" />
              <div className="didascalia">{p.ricetta_nome}</div>
              {p.didascalia && <div className="tenue piccolo">{p.didascalia}</div>}
              <div className="riga">
                <span className="etichetta salvia">@{p.autore ?? '—'}</span>
                <span className="etichetta"><Heart size={12} /> {p.mi_piace}</span>
                {p.moderazione !== 'ok' && (
                  <span className={`etichetta ${p.moderazione === 'in_attesa' ? '' : 'pomodoro'}`} title={p.motivo_moderazione ?? undefined}>
                    <ShieldAlert size={12} /> {TESTO_MODERAZIONE[p.moderazione]}{p.motivo_moderazione ? ` · ${p.motivo_moderazione}` : ''}
                  </span>
                )}
                {p.segnalazioni > 0 && <span className="etichetta pomodoro"><Flag size={12} /> {p.segnalazioni}{p.segnalazioni >= SOGLIA_NASCOSTO ? ' · nascosto' : ''}</span>}
              </div>
              <div className="tenue piccolo" style={{ marginTop: 6 }}>{data(p.creato_il)}</div>
            </article>
          ))}
        </div>
      </Stato>

      {bozza && (
        <Foglio titolo={bozza.nuovo ? 'Nuovo post' : 'Modifica post'} onChiudi={chiudi}
          piede={<>
            {!bozza.nuovo && ((bozza.valore.segnalazioni ?? 0) > 0 || bozza.valore.moderazione !== 'ok') && (
              <button className="bottone secondario" disabled={inCorso}
                onClick={() => azione('piatti.ripristina', { id: bozza.valore.id }, 'Post approvato e visibile a tutti')}>
                Approva e mostra a tutti
              </button>
            )}
            <PiedeModifica inCorso={inCorso}
              testoSalva="Salva"
              onSalva={() => {
                if (bozza.nuovo && !bozza.valore.foto) return notifica('Scegli una foto', true)
                const { anteprima: _, segnalazioni: __, moderazione: ___, ...dati } = bozza.valore
                azione('piatti.salva', dati, 'Post salvato')
              }}
              onElimina={bozza.nuovo ? undefined : () => azione('piatti.elimina', { id: bozza.valore.id }, 'Post eliminato')} />
          </>}>
          {bozza.valore.anteprima && <img className="anteprima-foto" src={bozza.valore.anteprima} alt="Anteprima" />}
          <label className="bottone secondario" style={{ justifySelf: 'start' }}>
            <ImageUp size={18} /> {bozza.valore.anteprima ? 'Cambia foto' : 'Scegli foto'}
            <input type="file" accept="image/*" hidden onChange={(e) => scegliFoto(e.target.files?.[0])} />
          </label>
          {bozza.nuovo ? (
            <Campo etichetta="Autore" aiuto="Solo utenti con un nome utente della community">
              <select className="select" value={bozza.valore.utenteId} onChange={(e) => cambia({ utenteId: e.target.value })}>
                {conProfilo.map((u) => <option key={u.id} value={u.id}>@{u.nome_utente} · {u.email}</option>)}
              </select>
            </Campo>
          ) : (
            <p className="tenue" style={{ margin: 0 }}>Di @{righe?.find((p) => p.id === bozza.valore.id)?.autore ?? '—'}</p>
          )}
          <Campo etichetta="Ricetta">
            <select className="select" value={bozza.valore.ricettaId} onChange={(e) => cambia({ ricettaId: e.target.value })}>
              {ricette.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </Campo>
          <Campo etichetta="Descrizione">
            <textarea className="area" maxLength={300} value={bozza.valore.didascalia} onChange={(e) => cambia({ didascalia: e.target.value })} />
          </Campo>
        </Foglio>
      )}
    </>
  )
}
