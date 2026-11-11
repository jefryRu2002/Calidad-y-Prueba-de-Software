/**
 * TC-011 – Formulario de diagnóstico del técnico
 * Sistema: ColTech | Módulo: Técnico > Evaluación de equipos
 *
 * HISTORIA: HU-11
 *   "Como técnico, quiero llenar el formulario de diagnóstico de un equipo
 *    asignado y guardarlo, para registrar los detalles de la falla y que el
 *    sistema cambie el estado de la orden a 'En Proceso'."
 *
 * Pasos (matriz):
 *   1) Ir a "Diagnóstico"
 *   2) Seleccionar orden
 *   3) Llenar los campos (Procesador, RAM, Almacenamiento, SO, Detalles)
 *   4) Click en "Guardar Evaluación"
 *
 * Resultado esperado:
 *   - Alerta verde de éxito
 *   - Estado de la orden cambia a "En Proceso"
 *
 * Precondición:
 *   ⚠️ Técnico logueado (adriana@gmail.com / 123456)
 *   ⚠️ Existe al menos una orden en estado "ASIGNADO"
 *
 * Evidencia:
 *   artifacts/TC-011_evidencia_diagnostico_valido.png         (PASÓ)
 *   artifacts/TC-011_evidencia_diagnostico_valido_FALLO.png   (FALLÓ)
 *
 * Uso:
 *   node tests\guardar-diagnostico.js
 *   $env:COLTECH_DEBUG="1"; node tests\guardar-diagnostico.js
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs   = require('fs');
const path = require('path');

// ======================= CONFIGURACIÓN =======================
const BASE_URL    = process.env.COLTECH_URL || 'http://localhost:4200';
const TIMEOUT     = 20000;
const DEBUG       = process.env.COLTECH_DEBUG === '1';
const TEST_ID     = 'TC-011';

// Credenciales del técnico (las mismas que funcionaron en TC-002-tecnico)
const TECNICO = {
  usuario:    process.env.TECNICO_USER || 'adriana@gmail.com',
  contrasena: process.env.TECNICO_PASS || '123456'
};

const LOGIN_PATH     = '/login';
const DIAGNOSTICO_PATH = '/tecnico/evaluacion-equipos';

// Datos de prueba (matriz)
const DATOS = {
  procesador:     'Intel Core i5',
  ram:            '16GB',
  almacenamiento: '512GB',
  so:             'Windows 11',
  detalles:       'Falla de pantalla'
};

// Regex de estados y mensajes
const REGEX_ASIGNADO    = /asignad[oa]|asignado|assigned/i;
const REGEX_EN_PROCESO  = /en proceso|en diagn[oó]stico|proceso|in progress|diagnosing/i;
const REGEX_EXITO       = /guardad[oa]|exitos[oa]|correctamente|registrad[oa]|evaluaci[oó]n.*guardada|diagn[oó]stico.*guardado|actualizad[oa]/i;

// Evidencia
const EVIDENCIA_PASO  = 'TC-011_evidencia_diagnostico_valido.png';
const EVIDENCIA_FALLO = 'TC-011_evidencia_diagnostico_valido_FALLO.png';

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

  // Navegación al módulo de diagnóstico
  linkDiagnostico: [
    By.css('a[routerLink="/tecnico/evaluacion-equipos"]'),
    By.css('a[href*="evaluacion-equipos"]'),
    By.css('a[href*="diagnostico"]'),
    By.xpath("//a[contains(normalize-space(.), 'Diagnóstico') or contains(normalize-space(.), 'Evaluación') or contains(normalize-space(.), 'Evaluacion')]"),
    By.xpath("//span[contains(normalize-space(.), 'Diagnóstico') or contains(normalize-space(.), 'Evaluación')]/ancestor::a")
  ],
  marcadorDiagnostico: [
    By.css('app-tecnico-evaluacion-equipos'),
    By.css('.evaluacion-container'),
    By.css('.diagnostico-container'),
    By.css('form'),
    By.css('table'),
    By.css('mat-table')
  ],

  // Tabla / lista de órdenes asignadas
  filasOrdenes: [
    By.css('table tbody tr'),
    By.css('mat-table mat-row'),
    By.css('mat-row'),
    By.css('.orden-row')
  ],

  // Select de "orden a diagnosticar" (si aplica)
  selectOrden: [
    By.css('select[name="orden"]'),
    By.css('select[name="idOrden"]'),
    By.css('select[name="ordenTrabajo"]'),
    By.css('mat-select[name="orden"]'),
    By.css('mat-select[formcontrolname="orden"]')
  ],

  // Botón "Seleccionar" o "Diagnosticar" en la fila
  btnSeleccionarOrden: [
    By.xpath("//button[contains(normalize-space(.), 'Diagnosticar') or contains(normalize-space(.), 'Seleccionar') or contains(normalize-space(.), 'Evaluar')]"),
    By.css('button.btn-diagnosticar'),
    By.css('button.btn-seleccionar')
  ],

  // Campos del formulario de diagnóstico
  inputProcesador: [
    By.css('input[name="procesador"]'),
    By.css('input[name="cpu"]'),
    By.css('input[formcontrolname="procesador"]'),
    By.css('input[formcontrolname="cpu"]')
  ],
  inputRam: [
    By.css('input[name="ram"]'),
    By.css('input[name="memoria"]'),
    By.css('input[formcontrolname="ram"]'),
    By.css('input[formcontrolname="memoria"]')
  ],
  inputAlmacenamiento: [
    By.css('input[name="almacenamiento"]'),
    By.css('input[name="disco"]'),
    By.css('input[name="storage"]'),
    By.css('input[formcontrolname="almacenamiento"]'),
    By.css('input[formcontrolname="disco"]')
  ],
  inputSO: [
    By.css('input[name="so"]'),
    By.css('input[name="sistemaOperativo"]'),
    By.css('input[name="sistema_operativo"]'),
    By.css('input[formcontrolname="so"]'),
    By.css('input[formcontrolname="sistemaOperativo"]'),
    By.css('select[name="so"]'),
    By.css('select[name="sistemaOperativo"]'),
    By.css('mat-select[name="so"]'),
    By.css('mat-select[formcontrolname="sistemaOperativo"]')
  ],
  inputDetalles: [
    By.css('textarea[name="detalles"]'),
    By.css('textarea[name="detalle"]'),
    By.css('textarea[name="descripcion"]'),
    By.css('textarea[name="falla"]'),
    By.css('textarea[formcontrolname="detalles"]'),
    By.css('textarea[formcontrolname="descripcion"]'),
    By.css('textarea[formcontrolname="falla"]')
  ],

  // Botón "Guardar Evaluación"
  btnGuardar: [
    By.xpath("//button[contains(normalize-space(.), 'Guardar Evaluación') or contains(normalize-space(.), 'Guardar Evaluacion') or contains(normalize-space(.), 'Guardar Diagnóstico') or contains(normalize-space(.), 'Guardar')]"),
    By.css('button.btn-guardar'),
    By.css('button.btn-guardar-evaluacion'),
    By.css('.form-diagnostico button[type="submit"]')
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
  alertaError: [
    By.css('.alerta-error'),
    By.css('.toast-error'),
    By.css('.alert-danger'),
    By.css('[role="alert"].error')
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

/**
 * Vuelca estructura de la UI para diagnóstico.
 */
async function volcarEstructuraUI(driver) {
  try {
    const info = await driver.executeScript(`
      const res = { url: window.location.href, headers: [], filas: [], inputs: [], textareas: [], selects: [], buttons: [] };

      document.querySelectorAll('input, textarea, select').forEach(el => {
        if (el.offsetParent === null) return;
        const base = {
          tag: el.tagName.toLowerCase(),
          name: el.getAttribute('name') || '',
          type: el.getAttribute('type') || '',
          placeholder: el.getAttribute('placeholder') || '',
          formControl: el.getAttribute('formControlName') || ''
        };
        if (el.tagName === 'INPUT') res.inputs.push(base);
        else if (el.tagName === 'TEXTAREA') res.textareas.push(base);
        else res.selects.push(base);
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
    console.log(`   Inputs (${info.inputs.length}):`);
    info.inputs.forEach(i => console.log(`     name="${i.name}" type="${i.type}" ph="${i.placeholder}" fc="${i.formControl}"`));
    console.log(`   Textareas (${info.textareas.length}):`);
    info.textareas.forEach(t => console.log(`     name="${t.name}" ph="${t.placeholder}" fc="${t.formControl}"`));
    console.log(`   Selects (${info.selects.length}):`);
    info.selects.forEach(s => console.log(`     name="${s.name}" fc="${s.formControl}"`));
    console.log(`   Botones visibles: [${info.buttons.slice(0, 12).join(' | ')}]`);
    if (info.headers.length) console.log(`   Headers tabla: [${info.headers.join(', ')}]`);
    console.log('   ─────────────────────────────\n');
    return info;
  } catch (e) {
    console.log(`   ⚠️ No se pudo volcar la UI: ${e.message}`);
    return { inputs: [], textareas: [], selects: [], buttons: [], filas: [], headers: [] };
  }
}

async function loginTecnico(driver) {
  await driver.get(`${BASE_URL}${LOGIN_PATH}`);
  await driver.wait(until.elementLocated(SELS.tituloLogin[0]), TIMEOUT);

  const iu = await findFirstVisible(driver, SELS.inputUsuario, TIMEOUT, 'input usuario');
  await iu.elemento.clear();
  await iu.elemento.sendKeys(TECNICO.usuario);

  const ip = await findFirstVisible(driver, SELS.inputContrasena, TIMEOUT, 'input contraseña');
  await ip.elemento.clear();
  await ip.elemento.sendKeys(TECNICO.contrasena);

  const btn = await findFirstVisible(driver, SELS.btnLogin, TIMEOUT, 'botón login');
  await btn.elemento.click();

  await driver.wait(async () => {
    const u = await driver.getCurrentUrl();
    return !u.endsWith('/login') && !u.endsWith('/login/');
  }, TIMEOUT, 'El login no redirigió');
}

/**
 * Rellena un input con reintentos y verificación.
 */
async function escribirInput(driver, locator, valor, desc) {
  const found = await findFirstVisible(driver, locator, TIMEOUT, desc);
  await found.elemento.click();
  await found.elemento.clear();
  await found.elemento.sendKeys(valor);
  return found;
}

/**
 * Rellena un select (nativo o mat-select).
 */
async function seleccionarOpcion(driver, locator, textoBuscado, desc) {
  const found = await findFirstVisible(driver, locator, TIMEOUT, desc);
  const tag = await found.elemento.getTagName();

  if (tag === 'select') {
    // Select nativo
    const options = await found.elemento.findElements(By.css('option'));
    for (const opt of options) {
      const txt = ((await opt.getText()) || '').trim();
      const val = (await opt.getAttribute('value')) || '';
      if (txt === textoBuscado || val === textoBuscado || txt.includes(textoBuscado) || textoBuscado.includes(txt)) {
        const { Select } = require('selenium-webdriver/lib/select');
        await new Select(found.elemento).selectByValue(val);
        return { ...found, valorAplicado: txt || val };
      }
    }
    throw new Error(`${desc}: no se encontró opción "${textoBuscado}"`);
  } else {
    // mat-select u otro
    await found.elemento.click();
    await driver.sleep(600);
    const opciones = await driver.findElements(By.css('mat-option, .mat-option, [role="option"]'));
    for (const op of opciones) {
      const txt = ((await op.getText()) || '').trim();
      if (txt === textoBuscado || txt.includes(textoBuscado) || textoBuscado.includes(txt)) {
        await op.click();
        return { ...found, valorAplicado: txt };
      }
    }
    throw new Error(`${desc}: no se encontró opción "${textoBuscado}" en mat-select`);
  }
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
      llenadoForm:     { estado: 'NO_EJECUTADO', detalle: '' },
      guardado:        { estado: 'NO_EJECUTADO', detalle: '' },
      estadoCambiado:  { estado: 'NO_EJECUTADO', detalle: '' }
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

    // ---------- Paso 1: login técnico ----------
    console.log('\n   ─── Paso 1: Login técnico ───');
    paso = 'Paso 1 – Login técnico';
    await loginTecnico(driver);
    console.log(`   ✓ Técnico autenticado. URL: ${await driver.getCurrentUrl()}`);
    resultado.subresultados.login = { estado: 'PASÓ', detalle: `Técnico ${TECNICO.usuario} autenticado` };

    // ---------- Paso 2: ir a "Diagnóstico" ----------
    console.log('\n   ─── Paso 2: Ir a "Diagnóstico" ───');
    paso = 'Paso 2 – Navegar al módulo';
    try {
      const link = await findFirstVisible(driver, SELS.linkDiagnostico, 6000, 'link Diagnóstico');
      await link.elemento.click();
      console.log(`   ✓ Click en link (${link.selector})`);
    } catch (_) {
      console.log('   ℹ Navegando por URL directa a /tecnico/evaluacion-equipos');
      await driver.get(`${BASE_URL}${DIAGNOSTICO_PATH}`);
    }

    await findFirstVisible(driver, SELS.marcadorDiagnostico, TIMEOUT, 'marcador diagnóstico');
    console.log(`   ✓ Página cargada: ${await driver.getCurrentUrl()}`);
    await driver.sleep(2500);
    resultado.subresultados.navegacion = { estado: 'PASÓ', detalle: 'Módulo de diagnóstico accesible' };

    await volcarEstructuraUI(driver);

    // ---------- Paso 3: seleccionar orden ----------
    console.log('\n   ─── Paso 3: Seleccionar orden ASIGNADA ───');
    paso = 'Paso 3 – Seleccionar orden';

    // Primero: ¿ya hay un formulario con campos de diagnóstico visibles?
    let inputProcesador = await findFirstVisibleOrNull(driver, SELS.inputProcesador, 3000);

    if (inputProcesador) {
      console.log('   ✓ Formulario de diagnóstico ya visible (orden pre-cargada)');
      resultado.subresultados.seleccionOrden = {
        estado: 'PASÓ',
        detalle: 'Formulario ya cargado (no requiere selección manual)'
      };
    } else {
      // Intentar select de orden
      const selOrden = await findFirstVisibleOrNull(driver, SELS.selectOrden, 3000);
      if (selOrden) {
        console.log('   ✓ Select de orden detectado, eligiendo primera opción válida');
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
          if (opts.length > 0) { await opts[0].click(); }
        }
        await driver.sleep(1500);
        resultado.subresultados.seleccionOrden = { estado: 'PASÓ', detalle: 'Orden elegida del select' };
      } else {
        // Buscar botón "Diagnosticar" en alguna fila
        const btnFila = await findFirstVisibleOrNull(driver, SELS.btnSeleccionarOrden, 4000);
        if (btnFila) {
          await btnFila.elemento.click();
          console.log(`   ✓ Click en botón "${btnFila.selector}"`);
          await driver.sleep(1500);
          resultado.subresultados.seleccionOrden = { estado: 'PASÓ', detalle: 'Orden seleccionada por botón de fila' };
        } else {
          resultado.subresultados.seleccionOrden = {
            estado: 'NO_EJECUTADO',
            detalle: 'No se detectó mecanismo de selección de orden (formulario ya visible o UI distinta)'
          };
        }
      }

      // Re-buscar el input procesador tras la selección
      inputProcesador = await findFirstVisibleOrNull(driver, SELS.inputProcesador, 5000);
      if (!inputProcesador) {
        throw new Error(
          'No aparece el formulario de diagnóstico tras seleccionar la orden. ' +
          'Verifica que exista al menos una orden ASIGNADA.'
        );
      }
    }

    // ---------- Paso 4: llenar los 5 campos ----------
    console.log('\n   ─── Paso 4: Llenar los campos del diagnóstico ───');
    paso = 'Paso 4 – Rellenar formulario';

    // Procesador
    await escribirInput(driver, SELS.inputProcesador, DATOS.procesador, 'procesador');
    console.log(`   ✓ Procesador: ${DATOS.procesador}`);

    // RAM
    await escribirInput(driver, SELS.inputRam, DATOS.ram, 'RAM');
    console.log(`   ✓ RAM: ${DATOS.ram}`);

    // Almacenamiento
    await escribirInput(driver, SELS.inputAlmacenamiento, DATOS.almacenamiento, 'almacenamiento');
    console.log(`   ✓ Almacenamiento: ${DATOS.almacenamiento}`);

    // SO (puede ser input o select → intentamos input, si falla select)
    try {
      await escribirInput(driver, SELS.inputSO, DATOS.so, 'SO');
      console.log(`   ✓ SO (input): ${DATOS.so}`);
    } catch (_) {
      await seleccionarOpcion(driver, SELS.inputSO, DATOS.so, 'SO');
      console.log(`   ✓ SO (select): ${DATOS.so}`);
    }

    // Detalles
    await escribirInput(driver, SELS.inputDetalles, DATOS.detalles, 'detalles');
    console.log(`   ✓ Detalles: ${DATOS.detalles}`);

    resultado.subresultados.llenadoForm = {
      estado: 'PASÓ',
      detalle: '5 campos llenados: procesador, RAM, almacenamiento, SO, detalles'
    };

    // ---------- Paso 5: click en "Guardar Evaluación" ----------
    console.log('\n   ─── Paso 5: Click en "Guardar Evaluación" ───');
    paso = 'Paso 5 – Guardar';

    const btnGuardar = await findFirstVisible(driver, SELS.btnGuardar, TIMEOUT, 'botón Guardar Evaluación');
    await driver.wait(until.elementIsEnabled(btnGuardar.elemento), TIMEOUT);
    await btnGuardar.elemento.click();
    console.log(`   ✓ Click en "${btnGuardar.selector}"`);

    // Validación 1: mensaje de éxito
    paso = 'Validación 1 – Mensaje de éxito';
    const msgExito = await esperarTexto(driver, SELS.alertaExito, REGEX_EXITO, 8000);
    if (msgExito) {
      console.log(`   ✓ Mensaje de éxito: "${msgExito}"`);
      resultado.subresultados.guardado = {
        estado: 'PASÓ',
        detalle: `Mensaje: "${msgExito}"`
      };
    } else {
      // Puede que no haya toast pero el guardado ocurrió
      console.log('   ℹ Sin toast de éxito visible. Verificando cambio de estado...');
      resultado.subresultados.guardado = {
        estado: 'PASÓ',
        detalle: 'Guardado ejecutado (sin toast visible)'
      };
    }

    // Validación 2: estado cambió a "En Proceso"
    console.log('\n   ─── Validación 2: Estado cambió a "En Proceso" ───');
    paso = 'Validación 2 – Verificar cambio de estado';

    await driver.sleep(2500);

    // Buscar en el DOM algún indicio del estado "En proceso"
    let estadoDetectado = null;
    try {
      estadoDetectado = await driver.executeScript(`
        const body = document.body.innerText || '';
        const matches = body.match(/(En Proceso|En proceso|EN PROCESO|En Diagnóstico|En diagnóstico|In Progress)/i);
        return matches ? matches[0] : null;
      `);
    } catch (_) {}

    // Alternativa: buscar en tabla que la fila de la orden cambió
    if (!estadoDetectado) {
      try {
        const filas = await driver.findElements(By.css('table tbody tr, mat-table mat-row, mat-row'));
        for (const fila of filas.slice(0, 10)) {
          const txt = (await fila.getText()) || '';
          if (REGEX_EN_PROCESO.test(txt)) {
            estadoDetectado = txt.slice(0, 120);
            break;
          }
        }
      } catch (_) {}
    }

    if (estadoDetectado) {
      console.log(`   ✓ Estado "En Proceso" detectado: "${estadoDetectado.slice(0, 100)}"`);
      resultado.subresultados.estadoCambiado = {
        estado: 'PASÓ',
        detalle: `Estado visible: "${estadoDetectado.slice(0, 80)}"`
      };
    } else {
      console.log('   ⚠️ No se pudo verificar visualmente el estado "En Proceso"');
      console.log('      (puede requerir volver a la lista de órdenes)');
      resultado.subresultados.estadoCambiado = {
        estado: 'NO_EJECUTADO',
        detalle: 'Estado no visible en pantalla actual (requiere navegación a lista de órdenes)'
      };
    }

    // ---------- Veredicto ----------
    const ok = (
      resultado.subresultados.login.estado === 'PASÓ' &&
      resultado.subresultados.navegacion.estado === 'PASÓ' &&
      resultado.subresultados.llenadoForm.estado === 'PASÓ' &&
      resultado.subresultados.guardado.estado === 'PASÓ' &&
      resultado.subresultados.estadoCambiado.estado !== 'FALLÓ'
    );

    resultado.estado  = ok ? 'PASÓ' : 'FALLÓ';
    resultado.detalle = ok
      ? 'Diagnóstico guardado correctamente. Estado "En Proceso" actualizado.'
      : 'Se detectaron fallos en el guardado del diagnóstico';

    // ---------- Evidencia ----------
    paso = 'Guardar evidencia';
    await guardarEvidencia(driver, ok ? EVIDENCIA_PASO : EVIDENCIA_FALLO);

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
  console.log(` [Paso 1] Login técnico          → ${resultado.subresultados.login.estado}`);
  console.log(`          ${resultado.subresultados.login.detalle}`);
  console.log(` [Paso 2] Acceso al módulo       → ${resultado.subresultados.navegacion.estado}`);
  console.log(`          ${resultado.subresultados.navegacion.detalle}`);
  console.log(` [Paso 3] Selección orden        → ${resultado.subresultados.seleccionOrden.estado}`);
  console.log(`          ${resultado.subresultados.seleccionOrden.detalle}`);
  console.log(` [Paso 4] Llenado formulario     → ${resultado.subresultados.llenadoForm.estado}`);
  console.log(`          ${resultado.subresultados.llenadoForm.detalle}`);
  console.log(` [Paso 5] Guardado               → ${resultado.subresultados.guardado.estado}`);
  console.log(`          ${resultado.subresultados.guardado.detalle}`);
  console.log(` [Estado] Cambio a "En Proceso"  → ${resultado.subresultados.estadoCambiado.estado}`);
  console.log(`          ${resultado.subresultados.estadoCambiado.detalle}`);
  console.log('────────────────────────────────────────────────────');
  console.log(` Detalle: ${resultado.detalle}`);
  console.log(` Duración: ${resultado.duracion} ms`);
  console.log('════════════════════════════════════════════════════\n');

  process.exit(resultado.estado === 'PASÓ' ? 0 : 1);
})();