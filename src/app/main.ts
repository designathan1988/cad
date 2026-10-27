import '../ui/styles.css';
import { App } from './app';
import { boot } from './boot';
import { wireLibraryLinks } from './library-link';
import { wireInput } from './input';
import { installTooltips } from '../ui/tooltip';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing from index.html');
// The project from the browser's database first (boot.ts), then the app on it.
void boot().then((b) => {
  const app = new App(root, b);
  wireInput(app);
  installTooltips();
  // A library link (#lib=…) brings its objects and materials into the project open.
  wireLibraryLinks(app);
});
