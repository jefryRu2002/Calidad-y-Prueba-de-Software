/**
 * TC-010 – Asignación de técnico a solicitud pendiente
 * Sistema: ColTech | Módulo: Administrador > Órdenes de trabajo
 *
 * HISTORIA: HU-10
 *   "Como administrador quiero asignar un técnico a una solicitud de reparación
 *    pendiente para que el equipo pueda ser evaluado y atendido."
 *
 * Pasos (matriz):
 *   1) Login admin
 *   2) Ir a Órdenes de trabajo
 *   3) Buscar y seleccionar la solicitud PENDIENTE
 *   4) Elegir técnico del desplegable de asignación
 *   5) Click en "Asignar"
 *
 * Resultado esperado:
 *   - Estado de la solicitud cambia a ASIGNADO
 *   - Técnico queda asociado
 *   - Se envía notificación (visual o correo)
 *
 * Precondición:
 *   ⚠️ Debe existir al menos una solicitud PENDIENTE en BD
 *   ⚠️ Debe existir al menos un técnico registrado
 *
 * Evidencia:
 *   artifacts/captura_asignacion_tecnico_10.png              (PASÓ — nombre de tu matriz)
 *   artifacts/TC-010_evidencia_asignacion_tecnico.png        (PASÓ — backup)
 *   artifacts/TC-010_evidencia_asignacion_tecnico_FALLO.png  (FALLÓ)
 *
 * Uso:
 *   node tests\asignar-tecnico-solicitud.js
 *   $env:COLTECH_DEBUG="1"; node tests\asignar-tecnico-solicitud.js
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { Select } = require('selenium-webdriver/lib/select');
const fs   = require('fs');
const path = require('path');

// ======================= CONFIGURACIÓN =======================
const BASE_URL    = process.env.COLTECH_URL || 'http://localhost:4200';
const TIMEOUT     = 20000;
const DEBUG       = process.env.COLTECH_DEBUG === '1';
const TEST_ID     = 'TC-010';

const ADMIN = {
  usuario:    'admin',
  contrasena: 'admin123'
};

const LOGIN_PATH = '/login';

// Regex de estados
const REGEX_PENDIENTE = /pendiente|por asignar|nuevo|nueva|unassigned|pending/i;
const REGEX_ASIGNADO  = /asignad[oa]|assigned/i;

// Mensajes
const REGEX_EXITO_ASIGNACION = /asignad[oa]|asignaci[oó]n.*exitosa|t[eé]cnico.*asignado|actualizad[oa]/i;
const REGEX_NOTIFICACION     = /notificaci[oó]n|notificado|correo.*enviado|email.*enviado|mensaje.*enviado/i;

// Evidencia
const EVIDENCIA_PASO_MATRIZ = 'captura_asignacion_tecnico_10.png';
const EVIDENCIA_PASO_EXTRA  = 'TC-010_evidencia_asignacion_tecnico.png';
const EVIDENCIA_FALLO       = 'TC-010_evidencia_asignacion_tecnico_FALLO.png';

// Carpeta artefactos
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

// ======================= SELECTORES ==========================
const SELS = {
  // Login
  tituloLogin:      [By.css('.login-box .titulo')],
  inputUsuario:     [By.css('input[name="usuario"]')],
  inputContrasena:  [By.css('input[name="contrasena"]')],
  btnLogin:         [By.css('button.btn-login')],

  // Navegación
  linkOrdenTrabajo: [
    By.css('a[routerLink="/administrador/orden-trabajo"]'),
    By.css('a[href*="orden-trabajo"]'),
    By.xpath("//a[contains(normalize-space(.), 'Órdenes') or contains(normalize-space(.), 'Ordenes')]"),
    By.xpath("//span[contains(normalize-space(.), 'Órdenes')]/ancestor::a")
  ],
  marcadorOrdenTrabajo: [
    By.css('app-administrador-orden-trabajo'),
    By.css('.ordenes-container'),
    By.css('.orden-trabajo-container'),
    By.css('table'),
    By.css('mat-table')
  ],

  // Tabla
  filasTabla: [
    By.css('table tbody tr'),
    By.css('mat-table mat-row'),
    By.css('mat-row'),
    By.css('.orden-row')
  ],

  // Buscador
  inputBusqueda: [
    By.css('input[type="search"]'),
    By.css('input[name="busqueda"]'),
    By.css('input[placeholder*="Buscar" i]'),
    By.css('input[placeholder*="buscar" i]')
  ],

  // Botón "Asignar" — puede estar en la fila o ser global
  btnAsignarEnFila: [
    By.xpath(".//button[contains(normalize-space(.), 'Asignar')]"),
    By.css('button.btn-asignar'),
    By.css('[data-testid="btn-asignar"]')
  ],
  btnAsignarGlobal: [
    By.xpath("//button[contains(normalize-space(.), 'Asignar')]"),
    By.css('button.btn-asignar-global')
  ],

  // Modal de asignación
  modalAsignacion: [
    By.css('.modal-content.modal-asignar'),
    By.css('.modal-overlay'),
    By.css('mat-dialog-container'),
    By.css('app-asignar-tecnico')
  ],

  // Select de técnico
  selectTecnico: [
    By.css('select[name="tecnico"]'),
    By.css('select[name="idTecnico"]'),
    By.css('select[name="tecnicoAsignado"]'),
    By.css('mat-select[name="tecnico"]'),
    By.css('mat-select[formcontrolname="tecnico"]'),
    By.css('[formcontrolname="tecnico"]')
  ],

  // Botón confirmar
  btnConfirmarAsignacion: [
    By.xpath("//button[contains(normalize-space(.), 'Asignar') or contains(normalize-space(.), 'Confirmar') or contains(normalize-space(.), 'Guardar')]"),
    By.css('.modal-asignar button[type="submit"]'),
    By.css('button.btn-confirmar-asignar')
  ],

  // Mensajes
  alertaExito: [
    By.css('.alerta-exito'),
    By.css('.toast-success'),
    By.css('.swal2-success'),
    By.css('[role="alert"].success'),
    By.css('mat-snack-bar-container')
  ]
};

// ======================= HELPERS =============================

async function findFirstVisible(driver, locators, timeout = TIMEOUT, desc) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    for (const loc of locators) {
      try {
        const els = await driver.findElements(loc);
        for (const el of els) {
          if (await el.isDisplayed()) return { elemento: el, selector: loc.toString() };
        }
      } catch (_) {}
    }
    await driver.sleep(300);
  }
  throw new Error(`No se encontró "${desc}". Probados: ${locators.map(l => l.toString()).join(' | ')}`);
}

async function findFirstVisibleOrNull(driver, locators, timeout = 5000) {
  try { return await findFirstVisible(driver, locators, timeout, 'opcional'); } catch (_) { return null; }
}

async function esperarTexto(driver, locators, regex, timeout = 8000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    for (const loc of locators) {
      try {
        const els = await driver.findElements(loc);
        for (const el of els) {
          if (!(await el.isDisplayed())) continue;
          const txt = ((await el.getText()) || '').trim();
          if (txt && regex.test(txt)) return txt;
        }
      } catch (_) {}
    }
    await driver.sleep(300);
  }
  return null;
}

async function guardarEvidencia(driver, nombre) {
  try {
    const file = path.join(ARTIFACTS_DIR, nombre);
    fs.writeFileSync(file, await driver.takeScreenshot(), 'base64');
    console.log(`   📸 Evidencia: ${file}`);
  } catch (e) {
    console.log(`   ⚠️ No se pudo capturar evidencia: ${e.message}`);
  }
}

async function dumpPageForDebug(driver, sufijo) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const url = await driver.getCurrentUrl();
    const html = await driver.getPageSource();
    const file = path.join(ARTIFACTS_DIR, `page-${TEST_ID}-${sufijo}-${ts}.html`);
    fs.writeFileSync(file, `<!-- URL: ${url} -->\n${html}`, 'utf-8');
    console.log(`   📄 HTML guardado: ${file}`);
  } catch (_) {}
}

async function volcarEstructuraUI(driver) {
  try {
    const info = await driver.executeScript(`
      const res = { url: window.location.href, headers: [], filas: [], botones: [], buscadores: [] };
      document.querySelectorAll('input').forEach(inp => {
        if (inp.offsetParent === null) return;
        const t = (inp.type || '').toLowerCase();
        const ph = inp.getAttribute('placeholder') || '';
        if (t === 'search' || ph.toLowerCase().includes('buscar')) res.buscadores.push({ type: t, placeholder: ph });
      });
      document.querySelectorAll('button').forEach(btn => {
        if (btn.offsetParent === null) return;
        const txt = (btn.innerText || '').trim();
        if (txt && txt.length < 40) res.botones.push(txt);
      });
      const table = document.querySelector('table');
      if (table) {
        table.querySelectorAll('thead th').forEach(th => res.headers.push((th.innerText || '').trim()));
        const tbody = table.querySelector('tbody');
        if (tbody) {
          Array.from(tbody.querySelectorAll('tr')).slice(0, 8).forEach(tr => {
            const celdas = Array.from(tr.querySelectorAll('td')).map(td => (td.innerText || '').trim().slice(0, 40));
            res.filas.push(celdas);
          });
        }
      }
      return res;
    `);

    console.log('\n   ─── 🔍 DIAGNÓSTICO DE UI ───');
    console.log(`   URL: ${info.url}`);
    console.log(`   Buscadores: ${info.buscadores.map(b => `type="${b.type}" ph="${b.placeholder}"`).join(' | ') || '(ninguno)'}`);
    console.log(`   Botones visibles: [${info.botones.slice(0, 15).join(' | ')}]`);
    console.log(`   Headers tabla (${info.headers.length}): [${info.headers.join(', ')}]`);
    console.log(`   Filas (${info.filas.length} mostradas):`);
    info.filas.forEach((f, i) => console.log(`     [${i}] ${JSON.stringify(f)}`));
    console.log('   ─────────────────────────────\n');
    return info;
  } catch (e) {
    console.log(`   ⚠️ No se pudo volcar la UI: ${e.message}`);
    return { headers: [], filas: [], botones: [], buscadores: [] };
  }
}

async function loginAdmin(driver) {
  await driver.get(`${BASE_URL}${LOGIN_PATH}`);
  await driver.wait(until.elementLocated(SELS.tituloLogin[0]), TIMEOUT);

  const iu = await findFirstVisible(driver, SELS.inputUsuario, TIMEOUT, 'input usuario');
  await iu.elemento.clear();
  await iu.elemento.sendKeys(ADMIN.usuario);

  const ip = await findFirstVisible(driver, SELS.inputContrasena, TIMEOUT, 'input contraseña');
  await ip.elemento.clear();
  await ip.elemento.sendKeys(ADMIN.contrasena);

  const btn = await findFirstVisible(driver, SELS.btnLogin, TIMEOUT, 'botón login');
  await btn.elemento.click();

  await driver.wait(async () => {
    const u = await driver.getCurrentUrl();
    return !u.endsWith('/login') && !u.endsWith('/login/');
  }, TIMEOUT, 'El login no redirigió');
}

async function encontrarFilaPendiente(driver) {
  for (const loc of SELS.filasTabla) {
    try {
      const filas = await driver.findElements(loc);
      for (let i = 0; i < filas.length; i++) {
        const txt = (await filas[i].getText()) || '';
        if (REGEX_PENDIENTE.test(txt)) {
          return { indice: i, fila: filas[i], texto: txt.replace(/\s+/g, ' ').trim() };
        }
      }
    } catch (_) {}
  }
  return null;
}

async function contarFilas(driver) {
  for (const loc of SELS.filasTabla) {
    try { return (await driver.findElements(loc)).length; } catch (_) {}
  }
  return 0;
}

// ======================= TEST PRINCIPAL ======================

(async () => {
  let driver;
  let paso = 'Inicialización';
  const resultado = {
    id: TEST_ID,
    estado: 'FALLÓ',
    detalle: '',
    duracion: 0,
    subresultados: {
      login:          { estado: 'NO_EJECUTADO', detalle: '' },
      navegacion:     { estado: 'NO_EJECUTADO', detalle: '' },
      solicitudPend:  { estado: 'NO_EJECUTADO', detalle: '' },
      asignacion:     { estado: 'NO_EJECUTADO', detalle: '' },
      estadoCambiado: { estado: 'NO_EJECUTADO', detalle: '' },
      notificacion:   { estado: 'NO_EJECUTADO', detalle: '' }
    }
  };
  const t0 = Date.now();

  try {
    // ---------- Setup ----------
    paso = 'Lanzar Chrome';
    const options = new chrome.Options();
    // options.addArguments('--headless=new');
    options.addArguments('--start-maximized');
    options.addArguments('--disable-notifications');
    options.addArguments('--incognito');

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    await driver.manage().setTimeouts({ implicit: 0, pageLoad: TIMEOUT, script: TIMEOUT });
    console.log('   ✓ Chrome lanzado');

    // ---------- Paso 1: login ----------
    console.log('\n   ─── Paso 1: Login administrador ───');
    paso = 'Paso 1 – Login admin';
    await loginAdmin(driver);
    console.log(`   ✓ Admin autenticado. URL: ${await driver.getCurrentUrl()}`);
    resultado.subresultados.login = { estado: 'PASÓ', detalle: 'Login exitoso' };

    // ---------- Paso 2: navegar ----------
    console.log('\n   ─── Paso 2: Ir a Órdenes de trabajo ───');
    paso = 'Paso 2 – Navegar al módulo';
    try {
      const link = await findFirstVisible(driver, SELS.linkOrdenTrabajo, 6000, 'link Órdenes');
      await link.elemento.click();
      console.log(`   ✓ Click en link (${link.selector})`);
    } catch (_) {
      console.log('   ℹ Navegando por URL directa');
      await driver.get(`${BASE_URL}/administrador/orden-trabajo`);
    }

    await findFirstVisible(driver, SELS.marcadorOrdenTrabajo, TIMEOUT, 'tabla de órdenes');
    console.log(`   ✓ Página cargada: ${await driver.getCurrentUrl()}`);
    await driver.sleep(2500);
    resultado.subresultados.navegacion = { estado: 'PASÓ', detalle: 'Módulo accesible' };

    await volcarEstructuraUI(driver);

    const totalFilas = await contarFilas(driver);
    if (totalFilas === 0) {
      throw new Error('La tabla está vacía. Precondición "existen órdenes de trabajo" no se cumple.');
    }
    console.log(`   ✓ Tabla con ${totalFilas} fila(s)`);

    // ---------- Paso 3: encontrar PENDIENTE ----------
    console.log('\n   ─── Paso 3: Buscar solicitud PENDIENTE ───');
    paso = 'Paso 3 – Encontrar solicitud pendiente';

    const buscador = await findFirstVisibleOrNull(driver, SELS.inputBusqueda, 3000);
    if (buscador) {
      await buscador.elemento.clear();
      await buscador.elemento.sendKeys('pendiente');
      await driver.sleep(1500);
      console.log('   ✓ Búsqueda por "pendiente" aplicada');
    }

    let pendiente = await encontrarFilaPendiente(driver);
    if (!pendiente && buscador) {
      console.log('   ℹ No se encontró con filtro. Reintentando sin filtro...');
      await buscador.elemento.clear();
      await driver.sleep(1500);
      pendiente = await encontrarFilaPendiente(driver);
    }

    if (!pendiente) {
      throw new Error(
        'No se encontró solicitud PENDIENTE. ' +
        'Precondición no cumplida: debe existir al menos una solicitud PENDIENTE en BD.'
      );
    }
    console.log(`   ✓ Solicitud PENDIENTE encontrada (fila #${pendiente.indice}): "${pendiente.texto}"`);
    resultado.subresultados.solicitudPend = { estado: 'PASÓ', detalle: 'Solicitud pendiente identificada' };

    // ---------- Paso 4: elegir técnico ----------
    console.log('\n   ─── Paso 4: Elegir técnico ───');
    paso = 'Paso 4 – Seleccionar técnico';

    let modalAbierto = false;

    // Estrategia A: botón "Asignar" dentro de la fila pendiente
    try {
      const btnEnFila = await pendiente.fila.findElements(By.xpath(".//button[contains(normalize-space(.), 'Asignar')]"));
      if (btnEnFila.length > 0) {
        await btnEnFila[0].click();
        modalAbierto = true;
        console.log('   ✓ Click en "Asignar" de la fila');
      }
    } catch (_) {}

    // Estrategia B: seleccionar checkbox/radio de la fila + botón global
    if (!modalAbierto) {
      console.log('   ℹ Sin botón en fila, intentando botón global');
      try {
        const check = await pendiente.fila.findElements(By.css('input[type="checkbox"], input[type="radio"]'));
        if (check.length > 0) {
          await check[0].click();
          await driver.sleep(500);
        }
      } catch (_) {}

      const btnGlobal = await findFirstVisibleOrNull(driver, SELS.btnAsignarGlobal, 3000);
      if (btnGlobal) {
        await btnGlobal.elemento.click();
        modalAbierto = true;
        console.log('   ✓ Click en "Asignar" global');
      }
    }

    const formAsign = await findFirstVisibleOrNull(driver, SELS.modalAsignacion, 5000);
    if (formAsign) console.log(`   ✓ Formulario de asignación abierto (${formAsign.selector})`);

    // Buscar select de técnico
    const selTecnico = await findFirstVisible(driver, SELS.selectTecnico, TIMEOUT, 'select técnico');
    let tecnicoElegido = '';

    if ((await selTecnico.elemento.getTagName()) === 'select') {
      const options = await selTecnico.elemento.findElements(By.css('option'));
      let elegido = null;
      for (const opt of options) {
        const value = await opt.getAttribute('value');
        const label = ((await opt.getText()) || '').trim();
        if (value && value !== '' && value !== '0' && value !== 'null' &&
            label && !/seleccione|--|choose/i.test(label)) {
          elegido = { value, label };
          break;
        }
      }
      if (!elegido) throw new Error('El select de técnicos no tiene opciones válidas');
      const selectObj = new Select(selTecnico.elemento);
      await selectObj.selectByValue(elegido.value);
      tecnicoElegido = elegido.label;
      console.log(`   ✓ Técnico seleccionado (select): ${tecnicoElegido}`);
    } else {
      await selTecnico.elemento.click();
      await driver.sleep(800);
      const opciones = await driver.findElements(By.css('mat-option, .mat-option, [role="option"]'));
      if (opciones.length === 0) throw new Error('El select no desplegó opciones');
      let opcionElegida = opciones[0];
      for (const op of opciones) {
        const txt = ((await op.getText()) || '').trim();
        if (txt && !/seleccione|--|choose/i.test(txt)) {
          opcionElegida = op;
          tecnicoElegido = txt;
          break;
        }
      }
      await opcionElegida.click();
      console.log(`   ✓ Técnico seleccionado (mat-select): ${tecnicoElegido}`);
    }

    // ---------- Paso 5: confirmar ----------
    console.log('\n   ─── Paso 5: Confirmar asignación ───');
    paso = 'Paso 5 – Click "Asignar"';

    const btnConfirmar = await findFirstVisible(driver, SELS.btnConfirmarAsignacion, TIMEOUT, 'botón confirmar asignación');
    await btnConfirmar.elemento.click();
    console.log('   ✓ Click en botón de confirmación');

    // Validación 1: mensaje de éxito
    paso = 'Validación 1 – Mensaje de éxito';
    const msgExito = await esperarTexto(driver, SELS.alertaExito, REGEX_EXITO_ASIGNACION, 8000);
    if (msgExito) {
      console.log(`   ✓ Mensaje de éxito: "${msgExito}"`);
      resultado.subresultados.asignacion = {
        estado: 'PASÓ',
        detalle: `Técnico "${tecnicoElegido}" asignado. Mensaje: "${msgExito}"`
      };
    } else {
      console.log('   ℹ Sin toast visible. Validando cambio en la tabla...');
      resultado.subresultados.asignacion = {
        estado: 'PASÓ',
        detalle: `Técnico "${tecnicoElegido}" asignado (sin toast visible)`
      };
    }

    // Validación 2: estado cambió a ASIGNADO
    console.log('\n   ─── Validación 2: Estado ASIGNADO ───');
    paso = 'Validación 2 – Verificar estado ASIGNADO';

    await driver.sleep(2500);
    const filasActuales = await driver.findElements(SELS.filasTabla[0]);
    let estadoCambiado = false;
    let textoFilaActual = '';

    if (filasActuales.length > pendiente.indice) {
      textoFilaActual = (await filasActuales[pendiente.indice].getText()) || '';
      if (REGEX_ASIGNADO.test(textoFilaActual)) estadoCambiado = true;
    }

    if (!estadoCambiado) {
      for (const fila of filasActuales) {
        const txt = (await fila.getText()) || '';
        if (REGEX_ASIGNADO.test(txt) &&
            (!tecnicoElegido || txt.includes(tecnicoElegido.split(' ')[0]))) {
          estadoCambiado = true;
          textoFilaActual = txt.replace(/\s+/g, ' ').trim();
          break;
        }
      }
    }

    if (estadoCambiado) {
      console.log(`   ✓ Estado ASIGNADO confirmado. Fila: "${textoFilaActual.slice(0, 100)}"`);
      resultado.subresultados.estadoCambiado = { estado: 'PASÓ', detalle: 'Fila muestra estado ASIGNADO' };
    } else {
      resultado.subresultados.estadoCambiado = {
        estado: 'FALLÓ',
        detalle: `La fila no muestra "Asignado". Actual: "${textoFilaActual.slice(0, 100)}"`
      };
    }

    // Validación 3: notificación
    console.log('\n   ─── Validación 3: Notificación ───');
    paso = 'Validación 3 – Notificación';

    let notifDetectada = null;
    try {
      notifDetectada = await driver.executeScript(`
        const textos = document.body.innerText || '';
        const match = textos.match(/(notificaci[oó]n[^.]{0,80}|correo[^.]{0,80}enviado[^.]{0,80}|email[^.]{0,80}enviado[^.]{0,80}|mensaje[^.]{0,80}enviado[^.]{0,80})/i);
        return match ? match[0].trim() : null;
      `);
    } catch (_) {}
    if (!notifDetectada && msgExito && REGEX_NOTIFICACION.test(msgExito)) {
      notifDetectada = msgExito;
    }

    if (notifDetectada) {
      console.log(`   ✓ Notificación visual: "${notifDetectada}"`);
      resultado.subresultados.notificacion = {
        estado: 'PASÓ',
        detalle: `Notificación visual: "${notifDetectada.slice(0, 100)}"`
      };
    } else {
      console.log('   ℹ Sin notificación visual (puede ser por correo → no verificable)');
      resultado.subresultados.notificacion = {
        estado: 'NO_EJECUTADO',
        detalle: 'Sin notificación visual. Puede ser por correo (no verificable desde Selenium)'
      };
    }

    // ---------- Veredicto ----------
    const ok = (
      resultado.subresultados.login.estado === 'PASÓ' &&
      resultado.subresultados.navegacion.estado === 'PASÓ' &&
      resultado.subresultados.solicitudPend.estado === 'PASÓ' &&
      resultado.subresultados.asignacion.estado === 'PASÓ' &&
      resultado.subresultados.estadoCambiado.estado === 'PASÓ'
    );

    resultado.estado  = ok ? 'PASÓ' : 'FALLÓ';
    resultado.detalle = ok
      ? `Solicitud asignada al técnico "${tecnicoElegido}" con estado ASIGNADO`
      : 'Se detectaron fallos en la asignación';

    // ---------- Evidencia ----------
    paso = 'Guardar evidencia';
    if (ok) {
      await guardarEvidencia(driver, EVIDENCIA_PASO_MATRIZ);
      await guardarEvidencia(driver, EVIDENCIA_PASO_EXTRA);
    } else {
      await guardarEvidencia(driver, EVIDENCIA_FALLO);
      if (DEBUG) await dumpPageForDebug(driver, 'FALLO');
    }

  } catch (err) {
    resultado.estado  = 'FALLÓ';
    resultado.detalle = `[${paso}] ${err.message}`;

    if (driver) {
      console.log('\n   🔍 Diagnóstico final:');
      try { await volcarEstructuraUI(driver); } catch (_) {}
      await guardarEvidencia(driver, EVIDENCIA_FALLO);
      if (DEBUG) await dumpPageForDebug(driver, 'ERROR');
    }
  } finally {
    if (driver) {
      try { await driver.quit(); console.log('   ✓ driver.quit() OK'); } catch (_) {}
    }
    resultado.duracion = Date.now() - t0;
  }

  // ---------- Reporte ----------
  const icono = resultado.estado === 'PASÓ' ? '✅' : '❌';
  console.log('\n════════════════════════════════════════════════════');
  console.log(` ${resultado.id} – ${resultado.estado} ${icono}`);
  console.log('────────────────────────────────────────────────────');
  console.log(` [Paso 1] Login admin            → ${resultado.subresultados.login.estado}`);
  console.log(`          ${resultado.subresultados.login.detalle}`);
  console.log(` [Paso 2] Acceso al módulo       → ${resultado.subresultados.navegacion.estado}`);
  console.log(`          ${resultado.subresultados.navegacion.detalle}`);
  console.log(` [Paso 3] Solicitud PENDIENTE    → ${resultado.subresultados.solicitudPend.estado}`);
  console.log(`          ${resultado.subresultados.solicitudPend.detalle}`);
  console.log(` [Paso 4-5] Asignación           → ${resultado.subresultados.asignacion.estado}`);
  console.log(`          ${resultado.subresultados.asignacion.detalle}`);
  console.log(` [Validación] Estado ASIGNADO    → ${resultado.subresultados.estadoCambiado.estado}`);
  console.log(`          ${resultado.subresultados.estadoCambiado.detalle}`);
  console.log(` [Validación] Notificación       → ${resultado.subresultados.notificacion.estado}`);
  console.log(`          ${resultado.subresultados.notificacion.detalle}`);
  console.log('────────────────────────────────────────────────────');
  console.log(` Detalle: ${resultado.detalle}`);
  console.log(` Duración: ${resultado.duracion} ms`);
  console.log('════════════════════════════════════════════════════\n');

  process.exit(resultado.estado === 'PASÓ' ? 0 : 1);
})();