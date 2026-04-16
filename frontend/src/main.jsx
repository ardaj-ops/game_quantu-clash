import React from 'react';
import { createRoot } from 'react-dom/client';

// Načtení tvých aktuálních stylů
import './index.css';
import './App.css';

import App from './App.jsx';

const root = createRoot(document.getElementById('root'));
root.render(
  <App />
);