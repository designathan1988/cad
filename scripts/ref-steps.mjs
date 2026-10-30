// Reference-capture roteiro (task step 2): a fixed tour of every view, tool and dialog, one screenshot
// per stop. Run from the driver: each step is ONE evaluate (the channel breaks on long multi-dispatch
// tasks), then the driver screenshots. Stops are named; the driver saves .scratchpad/ref/NN-name.png.
// Nothing here edits the project: tools are set and left, dialogs opened and closed with Escape.

function resetState() {
  const app = window.__cad2;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  // Overlays the dialogs live in: hidden, and any stray palette removed.
  const back = app.shell.helpBack;
  if (back) back.hidden = true;
  document.querySelectorAll('.palette, .menu').forEach((n) => n.remove());
  app.setTool('select');
  app.ui.selection.clear();
  if (app.ui.view !== 'plan') app.setView('plan');
  app.render();
  return true;
}

/** The drawing of the view shown: a fresh synchronous draw first, then the canvas's pixels as a SHA-256
 * hash (exact comparison) and a 480-px JPEG thumbnail (to look at). Kept small: big payloads kill the channel. */
async function captureCanvas() {
  const app = window.__cad2;
  if (app.ui.view === 'plan') app.render();
  else {
    app.render();
    const scene = app.scene;
    scene.invalidate();
    scene.render(); // synchronous draw, so the GL buffer still holds this frame
  }
  const c = app.ui.view === 'plan' ? app.shell.planCanvas : app.shell.glCanvas;
  const buf = await new Promise((res) => c.toBlob((b) => b.arrayBuffer().then(res), 'image/png'));
  const dig = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(buf)));
  const hash = Array.from(dig).map((b) => b.toString(16).padStart(2, '0')).join('');
  const th = document.createElement('canvas');
  const k = 480 / c.width;
  th.width = 480;
  th.height = Math.round(c.height * k);
  th.getContext('2d').drawImage(c, 0, 0, th.width, th.height);
  const thumb = th.toDataURL('image/jpeg', 0.72);
  return { hash, thumb, w: c.width, h: c.height };
}

function refStep(name) {
  const app = window.__cad2;
  const actions = app.actionList();
  const run = (id) => {
    const a = actions.find((x) => x.id === id);
    if (!a) throw new Error('no action ' + id);
    a.run();
    return true;
  };
  switch (name) {
    case 'plan': resetState(); return app.render(), true;
    case '3d': app.setView('3d'); return true;
    case 'photo': app.setView3D({ style: 'photo' }); return true;
    case 'shaded-back': app.setView3D({ style: 'shaded' }); return true;
    case 'xray': app.setView3D({ xray: true }); return true;
    case 'xray-off': app.setView3D({ xray: false }); return true;
    case 'cut': app.setView3D({ cut: true }); return true;
    case 'cut-off': app.setView3D({ cut: false }); return true;
    case 'box': app.toggleBox(); return true;
    case 'box-off': app.toggleBox(); return true;
    case 'explode': app.toggleExplode(); return true;
    case 'explode-off': app.toggleExplode(); return true;
    case 'ortho': app.setView3D({ ortho: true }); return true;
    case 'ortho-off': app.setView3D({ ortho: false }); return true;
    case 'elevation-north': app.setView('3d'); app.elevation('north'); return true;
    case 'plan-back': resetState(); return true;
    case 'select-similar': app.selectSimilar(); return true;
    case 'select-all': app.selectAll(); return true;
    case 'select-none': app.ui.selection.clear(); app.render(); return true;
    case 'theme': app.toggleTheme(); return 'toggled';
    case 'theme-back': app.toggleTheme(); return 'toggled';
    case 'browser': app.toggleBrowser(true); return true;
    case 'browser-off': app.toggleBrowser(false); return true;
    case 'panel-off': app.togglePanel(false); return true;
    case 'panel-on': app.togglePanel(true); return true;
    case 'lang': { const l = app.otherLanguage(); app.setLanguage(l); return l; }
    case 'lang-back': { const l = app.otherLanguage(); app.setLanguage(l); return l; }
    case 'palette': app.openCommands(); return true;
    default:
      // A tool stop: tool.<id>, or dialog.<actionId>, or an action id itself (mark.angle, edit.addNote…).
      if (name.startsWith('tool.')) { resetState(); app.setTool(name.slice(5)); return true; }
      if (name.startsWith('dialog.')) { resetState(); return run(name.slice(7)); }
      if (name.startsWith('view3d.')) { const patch = {}; patch[name.slice(7)] = true; app.setView3D(patch); return true; }
      if (actions.some((a) => a.id === name)) { resetState(); return run(name); }
      throw new Error('unknown step ' + name);
  }
}
