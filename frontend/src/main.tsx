import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './app/App';
import { applyTheme, readStoredTheme } from './app/bootstrap/themeBootstrap';

applyTheme(readStoredTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Application root element was not found');
ReactDOM.createRoot(root).render(<App />);
