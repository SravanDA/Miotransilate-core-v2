import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './playground.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="tw-root app-root min-h-screen bg-slate-50">
      <App />
    </div>
  </StrictMode>,
)
