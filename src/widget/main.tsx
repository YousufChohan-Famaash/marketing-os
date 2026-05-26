import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/widget.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Widget root element #root not found in embed.html');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
