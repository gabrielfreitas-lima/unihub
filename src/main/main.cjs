// Processo principal do Electron.
//
// Ele só cria a janela e libera o acesso WebHID (e o microfone, para o
// retorno de voz). Toda a conversa com os dispositivos acontece no renderer,
// com APIs padrão da web (WebHID, Gamepad API e Web Audio), então o app não
// precisa de módulos nativos nem de DLLs.

const { app, BrowserWindow, Menu, Tray, nativeImage, screen, session, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

// Controles: o Chromium lê pelo Windows.Gaming.Input, que às vezes não entrega
// o controle (visto com um GameSir Cyclone 2 no modo Xbox e o Steam aberto),
// enquanto o XInput do Windows lê normalmente. Desligando esse leitor, o
// Chromium volta a usar o XInput e o teste de botões funciona.
app.commandLine.appendSwitch('disable-features', 'EnableWindowsGamingInputDataFetcher');

// A página do app é carregada do disco; nenhuma origem remota recebe HID.
function isAppOrigin(origin) {
  return typeof origin === 'string' && origin.startsWith('file:');
}

function isAppFrame(details) {
  return !!details && (isAppOrigin(details.origin) || isAppOrigin(details.requestingUrl));
}

function setupHidPermissions() {
  const ses = session.defaultSession;

  // Permite que navigator.hid.getDevices() devolva os dispositivos sem a
  // janela de seleção do Chromium. Só a página local do app recebe acesso.
  // HID para falar com os aparelhos; notificações para o aviso de bateria baixa;
  // microfone e escolha de saída de som para o teste e o retorno de voz do headset.
  const ALLOWED = new Set(['hid', 'notifications', 'media', 'speaker-selection']);
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) => {
    return ALLOWED.has(permission) && (isAppOrigin(requestingOrigin) || isAppFrame(details));
  });
  // Pedido de mídia: só áudio (nunca câmera), só da página do app.
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const appPage = isAppOrigin(details?.requestingUrl) || isAppOrigin(wc.getURL());
    if (permission === 'media') {
      const types = details?.mediaTypes || [];
      return callback(appPage && types.length > 0 && types.every((t) => t === 'audio'));
    }
    callback(appPage && ALLOWED.has(permission));
  });
  ses.setDevicePermissionHandler((details) => {
    return details.deviceType === 'hid' && isAppFrame(details);
  });

  // requestDevice() (botão "Procurar dispositivos") escolhe o primeiro
  // dispositivo da lista filtrada. Os demais já chegam via permissão acima.
  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const first = details.deviceList[0];
    callback(first ? first.deviceId : '');
  });
}

// --- Configurações do app (gravadas na pasta de dados do usuário) ----------

// menuPosition: cabeçalho em cima ('top') ou menu à esquerda ('left');
// menuPinned: com o menu à esquerda, fica aberto (true) ou recolhido (false);
// theme: cores do app (botão Temas).
const DEFAULT_SETTINGS = { autoStart: false, tray: false, menuPosition: 'top', menuPinned: true, theme: 'graphite', language: 'pt' };
const ALLOWED_VALUES = { menuPosition: ['top', 'left'], theme: ['light', 'dark', 'graphite'], language: ['pt', 'en', 'es'] };

// Cores da janela em cada tema (as mesmas do styles.css): fundo ao abrir e a
// faixa dos botões minimizar/maximizar/fechar, que o Windows desenha.
const THEME_COLORS = {
  graphite: { bg: '#14161a', bar: '#1c1f25', symbol: '#e7e9ee' },
  dark: { bg: '#050506', bar: '#0c0d0f', symbol: '#ececef' },
  light: { bg: '#dcdad4', bar: '#e7e5e0', symbol: '#1b1f27' },
};
// Faixa dos botões da janela: 1 px menor que o cabeçalho (52 px), para não
// cobrir a linha de baixo dele, que assim vai até a borda direita.
const TITLE_BAR_HEIGHT = 51;
const themeColors = () => THEME_COLORS[settings.theme] || THEME_COLORS.graphite;

function applyTheme() {
  if (!mainWindow) return;
  const c = themeColors();
  mainWindow.setBackgroundColor(c.bg);
  mainWindow.setTitleBarOverlay({ color: c.bar, symbolColor: c.symbol, height: TITLE_BAR_HEIGHT });
}
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = DEFAULT_SETTINGS;
let mainWindow = null;

// --- Bandeja do sistema -------------------------------------------------------
// Com a bandeja ligada, fechar a janela só a esconde: o app continua rodando
// (e os avisos de bateria continuam chegando). Para sair, "Sair" no ícone.

let tray = null;
let quitting = false;

function showWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// Textos do menu da bandeja, que fica fora da página.
const TRAY_TEXT = {
  pt: { open: 'Abrir o UniHub', quit: 'Sair' },
  en: { open: 'Open UniHub', quit: 'Quit' },
  es: { open: 'Abrir UniHub', quit: 'Salir' },
};

function applyTrayMenu() {
  const text = TRAY_TEXT[settings.language] || TRAY_TEXT.pt;
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: text.open, click: showWindow },
    { type: 'separator' },
    { label: text.quit, click: () => { quitting = true; app.quit(); } },
  ]));
}

function applyTray(enabled) {
  if (enabled && !tray) {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png')));
    tray.setToolTip('UniHub');
    applyTrayMenu();
    tray.on('click', showWindow);
  } else if (!enabled && tray) {
    tray.destroy();
    tray = null;
  }
}

// --- Iniciar com o Windows -----------------------------------------------------
// Entrada de inicialização do Windows. Rodando pelo código-fonte (npm start), o
// Windows precisa abrir o Electron apontando para a pasta do app.
const STARTED_HIDDEN = '--hidden';
const loginItem = () => ({
  path: process.execPath,
  args: app.isPackaged ? [STARTED_HIDDEN] : [app.getAppPath(), STARTED_HIDDEN],
});

function applyAutoStart(enabled) {
  app.setLoginItemSettings({ ...loginItem(), openAtLogin: enabled });
}

ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:set', (_event, key, value) => {
  // Só chaves conhecidas, com o tipo certo.
  if (!(key in DEFAULT_SETTINGS) || typeof value !== typeof DEFAULT_SETTINGS[key]) return settings;
  if (ALLOWED_VALUES[key] && !ALLOWED_VALUES[key].includes(value)) return settings;
  settings = { ...settings, [key]: value };
  if (key === 'autoStart') {
    applyAutoStart(value);
    // A bandeja é uma opção de quem inicia com o Windows: desligando um, desliga o outro.
    if (!value && settings.tray) {
      settings = { ...settings, tray: false };
      applyTray(false);
    }
  }
  if (key === 'tray') applyTray(value);
  if (key === 'language') applyTrayMenu();
  if (key === 'theme') applyTheme();
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch { /* sem gravar: vale só até fechar o app */ }
  return settings;
});

// Tamanho inicial: cabem duas linhas de cartões quadrados no Início, sem rolar.
const WINDOW_WIDTH = 1100;
const WINDOW_HEIGHT = 920;
const MIN_WINDOW_WIDTH = 960;

/** Tamanho inicial, com a mesma proporção em telas que não comportam a altura toda. */
function initialWindowSize() {
  const height = Math.min(WINDOW_HEIGHT, screen.getPrimaryDisplay().workAreaSize.height);
  return { width: Math.max(MIN_WINDOW_WIDTH, Math.round(height * WINDOW_WIDTH / WINDOW_HEIGHT)), height };
}

function createWindow({ hidden = false } = {}) {
  const win = new BrowserWindow({
    show: !hidden,
    ...initialWindowSize(),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: 600,
    title: 'UniHub',
    backgroundColor: themeColors().bg,
    // Sem a barra de título do Windows: os botões minimizar/maximizar/fechar
    // ficam sobre o cabeçalho do app, à direita (mesma cor e altura dele).
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: themeColors().bar, symbolColor: themeColors().symbol, height: TITLE_BAR_HEIGHT },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow = win;
  win.on('closed', () => { mainWindow = null; });

  // Com a bandeja ligada, o X da janela só esconde o app.
  win.on('close', (event) => {
    if (tray && !quitting) {
      event.preventDefault();
      win.hide();
    }
  });

  // Links externos nunca abrem dentro do app.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  if (process.argv.includes('--devtools')) win.webContents.openDevTools();
}

// Atalho para as configurações de som do Windows (aba de áudio dos headsets).
ipcMain.handle('open-sound-settings', () => shell.openExternal('ms-settings:sound'));

// Bateria de fones Bluetooth: o Windows guarda o valor que o fone manda pelo
// perfil de chamada (Hands-Free) numa propriedade do aparelho, mas não a passa
// para páginas web. Uma consulta CIM pelo PowerShell (que já vem no Windows)
// lê essa propriedade; sem módulo nativo. Aparelhos só pareados (desligados)
// também aparecem, com o último valor: quem chama decide quais estão conectados.
const BT_BATTERY_KEY = '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2';
const BT_BATTERY_SCRIPT = [
  "$k = '" + BT_BATTERY_KEY + "'",
  // 0000111E = perfil Hands-Free; no WQL a barra invertida vai dobrada.
  "$r = Get-CimInstance Win32_PnPEntity -Filter \"PNPDeviceID LIKE 'BTHENUM\\\\{0000111E%'\" | ForEach-Object {",
  '  $p = (Invoke-CimMethod -InputObject $_ -MethodName GetDeviceProperties -Arguments @{ devicePropertyKeys = @($k) }).deviceProperties',
  '  $b = ($p | Where-Object KeyName -eq $k).Data',
  '  if ($null -ne $b) { [pscustomobject]@{ name = $_.Name; percent = [int]$b } }',
  '}',
  'ConvertTo-Json @($r) -Compress',
].join('\n');

// Versão de um aparelho USB (ex.: dongle de headset): o Windows guarda o
// bcdDevice no ID do aparelho, como "USB\VID_291D&PID_385D&REV_0012".
// VID e PID chegam como números e são validados antes de entrar no comando.
ipcMain.handle('usb-revision', (_event, vendorId, productId) => new Promise((resolve) => {
  const valid = (n) => Number.isInteger(n) && n >= 0 && n <= 0xffff;
  if (process.platform !== 'win32' || !valid(vendorId) || !valid(productId)) return resolve(null);
  const hex = (n) => n.toString(16).toUpperCase().padStart(4, '0');
  const id = `VID_${hex(vendorId)}&PID_${hex(productId)}`;
  const script = `(Get-CimInstance Win32_PnPEntity -Filter "PNPDeviceID LIKE 'USB\\\\${id}%'").HardwareID -join ';'`;
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
    { timeout: 10_000, windowsHide: true }, (err, stdout) => {
      const rev = !err && new RegExp(`${id}&REV_([0-9A-F]{4})`, 'i').exec(stdout);
      resolve(rev ? rev[1].toUpperCase() : null);
    });
}));

// Teclados que o Windows conhece. O WebHID não mostra teclado de notebook
// (PS/2 ou interno) e não diz se um teclado é Bluetooth; o ID do Windows diz
// (ACPI\…, HID\{00001124…} ou {00001812…} = Bluetooth, HID\VID_… = USB). Só dos
// Bluetooth sobe o caminho (pai, avô…), onde está o nome do aparelho: subir o
// de todos levava segundos. Quem chama decide o que fazer com cada um.
const KEYBOARDS_SCRIPT = [
  "$r = Get-CimInstance Win32_PnPEntity -Filter \"PNPClass='Keyboard'\" | ForEach-Object {",
  '  $chain = @()',
  "  if ($_.PNPDeviceID -match '\\{0000(1124|1812)-') {",
  '    $id = $_.PNPDeviceID',
  '    for ($i = 0; $i -lt 3; $i++) {',
  '      $p = (Get-PnpDeviceProperty -InstanceId $id -KeyName DEVPKEY_Device_Parent -ErrorAction SilentlyContinue).Data',
  '      if (-not $p) { break }',
  '      $d = Get-PnpDevice -InstanceId $p -ErrorAction SilentlyContinue',
  '      $chain += [pscustomobject]@{ id = $p; name = $d.FriendlyName }',
  '      $id = $p',
  '    }',
  '  }',
  '  [pscustomobject]@{ id = $_.PNPDeviceID; name = $_.Name; chain = $chain }',
  '}',
  'ConvertTo-Json @($r) -Depth 4 -Compress',
].join('\n');

ipcMain.handle('system-keyboards', () => new Promise((resolve) => {
  if (process.platform !== 'win32') return resolve([]);
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', KEYBOARDS_SCRIPT],
    { timeout: 15_000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve([]);
      try {
        const list = JSON.parse(stdout.trim() || '[]');
        resolve((Array.isArray(list) ? list : [list]).filter((d) => d && typeof d.id === 'string')
          .map((d) => ({ id: d.id, name: d.name || '', chain: (Array.isArray(d.chain) ? d.chain : d.chain ? [d.chain] : []).map((c) => ({ id: String(c.id || ''), name: c.name || '' })) })));
      } catch {
        resolve([]);
      }
    });
}));

ipcMain.handle('bluetooth-batteries', () => new Promise((resolve) => {
  if (process.platform !== 'win32') return resolve([]);
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', BT_BATTERY_SCRIPT],
    { timeout: 10_000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve([]);
      try {
        const list = JSON.parse(stdout.trim() || '[]');
        resolve((Array.isArray(list) ? list : [list]).filter((d) => d && typeof d.name === 'string'));
      } catch {
        resolve([]);
      }
    });
}));

app.on('before-quit', () => { quitting = true; });

app.whenReady().then(() => {
  settings = loadSettings();
  for (const [key, values] of Object.entries(ALLOWED_VALUES)) {
    if (!values.includes(settings[key])) settings[key] = DEFAULT_SETTINGS[key];
  }
  // O Windows é a fonte da verdade: a entrada pode ter sido removida por fora.
  settings.autoStart = app.getLoginItemSettings(loginItem()).openAtLogin;
  if (!settings.autoStart) settings.tray = false;
  setupHidPermissions();
  // Aberto pelo Windows ao ligar o PC, com a bandeja ligada: começa só na bandeja.
  createWindow({ hidden: process.argv.includes(STARTED_HIDDEN) && settings.tray });
  applyTray(settings.tray);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Com a bandeja ligada o app continua rodando sem janela.
  if (process.platform !== 'darwin' && !tray) app.quit();
});
