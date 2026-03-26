import './assets/main.css'
import { createRoot } from 'react-dom/client'
import App from './app'
import { initI18n } from './i18n'

// Initialize i18n before rendering
initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})
