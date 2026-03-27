import './assets/main.css'
import { createRoot } from 'react-dom/client'
import App from './app'
import { initI18n } from './i18n'
;(async () => {
  await initI18n()
  createRoot(document.getElementById('root')!).render(<App />)
})()
