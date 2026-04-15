<<<<<<< HEAD
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
=======
import React from 'react'
import { createRoot } from 'react-dom/client'

// Načtení tvých aktuálních stylů
import './index.css'
import './App.css'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <App />
)
>>>>>>> dadd4ccc79dda0e8cb86d54474321d7743fa2076
