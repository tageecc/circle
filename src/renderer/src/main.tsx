import './assets/main.css'
import './i18n' // 初始化 i18n

import { createRoot } from 'react-dom/client'
import { Suspense } from 'react'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={<div>Loading...</div>}>
    <App />
  </Suspense>
)
