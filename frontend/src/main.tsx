import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './app/App';

// Apply the saved theme before React mounts. This prevents MUI X components
// from measuring/rendering once with the wrong theme during a page refresh.
const savedTheme = localStorage.getItem('iota-ml-theme');
document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
