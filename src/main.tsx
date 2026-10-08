import { createRoot } from 'react-dom/client';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/sora/latin-500.css';
import '@fontsource/sora/latin-600.css';
import './styles.css';
import { App } from './app/App';
createRoot(document.getElementById('root')!).render(<App/>);
