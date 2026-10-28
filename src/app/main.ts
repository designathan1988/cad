import '../ui/styles.css';
import { App } from './app';
import { boot, local } from './boot';
import { wireLibraryLinks } from './library-link';
import { wireInput } from './input';
import { installTooltips } from '../ui/tooltip';
import { t } from '../ui/i18n';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing from index.html');
// The project from the browser's database first (boot.ts), then the app on it. A database that fails
// while starting (quota, a corrupt store, a blocked upgrade) leaves the project kept the old way open,
// and says so; the app that cannot start at all says so on the page: both left a blank page before.
void boot()
  .catch((e: unknown): ReturnType<typeof local> => {
    console.error('Starting with the browser database failed:', e);
    return { ...local(), failed: true };
  })
  .then((b) => {
    const app = new App(root, b);
    wireInput(app);
    installTooltips();
    // A library link (#lib=…) brings its objects and materials into the project open.
    wireLibraryLinks(app);
  })
  .catch((e: unknown) => {
    console.error('cad2 could not start:', e);
    root.textContent = t('boot.crashed');
  });
