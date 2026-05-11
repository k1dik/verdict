import { createRoot } from 'react-dom/client'
import Leaderboard from './Leaderboard.jsx'

// Ждём пока main.js инициализирует Store и G
window.addEventListener('load', () => {
  const el = document.getElementById('leaderboard-root')
  if (el) createRoot(el).render(<Leaderboard />)
})