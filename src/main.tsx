import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProvider } from './state/AppContext'
import { THEME_CSS } from './tokens'
import './styles.css'

// Both palettes go in before the first paint; the theme hook only flips
// `data-theme` on <html> afterwards.
const themeStyle = document.createElement('style')
themeStyle.textContent = THEME_CSS
document.head.prepend(themeStyle)

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
