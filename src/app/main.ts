import '../ui/styles.css';
import { App } from './app';
import { wireInput } from './input';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing from index.html');
const app = new App(root);
wireInput(app);
