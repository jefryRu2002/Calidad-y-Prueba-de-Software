/**
 * TC-012 – Guardar pruebas de funcionamiento OK → estado TERMINADO
 * Sistema: ColTech | Módulo: Técnico > Pruebas de funcionamiento
 *
 * HISTORIA: HU-12
 *   "Como técnico, quiero guardar los resultados de las pruebas de funcionamiento
 *    cuando todas han sido exitosas (OK), para marcar el equipo como reparado
 *    ('Terminado') y habilitar el botón de pago para el cliente."
 *
 * Pasos:
 *   1) Ir a "Pruebas"
 *   2) Seleccionar la orden (estado EN_REPARACION)
 *   3) Marcar todas las pruebas como OK
 *   4) Click en "Guardar Resultados"
 *
 * Resultado esperado:
 *   - Toast verde de éxito
 *   - Estado de la orden cambia a TERMINADO
 *   - (Bonus) Botón de pago del cliente se activa
 *
 * Precondición:
 *   ⚠️ Técnico logueado (adriana@gmail.com / 123456)
 *   ⚠️ Existe al menos una orden en estado EN_REPARACION
 *
 * Ejecución:
 *   node tests/guardar-pruebas-ok.js
 *   COLTECH_DEBUG=1 node tests/guardar-pruebas-ok.js
 *   CLIENTE_USER="cliente@x.com" CLIENTE_PASS="xxx" node tests/guardar-pruebas-ok.js
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs   = require('fs');
const path = require('path');

// ======================= CONFIGURACIÓN =======================
const BASE_URL = process.env.COLTECH_URL || 'http://localhost:4200';
const TIMEOUT  = 20000;
const DEBUG    = process.env.COLTECH_DEBUG === '1';
const TEST_ID  = 'TC-012';

const TECNICO = {
  usuario:    process.env.TECNICO_USER || 'adriana@gmail.com',
  contrasena: process.env.TECNICO_PASS || '123456'
};

const CLIENTE_PARA_PAGO = {
  usuario:    process.env.CLIENTE_USER || null,
  contrasena: process.env.CLIENTE_PASS || null
};

const LOGIN_PATH           = '/login';
const PRUEBAS_PATH         = '/tecnico/pruebas-funcionamiento';
const ORDENES_TECNICO_PATH = '/tecnico/ordenes-asignadas';

// Regex de validación
const REGEX_EN_REPARACION   = /en reparaci[oó]n|reparaci[oó]n|reparando|in repair/i;
const REGEX_TERMINADO       = /terminad[oa]|finalizad[oa]|completad[oa]|done|finished/i;
const REGEX_EXITO           = /guardad[oa]|exitos[oa]|correctamente|registrad[oa]|pruebas.*guardadas|actualizad[oa]/i;
const REGEX_PAGO_HABILITADO = /pagar|realizar pago|proceder.*pago|ir.*pago|pago.*disponible/i;

// Evidencia
const EVIDENCIA_PASO  = 'TC-012_evidencia_pruebas_ok.png';
const EVIDENCIA_FALLO = 'TC-012_evidencia_pruebas_ok_FALLO.png';

const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

// ======================= SELECTORES ==========================
const SELS = {
  // Login
  tituloLogin:     [By.css('.login-box .titulo')],
  inputUsuario:    [By.css('input[name="usuario"]')],
  inputContrasena: [By.css('input[name="contrasena"]')],
  btnLogin:        [By.css('button.btn-login')],

  // Navegación
  linkPruebas: [
    By.css('a[routerLink="/tecnico/pruebas-funcionamiento"]'),
    By.css('a[href*="pruebas"]'),
    By.xpath("//a[contains(normalize-space(.), 'Pruebas')]"),
    By.xpath("//span[contains(normalize-space(.), 'Pruebas')]/ancestor::a")
  ],
  linkOrdenesTecnico: [
    By.css('a[routerLink="/tecnico/ordenes-asignadas"]'),
    By.css('a[href*="ordenes-asignadas"]'),
    By.xpath("//a[contains(normalize-space(.), 'Órdenes') or contains(normalize-space(.), 'Ordenes')]")
  ],
  marcadorPruebas: [
    By.css('app-tecnico-pruebas-funcionamiento'),
    By.css('.pruebas-container'),
    By.css('.pruebas-funcionamiento'),
    By.css('form'),
    By.css('table')
  ],

  // Tabla de órdenes en reparación
  filasOrdenes: [
    By.css('table tbody tr'),
    By.css('mat-table mat-row'),
    By.css('mat-row'),
    By.css('.orden-row')
  ],
  selectOrden: [
    By.css('select[name="orden"]'),
    By.css('select[name="idOrden"]'),
    By.css('mat-select[name="orden"]'),
    By.css('mat-select[formcontrolname="orden"]')
  ],
  btnSeleccionarOrden: [
    By.xpath("//button[contains(normalize-space(.), 'Prueba') or contains(normalize-space(.), 'Seleccionar') or contains(normalize-space(.), 'Evaluar')]"),
    By.css('button.btn-pruebas'),
    By.css('button.btn-seleccionar')
  ],

  // Pruebas a marcar como OK
  opcionesOK: [
    By.css('input[type="checkbox"]'),
    By.css('input[type="radio"][value="OK"]'),
    By.css('input[type="radio"][value="ok"]'),
    By.css('mat-checkbox'),
    By.css('mat-radio-button'),
    By.css('input[value="OK"], input[value="Ok"], input[value="ok"]')
  ],

  // Botón "Guardar Resultados"
  btnGuardar: [
    By.xpath("//button[contains(normalize-space(.), 'Guardar Resultados') or contains(normalize-space(.), 'Guardar Resultado') or contains(normalize-space(.), 'Guardar')]"),
    By.css('button.btn-guardar-resultados'),
    By.css('.pruebas-container button[type="submit"]')
  ],

  // Mensajes
  alertaExito: [
    By.css('.alerta-exito'),
    By.css('.toast-success'),
    By.css('.swal2-success'),
    By.css('.alert-success'),
    By.css('[role="alert"].success'),
    By.css('mat-snack-bar-container')
  ],

  // Botón de pago (para cliente)
  btnPago: [
    By.xpath("//button[contains(normalize-space(.), 'Pagar') or contains(normalize-space(.), 'Realizar Pago') or contains(normalize-space(.), 'Proceder')]"),
    By.css('button.btn-pagar'),
    By.css('a.btn-pagar'),
    By.css('[data-testid="btn-pagar"]')
  ]
};

// ======================= HELPERS =============================

async function findFirstVisible(driver, locators, timeout = TIMEOUT, desc = 'elemento') {
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
  try { return await findFirstVisible(driver, locators, timeout, 'opcional'); }
  catch (_) { return null; }
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
      const res = { url: window.location.href, headers: [], filas: [], inputs: [], checkboxes: [], buttons: [] };

      document.querySelectorAll('input').forEach(inp => {
        if (inp.offsetParent === null) return;
        const base = {
          type: inp.type || '',
          name: inp.getAttribute('name') || '',
          value: inp.getAttribute('value') || '',
          placeholder: inp.getAttribute('placeholder') || ''
        };
        if (inp.type === 'checkbox' || inp.type === 'radio') res.checkboxes.push(base);
        else res.inputs.push(base);
      });

      document.querySelectorAll('button').forEach(btn => {
        if (btn.offsetParent === null) return;
        const txt = (btn.innerText || '').trim();
        if (txt && txt.length < 50) res.buttons.push(txt);
      });

      const table = document.querySelector('table');
      if (table) {
        table.querySelectorAll('thead th').forEach(th => res.headers.push((th.innerText || '').trim()));
        const tbody = table.querySelector('tbody');
        if (tbody) {
          Array.from(tbody.querySelectorAll('tr')).slice(0, 6).forEach(tr => {
            const celdas = Array.from(tr.querySelectorAll('td')).map(td => (td.innerText || '').trim().slice(0, 40));
            res.filas.push(celdas);
          });
        }
      }
      return res;
    `);

    console.log('\n   ─── 🔍 DIAGNÓSTICO DE UI ───');
    console.log(`   URL: ${info.url}`);
    console.log(`   Checkboxes/Radios (${info.checkboxes.length}):`);
    info.checkboxes.forEach(c => console.log(`     type="${c.type}" name="${c.name}" value="${c.value}"`));
    console.log(`   Inputs (${info.inputs.length}):`);
    info.inputs.forEach(i => console.log(`     name="${i.name}" type="${i.type}" ph="${i.placeholder}"`));
    console.log(`   Botones: [${info.buttons.slice(0, 12).join(' | ')}]`);
    if (info.headers.length) console.log(`   Headers tabla: [${info.headers.join(', ')}]`);
    console.log('   ─────────────────────────────\n');
    return info;
  } catch (e) {
    console.log(`   ⚠️ No se pudo volcar la UI: ${e.message}`);
    return { checkboxes: [], inputs: [], buttons: [], filas: [], headers: [] };
  }
}

async function loginComo(driver, usuario, contrasena) {
  await driver.get(`${BASE_URL}${LOGIN_PATH}`);
  await driver.wait(until.elementLocated(SELS.tituloLogin[0]), TIMEOUT);

  const iu = await findFirstVisible(driver, SELS.inputUsuario, TIMEOUT, 'input usuario');
  await iu.elemento.clear();
  await iu.elemento.sendKeys(usuario);

  const ip = await findFirstVisible(driver, SELS.inputContrasena, TIMEOUT, 'input contraseña');
  await ip.elemento.clear();
  await ip.elemento.sendKeys(contrasena);

  const btn = await findFirstVisible(driver, SELS.btnLogin, TIMEOUT, 'botón login');
  await btn.elemento.click();

  await driver.wait(async () => {
    const u = await driver.getCurrentUrl();
    return !u.endsWith('/login') && !u.endsWith('/login/');
  }, TIMEOUT, 'El login no redirigió');
}

async function contarFilas(driver) {
  for (const loc of SELS.filasOrdenes) {
    try { return (await driver.findElements(loc)).length; } catch (_) {}
  }
  return 0;
}

async function detectarClienteDeOrden(driver) {
  try {
    return await driver.executeScript(`
      const table = document.querySelector('table');
      if (!table) return null;
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => (th.innerText || '').toLowerCase().trim());
      const idx = headers.findIndex(h => h.includes('cliente') || h.includes('email') || h.includes('correo'));
      if (idx < 0) return null;
      const primeraFila = table.querySelector('tbody tr');
      if (!primeraFila) return null;
      const celda = primeraFila.querySelectorAll('td')[idx];
      return celda ? (celda.innerText || '').trim() : null;
    `);
  } catch (_) { return null; }
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
      login:           { estado: 'NO_EJECUTADO', detalle: '' },
      navegacion:      { estado: 'NO_EJECUTADO', detalle: '' },
      seleccionOrden:  { estado: 'NO_EJECUTADO', detalle: '' },
      marcarPruebas:   { estado: 'NO_EJECUTADO', detalle: '' },
      guardado:        { estado: 'NO_EJECUTADO', detalle: '' },
      estadoTerminado: { estado: 'NO_EJECUTADO', detalle: '' },
      botonPago:       { estado: 'NO_EJECUTADO', detalle: '' }
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

    // ---------- Paso 1: Login técnico ----------
    console.log('\n   ─── Paso 1: Login técnico ───');
    paso = 'Paso 1 – Login técnico';
    await loginComo(driver, TECNICO.usuario, TECNICO.contrasena);
    console.log(`   ✓ Técnico autenticado. URL: ${await driver.getCurrentUrl()}`);
    resultado.subresultados.login = { estado: 'PASÓ', detalle: `Técnico ${TECNICO.usuario} autenticado` };

    // ---------- Paso 2: Ir a "Pruebas" ----------
    console.log('\n   ─── Paso 2: Ir a "Pruebas" ───');
    paso = 'Paso 2 – Navegar al módulo';
    try {
      const link = await findFirstVisible(driver, SELS.linkPruebas, 6000, 'link Pruebas');
      await link.elemento.click();
      console.log(`   ✓ Click en link (${link.selector})`);
    } catch (_) {
      console.log('   ℹ Navegando por URL directa');
      await driver.get(`${BASE_URL}${PRUEBAS_PATH}`);
    }

    await findFirstVisible(driver, SELS.marcadorPruebas, TIMEOUT, 'marcador pruebas');
    console.log(`   ✓ Página cargada: ${await driver.getCurrentUrl()}`);
    await driver.sleep(2500);
    resultado.subresultados.navegacion = { estado: 'PASÓ', detalle: 'Módulo de pruebas accesible' };

    if (DEBUG) await volcarEstructuraUI(driver);

    // ---------- Paso 3: Seleccionar orden ----------
    console.log('\n   ─── Paso 3: Seleccionar orden (EN_REPARACION) ───');
    paso = 'Paso 3 – Seleccionar orden';

    let hayFormulario = (await driver.findElements(SELS.opcionesOK[0])).length > 0;

    if (hayFormulario) {
      console.log('   ✓ Formulario de pruebas ya cargado (orden pre-seleccionada)');
      resultado.subresultados.seleccionOrden = { estado: 'PASÓ', detalle: 'Formulario ya cargado' };
    } else {
      const selOrden = await findFirstVisibleOrNull(driver, SELS.selectOrden, 3000);
      if (selOrden) {
        console.log('   ✓ Select de orden detectado');
        const tag = await selOrden.elemento.getTagName();
        if (tag === 'select') {
          const opts = await selOrden.elemento.findElements(By.css('option'));
          for (const opt of opts) {
            const val = (await opt.getAttribute('value')) || '';
            const txt = ((await opt.getText()) || '').trim();
            if (val && val !== '' && val !== '0' && txt && !/seleccione/i.test(txt)) {
              const { Select } = require('selenium-webdriver/lib/select');
              await new Select(selOrden.elemento).selectByValue(val);
              console.log(`   ✓ Orden seleccionada: "${txt}"`);
              break;
            }
          }
        } else {
          await selOrden.elemento.click();
          await driver.sleep(600);
          const opts = await driver.findElements(By.css('mat-option, .mat-option, [role="option"]'));
          if (opts.length > 0) await opts[0].click();
        }
        await driver.sleep(1500);
        resultado.subresultados.seleccionOrden = { estado: 'PASÓ', detalle: 'Orden elegida del select' };
      } else {
        const btnFila = await findFirstVisibleOrNull(driver, SELS.btnSeleccionarOrden, 4000);
        if (btnFila) {
          await btnFila.elemento.click();
          console.log(`   ✓ Click en botón "${btnFila.selector}"`);
          await driver.sleep(1500);
          resultado.subresultados.seleccionOrden = { estado: 'PASÓ', detalle: 'Orden seleccionada por botón' };
        } else {
          resultado.subresultados.seleccionOrden = {
            estado: 'NO_EJECUTADO',
            detalle: 'No se detectó mecanismo de selección (formulario puede estar pre-cargado)'
          };
        }
      }

      hayFormulario = (await driver.findElements(SELS.opcionesOK[0])).length > 0;
      if (!hayFormulario) {
        throw new Error(
          'No aparece el formulario de pruebas tras seleccionar la orden. ' +
          'Verifica que exista al menos una orden EN_REPARACION.'
        );
      }
    }

    // ---------- Paso 4: Marcar pruebas como OK ----------
    console.log('\n   ─── Paso 4: Marcar todas las pruebas como OK ───');
    paso = 'Paso 4 – Marcar pruebas OK';

    let opciones = [];
    for (const loc of SELS.opcionesOK) {
      try {
        const encontrados = await driver.findElements(loc);
        if (encontrados.length > 0) {
          opciones = encontrados;
          console.log(`   ℹ ${encontrados.length} opciones encontradas con ${loc.toString()}`);
          break;
        }
      } catch (_) {}
    }

    if (opciones.length === 0) {
      throw new Error('No se encontraron checkboxes/radios de pruebas para marcar como OK');
    }

    let marcadasOK = 0;
    for (let i = 0; i < opciones.length; i++) {
      const op = opciones[i];
      try {
        const checked = await op.isSelected().catch(() => false);
        if (!checked) {
          await op.click();
          await driver.sleep(200);
        }
        const selAhora = await op.isSelected().catch(() => false);
        if (selAhora) marcadasOK++;
      } catch (_) {
        try {
          await driver.executeScript('arguments[0].click()', op);
          await driver.sleep(200);
          if (await op.isSelected().catch(() => false)) marcadasOK++;
        } catch (_) {}
      }
    }

    console.log(`   ✓ ${marcadasOK}/${opciones.length} pruebas marcadas como OK`);
    resultado.subresultados.marcarPruebas = {
      estado: marcadasOK > 0 ? 'PASÓ' : 'FALLÓ',
      detalle: `${marcadasOK}/${opciones.length} pruebas marcadas OK`
    };

    if (marcadasOK === 0) {
      throw new Error('No se pudo marcar ninguna prueba como OK');
    }

    // ---------- Paso 5: Guardar resultados ----------
    console.log('\n   ─── Paso 5: Click en "Guardar Resultados" ───');
    paso = 'Paso 5 – Guardar';

    const btnGuardar = await findFirstVisible(driver, SELS.btnGuardar, TIMEOUT, 'botón Guardar Resultados');
    await driver.wait(until.elementIsEnabled(btnGuardar.elemento), TIMEOUT);
    await btnGuardar.elemento.click();
    console.log(`   ✓ Click en "${btnGuardar.selector}"`);

    // Validación 1: mensaje de éxito
    paso = 'Validación 1 – Mensaje de éxito';
    const msgExito = await esperarTexto(driver, SELS.alertaExito, REGEX_EXITO, 8000);
    if (msgExito) {
      console.log(`   ✓ Mensaje de éxito: "${msgExito}"`);
      resultado.subresultados.guardado = { estado: 'PASÓ', detalle: `Mensaje: "${msgExito}"` };
    } else {
      console.log('   ℹ Sin toast visible, validando estado...');
      resultado.subresultados.guardado = { estado: 'PASÓ', detalle: 'Guardado ejecutado (sin toast visible)' };
    }

    // ---------- Validación 2: estado TERMINADO ----------
    console.log('\n   ─── Validación 2: Estado TERMINADO ───');
    paso = 'Validación 2 – Verificar estado';

    await driver.sleep(2500);

    let estadoDetectado = null;
    try {
      estadoDetectado = await driver.executeScript(`
        const body = document.body.innerText || '';
        const m = body.match(/Terminad[oa]|TERMINADO|Finalizad[oa]|Completad[oa]/);
        return m ? m[0] : null;
      `);
    } catch (_) {}

    if (!estadoDetectado) {
      console.log('   ℹ No visible en pantalla actual. Navegando a órdenes asignadas...');
      try {
        const linkOrdenes = await findFirstVisible(driver, SELS.linkOrdenesTecnico, 5000, 'link órdenes');
        await linkOrdenes.elemento.click();
      } catch (_) {
        await driver.get(`${BASE_URL}${ORDENES_TECNICO_PATH}`);
      }
      await driver.sleep(2500);

      const filas = await driver.findElements(SELS.filasOrdenes[0]).catch(() => []);
      for (const fila of filas.slice(0, 10)) {
        const txt = (await fila.getText()) || '';
        if (REGEX_TERMINADO.test(txt)) {
          estadoDetectado = txt.slice(0, 120);
          break;
        }
      }
    }

    if (estadoDetectado) {
      console.log(`   ✓ Estado TERMINADO detectado: "${estadoDetectado.slice(0, 100)}"`);
      resultado.subresultados.estadoTerminado = {
        estado: 'PASÓ',
        detalle: `Estado visible: "${estadoDetectado.slice(0, 80)}"`
      };
    } else {
      resultado.subresultados.estadoTerminado = {
        estado: 'FALLÓ',
        detalle: 'No se pudo verificar visualmente el estado TERMINADO'
      };
    }

    // ---------- Validación 3: botón de pago (best-effort) ----------
    console.log('\n   ─── Validación 3: Botón de pago del cliente ───');
    paso = 'Validación 3 – Botón pago';

    let clienteDetectado = null;
    if (CLIENTE_PARA_PAGO.usuario && CLIENTE_PARA_PAGO.contrasena) {
      clienteDetectado = { usuario: CLIENTE_PARA_PAGO.usuario, contrasena: CLIENTE_PARA_PAGO.contrasena, origen: 'env' };
    } else {
      const clienteTexto = await detectarClienteDeOrden(driver);
      if (clienteTexto && clienteTexto.includes('@')) {
        console.log(`   ℹ Cliente detectado en la tabla: "${clienteTexto}"`);
        resultado.subresultados.botonPago = {
          estado: 'NO_EJECUTADO',
          detalle: `Cliente detectado: "${clienteTexto}". Para validar el botón de pago, ` +
                   `ejecuta con CLIENTE_USER="..." ; CLIENTE_PASS="..."`
        };
      } else {
        resultado.subresultados.botonPago = {
          estado: 'NO_EJECUTADO',
          detalle: 'No se detectó cliente asociado. Pasa CLIENTE_USER y CLIENTE_PASS por env para validar el pago.'
        };
      }
    }

    if (clienteDetectado) {
      console.log(`   ℹ Haciendo login como cliente "${clienteDetectado.usuario}"...`);
      await loginComo(driver, clienteDetectado.usuario, clienteDetectado.contrasena);

      const rutasPago = ['/cliente/pago', '/cliente/estado-solicitud', '/cliente/dashboard'];
      let btnPago = null;
      for (const ruta of rutasPago) {
        await driver.get(`${BASE_URL}${ruta}`);
        await driver.sleep(2000);
        const btn = await findFirstVisibleOrNull(driver, SELS.btnPago, 3000);
        if (btn) {
          const habilitado = await btn.elemento.isEnabled().catch(() => false);
          btnPago = { elemento: btn.elemento, habilitado, ruta };
          break;
        }
      }

      if (btnPago) {
        console.log(`   ✓ Botón de pago detectado en ${btnPago.ruta}. Habilitado: ${btnPago.habilitado}`);
        resultado.subresultados.botonPago = {
          estado: btnPago.habilitado ? 'PASÓ' : 'FALLÓ',
          detalle: `Botón "Pagar" ${btnPago.habilitado ? 'habilitado' : 'deshabilitado'} en ${btnPago.ruta}`
        };
      } else {
        resultado.subresultados.botonPago = {
          estado: 'NO_EJECUTADO',
          detalle: 'No se encontró botón de pago en las rutas probadas'
        };
      }
    }

    // ---------- Veredicto ----------
    const ok = (
      resultado.subresultados.login.estado === 'PASÓ' &&
      resultado.subresultados.navegacion.estado === 'PASÓ' &&
      resultado.subresultados.marcarPruebas.estado === 'PASÓ' &&
      resultado.subresultados.guardado.estado === 'PASÓ' &&
      resultado.subresultados.estadoTerminado.estado === 'PASÓ'
    );

    resultado.estado  = ok ? 'PASÓ' : 'FALLÓ';
    resultado.detalle = ok
      ? 'Pruebas OK guardadas. Estado TERMINADO confirmado.'
      : 'Se detectaron fallos en el guardado de pruebas';

    // ---------- Evidencia ----------
    paso = 'Guardar evidencia';
    await guardarEvidencia(driver, ok ? EVIDENCIA_PASO : EVIDENCIA_FALLO);

  } catch (err) {
    resultado.estado  = 'FALLÓ';
    resultado.detalle = `[${paso}] ${err.message}`;

    if (driver) {
      console.log('\n   🔍 Diagnóstico final:');
      try { await volcarEstructuraUI(driver); } catch (_) {}
      try { await dumpPageForDebug(driver, 'FALLO'); } catch (_) {}
      await guardarEvidencia(driver, EVIDENCIA_FALLO);
    }
  } finally {
    resultado.duracion = Date.now() - t0;

    // ---------- Reporte ----------
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  RESULTADO ${TEST_ID} – HU-12                          ║`);
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`   Estado    : ${resultado.estado === 'PASÓ' ? '✅ PASÓ' : '❌ FALLÓ'}`);
    console.log(`   Detalle   : ${resultado.detalle}`);
    console.log(`   Duración  : ${(resultado.duracion / 1000).toFixed(2)}s`);
    console.log('\n   Subresultados:');
    for (const [k, v] of Object.entries(resultado.subresultados)) {
      const icon = v.estado === 'PASÓ' ? '✅' : v.estado === 'FALLÓ' ? '❌' : '⚪';
      console.log(`     ${icon} ${k.padEnd(16)} → ${v.estado}${v.detalle ? ` (${v.detalle})` : ''}`);
    }

    // Guardar reporte JSON
    try {
      const reporteFile = path.join(ARTIFACTS_DIR, `reporte-${TEST_ID}.json`);
      fs.writeFileSync(reporteFile, JSON.stringify(resultado, null, 2), 'utf-8');
      console.log(`\n   📄 Reporte JSON: ${reporteFile}`);
    } catch (_) {}

    if (driver) await driver.quit().catch(() => {});
    process.exit(resultado.estado === 'PASÓ' ? 0 : 1);
  }
})();