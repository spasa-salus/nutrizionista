import { useState } from 'react'
import { Store } from 'lucide-react'
import { cerca, perNome, slug, type Supermercato } from '../dominio'
import { BottoneNuovo, Campo, Cerca, Foglio, Intestazione, PiedeModifica, Stato, useBozza, useContenuto } from '../ui'

const VUOTO: Supermercato = { id: '', nome: '' }

export default function Supermercati() {
  const { contenuto, errore, salva, elimina } = useContenuto()
  const { bozza, apri, chiudi, cambia, inCorso, esegui } = useBozza<Supermercato>()
  const [filtro, impostaFiltro] = useState('')

  const supermercati = cerca(contenuto?.supermercati ?? [], filtro, (s) => s.nome + s.id).sort(perNome)
  const prodottiIn = (id: string) => contenuto?.prodotti.filter((p) => p.supermercati.includes(id)).length ?? 0
  const numero = (v: string) => v === '' ? undefined : Number(v)

  return (
    <>
      <Intestazione titolo="Supermercati" sottotitolo="Le catene che vendono i prodotti del catalogo."
        azione={<BottoneNuovo testo="Nuovo supermercato" onClick={() => apri(VUOTO, true)} />} />
      <div className="barra"><Cerca valore={filtro} onCambia={impostaFiltro} segnaposto="Cerca un supermercato" /></div>
      <Stato caricamento={!contenuto} errore={errore} vuoto={supermercati.length === 0}>
        <div className="elenco">
          {supermercati.map((s) => (
            <div key={s.id} className="scheda cliccabile" onClick={() => apri(s)} role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && apri(s)}>
              <div className="simbolo">
                {s.logo ? <img src={s.logo} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} /> : <Store size={22} aria-hidden />}
              </div>
              <div className="principale">
                <div className="nome">{s.nome}</div>
                <div className="riga">
                  <span className="etichetta salvia">{prodottiIn(s.id)} prodotti</span>
                  {s.latitudine != null && <span className="etichetta">{s.latitudine}, {s.longitudine}</span>}
                </div>
              </div>
              <span className="stampa tenue">{s.id}</span>
            </div>
          ))}
        </div>
      </Stato>

      {bozza && (
        <Foglio stretto titolo={bozza.nuovo ? 'Nuovo supermercato' : bozza.valore.nome} onChiudi={chiudi}
          piede={<PiedeModifica inCorso={inCorso}
            onSalva={() => esegui(() => salva('supermercati', bozza.valore, bozza.nuovo))}
            onElimina={bozza.nuovo ? undefined : () => esegui(() => elimina('supermercati', bozza.valore.id))} />}>
          <Campo etichetta="Nome">
            <input className="input" value={bozza.valore.nome} maxLength={80}
              onChange={(e) => cambia({ nome: e.target.value, ...(bozza.nuovo ? { id: slug(e.target.value) } : {}) })} />
          </Campo>
          <Campo etichetta="Id" aiuto={bozza.nuovo ? 'Non si cambia più dopo la creazione' : 'Fisso: lo citano i prodotti'}>
            <input className="input stampa" value={bozza.valore.id} disabled={!bozza.nuovo} onChange={(e) => cambia({ id: e.target.value })} />
          </Campo>
          <Campo etichetta="Logo" aiuto="Indirizzo dell’immagine, facoltativo">
            <input className="input" value={bozza.valore.logo ?? ''} onChange={(e) => cambia({ logo: e.target.value || undefined })} />
          </Campo>
          <div className="griglia-campi">
            <Campo etichetta="Latitudine">
              <input className="input" type="number" step="any" min="-90" max="90" value={bozza.valore.latitudine ?? ''}
                onChange={(e) => cambia({ latitudine: numero(e.target.value) })} />
            </Campo>
            <Campo etichetta="Longitudine">
              <input className="input" type="number" step="any" min="-180" max="180" value={bozza.valore.longitudine ?? ''}
                onChange={(e) => cambia({ longitudine: numero(e.target.value) })} />
            </Campo>
          </div>
          {!bozza.nuovo && prodottiIn(bozza.valore.id) > 0 && (
            <p className="tenue piccolo" style={{ margin: 0 }}>
              Eliminandolo sparisce dai {prodottiIn(bozza.valore.id)} prodotti che lo citano.
            </p>
          )}
        </Foglio>
      )}
    </>
  )
}
