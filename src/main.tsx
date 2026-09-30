import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import './styles/tokens.css'
import './styles/ui.css'
import './styles/shell.css'
import './styles/keyboard.css'
import App from './App.tsx'
import { installSpringVars } from './os/spring'

installSpringVars()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) {
  void import('./os/store').then((m) => ((window as unknown as { __os: unknown }).__os = m.useOS))
}
