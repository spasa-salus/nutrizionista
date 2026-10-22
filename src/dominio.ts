// Forme e nomi del contenuto come in Entita.swift ed Enumerazioni.swift dell'app iOS.

export type Supermercato = { id: string; nome: string; logo?: string; latitudine?: number; longitudine?: number }
/** Per 100 g (100 ml per le bevande e quello che si misura a bicchieri), come sull'etichetta: energia in kcal, il resto in grammi. */
export type ValoriNutrizionali = Partial<Record<'energia' | 'grassi' | 'grassiSaturi' | 'carboidrati' | 'zuccheri' | 'fibre' | 'proteine' | 'sale', number>>
export type Prodotto = {
  id: string; nome: string; categoria: string; tag: string[]; supermercati: string[]
  unita: string; quantitaBase: number; rilevanza: number; valoriNutrizionali?: ValoriNutrizionali
}
/** La dose come si dice in cucina: 2 cucchiai, 1 pugno, 3 pezzi. Pesi e volumi non ci sono. */
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
export const TAG: Record<string, string> = {
  vegano: 'Vegano', vegetariano: 'Vegetariano', senzaGlutine: 'Senza glutine', senzaLattosio: 'Senza lattosio',
  proteico: 'Proteico', leggero: 'Leggero', adattoBambini: 'Adatto ai bambini', veloce: 'Veloce',
}
export const ESIGENZE = ['vegano', 'vegetariano', 'senzaGlutine', 'senzaLattosio']

/**
 * Le misure di ingredienti e prodotti, come UNITA in contenuto.ts e Unita nelle app: solo quelle di
 * casa, pezzi e confezioni compresi. `casa: false` per pezzi e confezioni, che nel menu vanno a parte.
 */
export const MISURE: { id: string; una: string; tante: string; casa: boolean }[] = [
  { id: 'cucchiaio', una: 'cucchiaio', tante: 'cucchiai', casa: true },
  { id: 'cucchiaino', una: 'cucchiaino', tante: 'cucchiaini', casa: true },
  { id: 'tazza', una: 'tazza', tante: 'tazze', casa: true },
  { id: 'tazzina', una: 'tazzina', tante: 'tazzine', casa: true },
  { id: 'bicchiere', una: 'bicchiere', tante: 'bicchieri', casa: true },
  { id: 'pugno', una: 'pugno', tante: 'pugni', casa: true },
  { id: 'manciata', una: 'manciata', tante: 'manciate', casa: true },
  { id: 'fetta', una: 'fetta', tante: 'fette', casa: true },
  { id: 'vasetto', una: 'vasetto', tante: 'vasetti', casa: true },
  { id: 'noce', una: 'noce', tante: 'noci', casa: true },
  { id: 'spicchio', una: 'spicchio', tante: 'spicchi', casa: true },
  { id: 'ciuffo', una: 'ciuffo', tante: 'ciuffi', casa: true },
  { id: 'rametto', una: 'rametto', tante: 'rametti', casa: true },
  { id: 'foglia', una: 'foglia', tante: 'foglie', casa: true },
  { id: 'pizzico', una: 'pizzico', tante: 'pizzichi', casa: true },
  { id: 'pezzo', una: 'pezzo', tante: 'pezzi', casa: false },
  { id: 'confezione', una: 'confezione', tante: 'confezioni', casa: false },
]

/** Il nome della misura per quella quantita': 1 cucchiaio, ½ cucchiaio, 1½ cucchiai. */
export function nomeMisura(unita: string, quantita: number) {
  const m = MISURE.find((x) => x.id === unita)
  return m ? (quantita > 1 ? m.tante : m.una) : unita
}

/** Le misure di casa per gruppi, coi nomi accordati alla quantita': per le tendine. */
export const gruppiMisure = (quantita: number): [string, [string, string][]][] => [
  ['Misure di casa', MISURE.filter((m) => m.casa).map((m) => [m.id, nomeMisura(m.id, quantita)])],
  ['Pezzi e confezioni', MISURE.filter((m) => !m.casa).map((m) => [m.id, nomeMisura(m.id, quantita)])],
]

const FRAZIONI: Record<number, string> = { 25: '¼', 50: '½', 75: '¾' }
/**
 * Una dose da leggere, come Unita.formatta nelle app: «3 pezzi», «½ tazza», «1½ cucchiai». Al
 * singolare l'uno e le frazioni da sole, al plurale il resto (0,3 pizzichi).
 */
export function dose(quantita: number, unita: string) {
  const intero = Math.floor(quantita + 1e-9)
  const frazione = FRAZIONI[Math.round((quantita - intero) * 100)]
  const numero = frazione ? `${intero || ''}${frazione}` : quantita.toLocaleString('it-IT', { maximumFractionDigits: 2 })
  const m = MISURE.find((x) => x.id === unita)
  const nome = !m ? unita : quantita === 1 || (quantita < 1 && frazione) ? m.una : m.tante
  return `${numero} ${nome}`
}

/** Come VALORI_NUTRIZIONALI in contenuto.ts, nell'ordine dell'etichetta; `etichetta` se e' un «di cui». */
export const VALORI_NUTRIZIONALI: { id: keyof ValoriNutrizionali; nome: string; etichetta?: string }[] = [
  { id: 'energia', nome: 'Energia' },
  { id: 'grassi', nome: 'Grassi' },
  { id: 'grassiSaturi', nome: 'Grassi saturi', etichetta: 'di cui saturi' },
  { id: 'carboidrati', nome: 'Carboidrati' },
  { id: 'zuccheri', nome: 'Zuccheri', etichetta: 'di cui zuccheri' },
  { id: 'fibre', nome: 'Fibre' },
  { id: 'proteine', nome: 'Proteine' },
  { id: 'sale', nome: 'Sale' },
]

/**
 * Perche' i valori non si possono salvare, con gli stessi controlli del server; null = vanno bene.
 * Vuoti vuol dire non saputi.
 */
export function erroreValori(v: ValoriNutrizionali | undefined): string | null {
  if (!v) return null
  for (const { id, nome } of VALORI_NUTRIZIONALI) {
    const x = v[id]
    const massimo = id === 'energia' ? 900 : 100
    if (x !== undefined && !(Number.isFinite(x) && x >= 0 && x <= massimo)) return `${nome}: da 0 a ${massimo} ${id === 'energia' ? 'kcal' : 'g'}`
  }
  if ((v.grassiSaturi ?? 0) > (v.grassi ?? Infinity)) return 'I saturi superano i grassi'
  if ((v.zuccheri ?? 0) > (v.carboidrati ?? Infinity)) return 'Gli zuccheri superano i carboidrati'
  // Un grammo di margine, come il server: le etichette arrotondano ogni voce.
  const grammi = (['grassi', 'carboidrati', 'fibre', 'proteine', 'sale'] as const).reduce((s, k) => s + (v[k] ?? 0), 0)
  if (grammi > 101) return 'I valori superano i 100 g'
  return null
}

/** Le kcal dai macronutrienti, coi fattori dell'etichetta (Reg. UE 1169/2011); null se ne manca uno. */
export function kcalDaiMacro(v: ValoriNutrizionali | undefined): number | null {
  if (!v || v.grassi === undefined || v.carboidrati === undefined || v.proteine === undefined) return null
  return Math.round(9 * v.grassi + 4 * v.carboidrati + 4 * v.proteine + 2 * (v.fibre ?? 0))
}

/** Se i valori in etichetta sono per 100 ml: le bevande e quello che si misura a bicchieri o tazzine. */
export const aVolume = (p?: Pick<Prodotto, 'unita' | 'categoria'>) =>
  p?.categoria === 'bevande' || p?.unita === 'bicchiere' || p?.unita === 'tazzina'
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
