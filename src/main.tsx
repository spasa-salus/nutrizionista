import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { FornitoreNotifica } from './ui'
import './stile.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FornitoreNotifica>
      <App />
    </FornitoreNotifica>
  </StrictMode>,
)
