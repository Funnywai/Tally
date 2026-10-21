import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerDevTools } from './devtools';
import { isStandalone } from './lib/standalone';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found');
}

if (isStandalone()) {
  document.documentElement.classList.add('is-standalone');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerDevTools();
