// Tutte le chiamate passano dalla Edge Function `admin`, col ruolo `nutrizionista`: il browser
// non ha chiavi Supabase, e quello che questo pannello puo' fare lo decide la funzione.

const URL_API = import.meta.env.VITE_ADMIN_API as string
const CHIAVE = 'nq-nutrizionista-sessione'

type Sessione = { token: string; scadeIl: string }

export function sessione(): Sessione | null {
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE) ?? 'null') as Sessione | null
    return s && new Date(s.scadeIl) > new Date() ? s : null
  } catch {
    return null
  }
}

export function salvaSessione(s: Sessione | null) {
  try {
    if (s) localStorage.setItem(CHIAVE, JSON.stringify(s))
    else localStorage.removeItem(CHIAVE)
  } catch { /* senza storage si resta connessi finche' la pagina e' aperta */ }
  window.dispatchEvent(new Event('nq-sessione'))
}

export class ErroreApi extends Error {
  constructor(readonly stato: number, messaggio: string) {
    super(messaggio)
  }
}

export async function chiama<T = any>(azione: string, parametri: object = {}): Promise<T> {
  const token = sessione()?.token
  let risposta: Response
  try {
    risposta = await fetch(URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
      body: JSON.stringify({ azione, ...parametri, ruolo: 'nutrizionista' }),
    })
  } catch {
    throw new ErroreApi(0, 'Server irraggiungibile, controlla la connessione')
  }
  const corpo = await risposta.json().catch(() => ({}))
  if (risposta.status === 401 && token) salvaSessione(null)
  if (!risposta.ok) throw new ErroreApi(risposta.status, corpo.errore ?? `Errore ${risposta.status}`)
  return corpo as T
}
