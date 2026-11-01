const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const uiRoot = path.join(root, 'local-ui');
const profileFile = path.join(root, 'feather', 'configuration', 'profiles', 'default.json');
const sidebarFile = path.join(root, 'feather', 'sidebar.json');
const clickguiFile = path.join(root, 'feather', 'clickgui-reborn.json');
const micaFile = path.join(root, 'feather', 'mica-state.json');
const hiddenFile = path.join(root, 'feather', 'clickgui-hidden.json');
const port = 4200;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(Buffer.isBuffer(body) ? body : (typeof body === 'string' ? body : JSON.stringify(body)));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.reborn.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value), 'utf8');
  fs.renameSync(temp, file);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (part) => {
      data += part;
      if (data.length > 1024 * 1024) {
        reject(new Error('request too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function getModules() {
  const profile = readJson(profileFile);
  const hidden = new Set(getHiddenModules());
  const modules = Object.entries(profile)
    .filter(([id]) => !hidden.has(id))
    .map(([id, values]) => ({
      id,
      enabled: String(values.enabled) === 'true',
      settings: Object.fromEntries(Object.entries(values).filter(([key]) => key !== '**ArbitraryData**'))
    }));
  modules.sort((a, b) => a.id.localeCompare(b.id));
  return modules;
}

function getHiddenModules() {
  try {
    const value = readJson(hiddenFile);
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function getHud() {
  const profile = readJson(profileFile);
  return Object.entries(profile)
    .filter(([, values]) => Object.prototype.hasOwnProperty.call(values, 'hudEnabled1') || Object.prototype.hasOwnProperty.call(values, 'hudAnchor'))
    .map(([id, values]) => ({
      id,
      hudEnabled: String(values.hudEnabled1) === 'true',
      hudAnchor: values.hudAnchor || 'top_left',
      hudRelativeX: values.hudRelativeX ?? '0.0',
      hudRelativeY: values.hudRelativeY ?? '0.0',
      hudScale: values.hudScale ?? '1.0'
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, { ok: true, profileFile, sidebarFile });
  }

  if (req.method === 'GET' && url.pathname === '/api/modules') {
    try { return send(res, 200, { modules: getModules() }); }
    catch (error) { return send(res, 500, { error: `Could not read profile: ${error.message}` }); }
  }

  if (req.method === 'GET' && url.pathname === '/api/hud') {
    try { return send(res, 200, { hud: getHud() }); }
    catch (error) { return send(res, 500, { error: `Could not read HUD config: ${error.message}` }); }
  }

  if (req.method === 'GET' && url.pathname === '/api/sidebar') {
    try { return send(res, 200, { sidebar: readJson(sidebarFile) }); }
    catch (error) { return send(res, 500, { error: `Could not read sidebar: ${error.message}` }); }
  }

  if (req.method === 'GET' && url.pathname === '/api/clickgui') {
    try { return send(res, 200, readJson(clickguiFile)); }
    catch (error) {
      if (error.code === 'ENOENT') return send(res, 200, {});
      return send(res, 500, { error: `Could not read ClickGUI config: ${error.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/clickgui') {
    try {
      const body = await readBody(req);
      writeJsonAtomic(clickguiFile, body);
      return send(res, 200, { ok: true });
    } catch (error) {
      return send(res, 400, { error: `Could not save ClickGUI config: ${error.message}` });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/mica') {
    try { return send(res, 200, readJson(micaFile)); }
    catch (error) {
      if (error.code === 'ENOENT') return send(res, 200, { enabled: true });
      return send(res, 500, { error: `Could not read Mica state: ${error.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/mica') {
    try {
      const body = await readBody(req);
      writeJsonAtomic(micaFile, { enabled: Boolean(body.enabled) });
      return send(res, 200, { ok: true });
    } catch (error) {
      return send(res, 400, { error: `Could not save Mica state: ${error.message}` });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/hidden') {
    try { return send(res, 200, { hidden: getHiddenModules() }); }
    catch (error) { return send(res, 500, { error: `Could not read hidden modules: ${error.message}` }); }
  }

  if (req.method === 'POST' && url.pathname === '/api/hidden') {
    try {
      const body = await readBody(req);
      const hidden = Array.isArray(body.hidden) ? body.hidden.filter((item) => typeof item === 'string') : [];
      writeJsonAtomic(hiddenFile, hidden);
      return send(res, 200, { ok: true });
    } catch (error) {
      return send(res, 400, { error: `Could not save hidden modules: ${error.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/file-update') {
    try {
      const body = await readBody(req);
      if (body.kind === 'mod') {
        const profile = readJson(profileFile);
        const module = profile[body.id];
        if (!module) return send(res, 404, { error: 'module not found' });
        if (body.enabled !== undefined) module.enabled = String(Boolean(body.enabled));
        if (body.key) module[body.key] = String(body.value);
        writeJsonAtomic(profileFile, profile);
      } else if (body.kind === 'sidebar') {
        const sidebar = readJson(sidebarFile);
        const section = sidebar[body.section];
        if (!section) return send(res, 404, { error: 'section not found' });
        if (body.key) section[body.key] = String(body.value);
        writeJsonAtomic(sidebarFile, sidebar);
      } else {
        return send(res, 400, { error: 'invalid kind' });
      }
      return send(res, 200, { ok: true, restartRequired: true });
    } catch (error) {
      return send(res, 400, { error: `Could not update file: ${error.message}` });
    }
  }

  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(uiRoot, relative);
  if (file !== uiRoot && !file.startsWith(uiRoot + path.sep)) {
    return send(res, 400, 'Bad path', 'text/plain; charset=utf-8');
  }

  fs.readFile(file, (error, data) => {
    if (error) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'text/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.svg' ? 'image/svg+xml'
      : ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : ext === '.woff2' ? 'font/woff2'
      : ext === '.woff' ? 'font/woff'
      : ext === '.ttf' ? 'font/ttf'
      : ext === '.otf' ? 'font/otf'
      : 'application/octet-stream';
    send(res, 200, data, type);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Feather Reborn local UI listening on 127.0.0.1:${port}`);
});
