import { createRoot } from 'react-dom/client'
import ResultScreen from './ResultScreen.jsx'

window.addEventListener('load', () => {
  const el = document.getElementById('result-root')
  if (el) createRoot(el).render(<ResultScreen />)
})