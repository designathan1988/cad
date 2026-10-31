import './ui/styles.css';
import { App } from './session/app';
import { boot, local } from './project/boot';
import { t } from './i18n/messages';
import { wireLibraryLinks } from './library/link';
import { wireInput } from './session/input';
import { installTooltips } from './ui/tooltip';

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
    // Read-only handle for the measurement scripts (scripts/baseline.mjs): the app itself, so ?perf's
    // lastFrame, renderer.info and the undo history can be read without touching any internals.
    (window as unknown as { __cad2: App }).__cad2 = app;
    // A library link (#lib=…) brings its objects and materials into the project open.
    wireLibraryLinks(app);
  })
  .catch((e: unknown) => {
    console.error('cad2 could not start:', e);
    root.textContent = t('boot.crashed');
  });
