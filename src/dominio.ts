// Forme e nomi del contenuto come in Entita.swift ed Enumerazioni.swift dell'app iOS.

export type Supermercato = { id: string; nome: string; logo?: string; latitudine?: number; longitudine?: number }
export type Prodotto = {
  id: string; nome: string; categoria: string; tag: string[]; supermercati: string[]
  unita: string; quantitaBase: number; rilevanza: number
}
export type Ingrediente = { prodottoID?: string; nome: string; quantita: number; unita: string }
export type Ricetta = {
  id: string; nome: string; descrizione: string; ingredienti: Ingrediente[]; carrelli: string[]
  tag: string[]; minutiPreparazione: number; porzioni: number; immagine?: string; passaggi: string[]; momento: string
}
export type Carrello = {
  id: string; nome: string; descrizione: string; simbolo: string
  tagPreferiti: string[]; moltiplicatorePorzione: number; prodotti: string[]
}
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
export const MOMENTI: Record<string, string> = {
  colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', contorno: 'Contorno', dolce: 'Dolce',
}

/** "Pasta al pomodoro" -> "pasta-al-pomodoro", come gli id del bundle. */
export function slug(testo: string) {
  return testo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
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
