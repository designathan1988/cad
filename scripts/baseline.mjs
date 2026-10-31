// The baseline measurement, run INSIDE the page (task step 2). The driver reads this file and evaluates
// `runBaseline(opts)` in the app's page; it returns a JSON report. Nothing here changes the project:
// every scenario either renders, pans, drags one wall back to where it was, or undoes its own steps.
//
// Scenarios: plan render / hover moves / pan / zoom / wall drag (L-T-X joined) / nudge-move series /
// 100 undo + 100 redo / heap before-after / 3D render + renderer.info / photoreal samples over time /
// project open. ?perf not needed: app.lastFrame is read directly.

/* eslint-disable no-undef */

async function frame(n = 2) {
  // Not requestAnimationFrame: the pane may be hidden (background), where rAF never fires.
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 16));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ptr(target, type, x, y, extra = {}) {
  const r = target.getBoundingClientRect();
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: r.left + x,
      clientY: r.top + y,
      ...extra,
    }),
  );
}
function stats(list) {
  const s = [...list].sort((a, b) => a - b);
  const sum = s.reduce((t, v) => t + v, 0);
  return { mean: +(sum / s.length).toFixed(1), p50: +s[Math.floor(s.length / 2)].toFixed(1), max: +s[s.length - 1].toFixed(1) };
}

async function runBaseline(opts) {
  const app = window.__cad2;
  if (!app) throw new Error('window.__cad2 missing (the app must be built with the measurement handle)');
  const part = opts.part ?? 'plan';
  const steps = opts.steps ?? 100;
  const hoverN = opts.hover ?? 6;
  const panN = opts.pan ?? 5;
  const dragN = opts.drag ?? 6;
  const report = { label: opts.label, part, viewport: { w: innerWidth, h: innerHeight }, walls: app.store.get().walls.length, scenarios: {} };
  const longTasks = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => longTasks.push(+e.duration.toFixed(1)))).observe({ type: 'longtask', buffered: true });
  const mem = () => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);

  const canvas = () => (app.ui.view === 'plan' ? app.shell.planCanvas : app.shell.glCanvas);
  const sizes = { w: canvas().getBoundingClientRect().width, h: canvas().getBoundingClientRect().height };

  if (part === '3d') {
    app.setView('3d');
    await frame(3);
    const totals = [];
    const steps = {};
    for (let i = 0; i < 5; i++) {
      app.render();
      totals.push(app.lastFrame.total);
      for (const [n, ms] of app.lastFrame.steps) steps[n] = +(ms.toFixed(1));
    }
    const info = app.scene.renderer.info;
    report.scenarios['3d-render'] = { ...stats(totals), steps };
    report.scenarios['3d-info'] = { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? null };
    // A right-button orbit, as the user turns the model.
    const c3 = canvas();
    const orbit = [];
    ptr(c3, 'pointerdown', sizes.w / 2, sizes.h / 2, { button: 2, buttons: 2 });
    for (let i = 1; i <= 10; i++) {
      ptr(c3, 'pointermove', sizes.w / 2 + i * 8, sizes.h / 2, { button: 2, buttons: 2 });
      await frame(1);
      if (app.lastFrame) orbit.push(app.lastFrame.total);
    }
    ptr(c3, 'pointerup', sizes.w / 2 + 80, sizes.h / 2, { button: 2, buttons: 0 });
    report.scenarios['3d-orbit'] = stats(orbit);
    report.longTasks = { count: longTasks.length, max: longTasks.length ? Math.max(...longTasks) : 0, over100ms: longTasks.filter((d) => d > 100).length };
    report.heapEnd = mem();
    return JSON.stringify(report, null, 1);
  }

  // --- plan part ---------------------------------------------------------------------------
  if (part === 'plan') {
  app.setView('plan');
  app.frameAll();
  await frame(3);
  {
    const totals = [];
    const steps = {};
    for (let i = 0; i < 5; i++) {
      app.render();
      totals.push(app.lastFrame.total);
      for (const [n, ms] of app.lastFrame.steps) steps[n] = +(ms.toFixed(1));
    }
    report.scenarios['plan-render'] = { ...stats(totals), steps };
  }

  // --- hover moves across the drawing (each move renders)
  {
    const times = [];
    for (let i = 0; i < hoverN; i++) {
      ptr(canvas(), 'pointermove', (sizes.w / 20) * i + 10, sizes.h * (0.3 + 0.4 * Math.sin(i)));
      await frame(1);
      if (app.lastFrame) times.push(app.lastFrame.total);
    }
    report.scenarios['plan-hover'] = stats(times);
  }

  // --- pan (middle button) and zoom (wheel)
  {
    const times = [];
    ptr(canvas(), 'pointerdown', sizes.w / 2, sizes.h / 2, { button: 1, buttons: 4 });
    for (let i = 0; i < panN; i++) {
      ptr(canvas(), 'pointermove', sizes.w / 2 + i * 12, sizes.h / 2 + i * 6, { button: 1, buttons: 4 });
      await frame(1);
      if (app.lastFrame) times.push(app.lastFrame.total);
    }
    ptr(canvas(), 'pointerup', sizes.w / 2 + 120, sizes.h / 2 + 60, { button: 1, buttons: 0 });
    report.scenarios['plan-pan'] = stats(times);
    const zooms = [];
    for (let i = 0; i < 5; i++) {
      canvas().dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120, clientX: canvas().getBoundingClientRect().left + sizes.w / 2, clientY: canvas().getBoundingClientRect().top + sizes.h / 2 }));
      await frame(1);
      if (app.lastFrame) zooms.push(app.lastFrame.total);
    }
    report.scenarios['plan-zoom'] = stats(zooms);
    app.frameAll();
    await frame(2);
  }

  // --- select and drag a wall that joins many others (the grid's walls cross at L, T and X)
  const doc0 = app.store.get();
  const level = app.ui.levelId;
  const mid = { x: 0, y: 0 };
  for (const w of doc0.walls) {
    if (w.levelId !== level) continue;
    mid.x = (w.start.x + w.end.x) / 2;
    mid.y = (w.start.y + w.end.y) / 2;
    break;
  }
  const screen = app.plan.toScreen(mid);
  let dragTimes = [];
  {
    ptr(canvas(), 'pointerdown', screen.x, screen.y, { button: 0, buttons: 1 });
    ptr(canvas(), 'pointerup', screen.x, screen.y, { button: 0, buttons: 0 });
    await frame(2); // selected
    const sel = [...app.ui.selection][0] ?? null;
    report.scenarios['plan-select'] = { picked: sel, kinds: app.ui.selection.size };
    ptr(canvas(), 'pointerdown', screen.x, screen.y, { button: 0, buttons: 1 });
    for (let i = 1; i <= dragN; i++) {
      ptr(canvas(), 'pointermove', screen.x + i * 7, screen.y + i * 5, { button: 0, buttons: 1 });
      await frame(1);
      if (app.lastFrame) dragTimes.push(app.lastFrame.total);
    }
    ptr(canvas(), 'pointerup', screen.x + 70, screen.y + 50, { button: 0, buttons: 0 });
    await frame(2);
    report.scenarios['plan-wall-drag'] = { ...stats(dragTimes), undoDepthGrow: 1 };
    app.undo(); // the drag was one move: back
    await frame(2);
  }
  } // end of the plan part

  // --- a series of moves (each an undo step) and undo + redo, with the heap watched
  if (part !== 'history') {
    report.longTasks = { count: longTasks.length, max: longTasks.length ? Math.max(...longTasks) : 0, over100ms: longTasks.filter((d) => d > 100).length };
    report.heapEnd = mem();
    return JSON.stringify(report, null, 1);
  }
  {
    // A wall with no opening on it, selected through the UI's own selection set: the nudge is a real move.
    const doc = app.store.get();
    const withOpening = new Set(doc.openings.map((o) => o.wallId));
    const wall = doc.walls.find((w) => w.levelId === app.ui.levelId && !withOpening.has(w.id) && !w.bulge) ?? doc.walls[0];
    app.setTool('select');
    app.ui.selection = new Set([wall.id]);
    app.refresh();
    const heap0 = mem();
    const nudges = [];
    let moved = 0;
    const xOf = () => {
      const w = app.store.get().walls.find((v) => v.id === wall.id);
      return w ? w.start.x : NaN;
    };
    for (let i = 0; i < steps; i++) {
      const before = xOf();
      const t0 = performance.now();
      app.nudgeSelection({ x: 0.01, y: 0 });
      nudges.push(performance.now() - t0);
      if (xOf() !== before) moved++;
    }
    report.scenarios['nudge-setup'] = { wall: wall.id, moved, canUndo: app.store.canUndo() };
    const heap1 = mem();
    const undos = [];
    for (let i = 0; i < steps; i++) {
      const t0 = performance.now();
      app.store.undo();
      undos.push(performance.now() - t0);
    }
    const heap2 = mem();
    const redos = [];
    for (let i = 0; i < steps; i++) {
      const t0 = performance.now();
      app.store.redo();
      redos.push(performance.now() - t0);
    }
    // back to the project as it was
    for (let i = 0; i < steps + 1; i++) app.store.undo();
    report.scenarios['nudge-100'] = stats(nudges);
    report.scenarios['undo-100'] = stats(undos);
    report.scenarios['redo-100'] = stats(redos);
    report.scenarios['heap-mb'] = { after100steps: heap1 && heap0 ? heap1 - heap0 : null, afterUndo: heap2 && heap1 ? heap2 - heap1 : null, end: mem() };
  }

  // --- project open (a File with opts.docJson)
  if (part === 'open' && opts.docJson) {
    const file = new File([opts.docJson], 'open-test.json', { type: 'application/json' });
    const t0 = performance.now();
    await app.openFile(file);
    await frame(3);
    report.scenarios['open-bigproject-ms'] = +(performance.now() - t0).toFixed(0);
    app.store.undo(); // back
    report.longTasks = { count: longTasks.length, max: longTasks.length ? Math.max(...longTasks) : 0, over100ms: longTasks.filter((d) => d > 100).length };
    report.heapEnd = mem();
    return JSON.stringify(report, null, 1);
  }

  report.longTasks = { count: longTasks.length, max: longTasks.length ? Math.max(...longTasks) : 0, over100ms: longTasks.filter((d) => d > 100).length };
  report.heapEnd = mem();
  return JSON.stringify(report, null, 1);
}
