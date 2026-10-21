// Forme e nomi del contenuto come in Entita.swift ed Enumerazioni.swift dell'app iOS.

export type Supermercato = { id: string; nome: string; logo?: string; latitudine?: number; longitudine?: number }
export type Prodotto = {
  id: string; nome: string; categoria: string; tag: string[]; supermercati: string[]
  unita: string; quantitaBase: number; rilevanza: number
}
export type Ingrediente = { prodottoID?: string; nome: string; quantita: number; unita: string }
/** `tag` lo ricalcola il server dagli ingredienti (esigenzeDellaRicetta): qui si legge e basta. */
export type Ricetta = {
  id: string; nome: string; descrizione: string; ingredienti: Ingrediente[]; carrelli: string[]
  tag: string[]; minutiPreparazione: number; porzioni: number; passaggi: string[]; momento: string
  /** Quelli che servono; [] = bastano i fornelli. Assente nelle ricette di prima: va indicato salvando. */
  elettrodomestici?: string[]
}
/** Le ricette di un carrello non stanno qui ma in Ricetta.carrelli, come le legge l'app. */
export type Carrello = { id: string; nome: string; descrizione: string; simbolo: string; moltiplicatorePorzione: number }
export type Contenuto = {
  revisione: number
  supermercati: Supermercato[]; prodotti: Prodotto[]; ricette: Ricetta[]; carrelli: Carrello[]
}
export type TipoContenuto = 'supermercati' | 'prodotti' | 'ricette' | 'carrelli'

export const CATEGORIE: Record<string, string> = {
  fruttaVerdura: 'Frutta e verdura', proteine: 'Carne, pesce e uova', latticini: 'Latticini',
  cereali: 'Pasta, pane e cereali', colazione: 'Colazione', dispensa: 'Dispensa',
  surgelati: 'Surgelati', condimenti: 'Condimenti', bevande: 'Bevande',
}
export const UNITA: Record<string, string> = {
  pezzo: 'pezzi', grammo: 'g', chilogrammo: 'kg', millilitro: 'ml', litro: 'l', confezione: 'confezioni',
}
export const TAG: Record<string, string> = {
  vegano: 'Vegano', vegetariano: 'Vegetariano', senzaGlutine: 'Senza glutine', senzaLattosio: 'Senza lattosio',
  proteico: 'Proteico', leggero: 'Leggero', adattoBambini: 'Adatto ai bambini', veloce: 'Veloce',
}
export const ESIGENZE = ['vegano', 'vegetariano', 'senzaGlutine', 'senzaLattosio']
/** Come Elettrodomestico in Cucina.swift; il file e' quello delle figure in public/cucina. */
export const ELETTRODOMESTICI: { id: string; nome: string; file: string }[] = [
  { id: 'forno', nome: 'Forno', file: 'forno' },
  { id: 'microonde', nome: 'Microonde', file: 'microonde' },
  { id: 'friggitriceAdAria', nome: 'Friggitrice ad aria', file: 'friggitrice-ad-aria' },
  { id: 'tostapane', nome: 'Tostapane', file: 'tostapane' },
  { id: 'frullatore', nome: 'Frullatore', file: 'frullatore' },
  { id: 'fruste', nome: 'Fruste elettriche', file: 'fruste' },
]

/**
 * Gli elettrodomestici che i passaggi nominano, con le stesse regole di Passaggio.chiede nelle
 * app (Cucina.swift): parole intere senza accenti, «carta da forno» non e' il forno, «tosta il
 * riso» non e' il tostapane. Serve a proporli: quelli veri li sceglie chi scrive la ricetta.
 */
export function elettrodomesticiDaiPassaggi(passaggi: string[]): string[] {
  const chiesti = new Set<string>()
  for (const testo of passaggi) {
    const p = testo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    const segue = (i: number, ...attese: string[]) => i + attese.length <= p.length && attese.every((a, k) => p[i + k] === a)
    const precede = (i: number, ...attese: string[]) => i >= attese.length && attese.every((a, k) => p[i - attese.length + k] === a)
    let tosta = false
    let pane = false
    p.forEach((parola, i) => {
      if (parola === 'forno') {
        if (precede(i, 'carta', 'da')) return
        chiesti.add(segue(i + 1, 'microonde') || segue(i + 1, 'a', 'microonde') ? 'microonde' : 'forno')
      } else if (parola === 'microonde' || parola === 'tostapane') {
        chiesti.add(parola)
      } else if (parola === 'pane' || parola === 'fette' || parola === 'fetta') {
        pane = true
      } else if (['monta', 'montali', 'montalo', 'montale', 'montare', 'montate', 'montati', 'montato', 'fruste', 'sbattitore'].includes(parola)
        || (parola === 'neve' && precede(i, 'a'))) {
        chiesti.add('fruste')
      } else if (parola.startsWith('inforn') || parola.startsWith('sforn')) {
        chiesti.add('forno')
      } else if (parola.startsWith('frull')) {
        chiesti.add('frullatore')
      } else if (parola.startsWith('friggitric')) {
        chiesti.add('friggitriceAdAria')
      } else if (parola.startsWith('tost')) {
        tosta = true
      }
    })
    if (tosta && pane) chiesti.add('tostapane')
  }
  return ELETTRODOMESTICI.map((e) => e.id).filter((id) => chiesti.has(id))
}
export const MOMENTI: Record<string, string> = { colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena' }

/** "Pasta al pomodoro" -> "pasta-al-pomodoro", come gli id del bundle. */
export function slug(testo: string) {
  return testo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}

/**
 * Per ogni esigenza, se la ricetta la rispetta e, se no, perche': come Ricettario.tagEffettivi
 * nelle app, conta il prodotto collegato a ogni ingrediente, non quello che dice la ricetta.
 */
export function esigenzeDellaRicetta(ingredienti: Ingrediente[], prodotti: Prodotto[]): Record<string, string | null> {
  const perId = new Map(prodotti.map((p) => [p.id, p]))
  const elenco = (nomi: string[]) => nomi.length <= 2 ? nomi.join(' e ') : `${nomi.slice(0, 2).join(', ')} e altri ${nomi.length - 2}`
  const scollegati = ingredienti.filter((i) => !i.prodottoID || !perId.has(i.prodottoID)).map((i) => i.nome.trim() || 'un ingrediente')
  return Object.fromEntries(ESIGENZE.map((t) => {
    if (!ingredienti.length) return [t, 'servono gli ingredienti']
    if (scollegati.length) return [t, `${elenco(scollegati)} non ${scollegati.length === 1 ? 'è collegato' : 'sono collegati'} al catalogo`]
    const no = ingredienti.filter((i) => !perId.get(i.prodottoID!)!.tag.includes(t)).map((i) => i.nome.trim() || 'un ingrediente')
    return [t, no.length ? `per ${elenco(no)}` : null]
  }))
}

/** L'id di un elemento nuovo dal suo nome: lo slug, con -2, -3… se e' gia' preso. */
export function idDaNome(nome: string, presi: Iterable<string>, riserva = 'elemento') {
  const usati = new Set(presi)
  const base = slug(nome).slice(0, 60) || riserva
  if (!usati.has(base)) return base
  for (let n = 2; ; n++) if (!usati.has(`${base}-${n}`)) return `${base}-${n}`
}

export function cerca<T>(elementi: T[], filtro: string, testo: (e: T) => string) {
  const f = filtro.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!f) return elementi
  return elementi.filter((e) => testo(e).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(f))
}

export const perNome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, 'it')

export function data(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
