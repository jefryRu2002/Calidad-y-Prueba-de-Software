/**
 * TC-005 – Registro con campos obligatorios vacíos y correo duplicado
 * Sistema: ColTech | Módulo: Registro de clientes
 *
 * Este script valida 3 sub-casos que juntos cubren los criterios
 * de aceptación de la matriz TC-005:
 *
 *   [5A]  Campos vacíos → submit bloqueado (no se envía al backend)
 *   [5A2] Campos vacíos → algún texto de error visible en el DOM
 *   [5B]  Correo duplicado → backend rechaza y muestra .alerta-error
 *
 * Datos de prueba (matriz):
 *   DNI: 09087898 | Correo: fmaria@gmail.com (⚠️ debe existir en BD)
 *   Tel: 908239349 | Fecha: 20/03/1990 | Pass: 123456
 *
 * Evidencia:
 *   artifacts/TC-005_evidencia_registro_error.png          (PASÓ)
 *   artifacts/TC-005_evidencia_registro_error_FALLO.png    (FALLÓ)
 *
 * Uso:
 *   node tests\registro-validaciones.js
 *   $env:COLTECH_DEBUG="1"; node tests\registro-validaciones.js
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs   = require('fs');
const path = require('path');

// ======================= CONFIGURACIÓN =======================
const BASE_URL    = process.env.COLTECH_URL || 'http://localhost:4200';
const TIMEOUT     = 20000;
const DEBUG       = process.env.COLTECH_DEBUG === '1';
const TEST_ID     = 'TC-005';

// Datos de la matriz
const DATOS = {
  dni:        '09087898',
  correo:     'fmaria@gmail.com',     // ⚠️ debe existir en BD
  telefono:   '908239349',
  fechaDia:   '20',
  fechaMes:   '03',
  fechaAnio:  '1990',
  fechaISO:   '1990-03-20',
  fechaCmp:   '20031990',
  contrasena: '123456',
  confirmar:  '123456'
};

// Patrones de validación del mensaje de correo duplicado
// (acepta cualquiera de las variantes que tu backend pueda devolver)
const REGEX_CORREO_DUP = /correo.*(registrado|existe|duplicado|utilizado)|(registrado|existe|duplicado|utilizado).*correo/i;

// Patrones de "campo obligatorio" para el sub-caso 5A2
const REGEX_OBLIGATORIO = /obligatori|requerid|required|no puede (estar|ser)|vac[íi]o|rellena/i;

// Evidencia
const EVIDENCIA_PASO  = 'TC-005_evidencia_registro_error.png';
const EVIDENCIA_FALLO = 'TC-005_evidencia_registro_error_FALLO.png';

// Carpeta artefactos
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

// ======================= SELECTORES ==========================
const SEL = {
  titulo:              By.css('.login-box .titulo'),
  btnCrearCuentaNueva: By.css('button.btn-crear-cuenta'),
  modalRegistro:       By.css('.modal-overlay .modal-content.modal-registro'),

  inputDni:            By.css('input[name="dni"]'),
  btnBuscarDni:        By.css('button.btn-buscar'),
  loadingReniec:       By.css('.loading-reniec'),
  inputNombres:        By.css('input[name="nombres"]'),
  inputApellidos:      By.css('input[name="apellidos"]'),
  inputCorreo:         By.css('input[name="correo"]'),
  inputTelefono:       By.css('input[name="telefono"]'),
  inputFechaNac:       By.css('input[name="fechaNacimiento"]'),
  inputContrasena:     By.css('input[name="contrasenaRegistro"]'),
  inputConfirmar:      By.css('input[name="confirmarContrasena"]'),
  btnCrearCuenta:      By.css('.modal-registro button.btn-enviar[type="submit"]'),

  alertaErrorReg:      By.css('.modal-registro .alerta-error'),
  alertaExitoLogin:    By.css('.login-box .alerta-exito')
};

// ======================= HELPERS =============================

async function esperarVisible(driver, locator, timeout = TIMEOUT, desc) {
  const el = await driver.wait(until.elementLocated(locator), timeout, `No apareció: ${desc}`);
  await driver.wait(until.elementIsVisible(el), timeout, `No visible: ${desc}`);
  return el;
}

async function escribirInput(driver, locator, valor, nombre) {
  const el = await esperarVisible(driver, locator, TIMEOUT, nombre);
  await el.click();
  await el.clear();
  await el.sendKeys(valor);
  return el;
}

async function abrirModalRegistro(driver) {
  const btn = await esperarVisible(driver, SEL.btnCrearCuentaNueva, TIMEOUT, 'botón crear cuenta');
  await btn.click();
  await esperarVisible(driver, SEL.modalRegistro, TIMEOUT, 'modal registro');
}

async function rellenarFechaNacimiento(driver, f) {
  const inputFecha = await esperarVisible(driver, SEL.inputFechaNac, TIMEOUT, 'campo fecha');
  let valor = '';

  try {
    await inputFecha.click();
    await inputFecha.sendKeys(f.dia, f.mes, f.anio);
    await driver.sleep(400);
    valor = (await inputFecha.getAttribute('value')) || '';
    if (valor) return valor;
  } catch (_) {}

  try {
    await inputFecha.clear();
    await inputFecha.click();
    await inputFecha.sendKeys(f.cmp);
    await driver.sleep(400);
    valor = (await inputFecha.getAttribute('value')) || '';
    if (valor) return valor;
  } catch (_) {}

  try {
    await driver.executeScript(`
      const el = arguments[0];
      el.value = arguments[1];
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur',   { bubbles: true }));
    `, inputFecha, f.iso);
    await driver.sleep(400);
    valor = (await inputFecha.getAttribute('value')) || '';
    if (valor) return valor;
  } catch (_) {}

  throw new Error('No se pudo aplicar la fecha con ninguna estrategia');
}

async function leerAlertaErrorRegistro(driver, maxMs = 3000) {
  try {
    const el = await driver.wait(until.elementLocated(SEL.alertaErrorReg), maxMs);
    if (!(await el.isDisplayed())) return null;
    return ((await el.getText()) || '').trim() || null;
  } catch (_) {
    return null;
  }
}

/**
 * Busca en el DOM cualquier texto visible que mencione "obligatorio / requerido / vacío".
 * Recorre .modal-registro buscando alertas, <span>, <small>, <mat-error>, .error, etc.
 */
async function buscarTextoObligatorioVisible(driver) {
  const script = `
    const contenedor = document.querySelector('.modal-registro');
    if (!contenedor) return [];
    const regex = /obligatori|requerid|required|no puede (estar|ser)|vac[íi]o|rellena/i;
    const resultados = [];
    const candidatos = contenedor.querySelectorAll(
      '.error, .invalid-feedback, .alerta-error, span, small, p, label, .mat-mdc-form-field-error, mat-error'
    );
    candidatos.forEach((n) => {
      if (n.offsetParent === null) return;      // no visible
      const txt = (n.textContent || '').trim();
      if (!txt || txt.length > 200) return;
      if (regex.test(txt)) resultados.push(txt);
    });
    return [...new Set(resultados)];
  `;
  return await driver.executeScript(script);
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
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    const url  = await driver.getCurrentUrl();
    const html = await driver.getPageSource();
    const file = path.join(ARTIFACTS_DIR, `page-${TEST_ID}-${sufijo}-${ts}.html`);
    fs.writeFileSync(file, `<!-- URL: ${url} -->\n${html}`, 'utf-8');
    console.log(`   📄 HTML guardado: ${file}`);
  } catch (_) {}
}

// ======================= SUB-CASO 5A + 5A2 ===================

async function subcaso5A_camposVacios(driver) {
  console.log('\n   ─── [5A] Campos obligatorios vacíos ───');
  const r = { estado: 'FALLÓ', detalle: '', subchecks: {} };

  await abrirModalRegistro(driver);
  console.log('   ✓ Modal abierto (formulario vacío)');

  // Click en submit sin llenar nada
  const btnCrear = await driver.findElement(SEL.btnCrearCuenta);
  await btnCrear.click();
  console.log('   ✓ Click en "Crear Cuenta" sin datos');

  await driver.sleep(1000); // Angular marca ng-touched y pinta mensajes

  // --- 5A: ¿el submit fue bloqueado? (modal debe seguir abierto) ---
  const modalAbierto = (await driver.findElements(SEL.modalRegistro)).length > 0;
  r.subchecks['submit_bloqueado'] = modalAbierto;
  console.log(`   ${modalAbierto ? '✓' : '❌'} Submit bloqueado (modal abierto: ${modalAbierto})`);

  // --- 5A: ¿algún input requerido quedó inválido? ---
  const invalidos = await driver.findElements(
    By.css('.modal-registro input.ng-invalid, .modal-registro input[required].ng-invalid')
  );
  r.subchecks['inputs_invalidos'] = invalidos.length;
  console.log(`   ${invalidos.length > 0 ? '✓' : '❌'} Inputs inválidos: ${invalidos.length}`);

  // --- 5A2: ¿hay texto visible tipo "campo obligatorio"? ---
  const textos = await buscarTextoObligatorioVisible(driver);
  r.subchecks['textos_obligatorio'] = textos;
  console.log(`   ${textos.length > 0 ? '✓' : '❌'} Textos "obligatorio" visibles: [${textos.join(' | ')}]`);

  // --- 5A2 fallback: tooltip nativo del navegador (required HTML5) ---
  if (textos.length === 0) {
    const msgNativo = await driver.executeScript(`
      const el = document.querySelector('.modal-registro input[required]');
      return el ? (el.validationMessage || '') : '';
    `);
    if (msgNativo) {
      console.log(`   ℹ validationMessage nativo del navegador: "${msgNativo}"`);
      r.subchecks['validation_nativa'] = msgNativo;
    }
  }

  // --- Veredicto ---
  const pasoBasico = modalAbierto && invalidos.length >= 2;
  const pasoMensajes = textos.length > 0 || !!r.subchecks['validation_nativa'];
  r.estado = (pasoBasico && pasoMensajes) ? 'PASÓ' : 'FALLÓ';

  if (!pasoBasico) {
    r.detalle = 'El formulario no bloqueó el submit o no marcó inputs inválidos';
  } else if (!pasoMensajes) {
    r.detalle = 'El submit se bloqueó pero NO hay texto visible de "campo obligatorio"';
  } else {
    const info = textos.length > 0
      ? `Mensajes: "${textos.slice(0, 2).join(' | ')}"`
      : `Tooltip nativo: "${r.subchecks['validation_nativa']}"`;
    r.detalle = `${invalidos.length} input(s) inválidos. ${info}`;
  }
  return r;
}

// ======================= SUB-CASO 5B =========================

async function subcaso5B_correoDuplicado(driver) {
  console.log('\n   ─── [5B] Correo electrónico duplicado ───');
  const r = { estado: 'FALLÓ', detalle: '', subchecks: {} };

  // Reutilizar modal abierto (de 5A) o reabrirlo
  if ((await driver.findElements(SEL.modalRegistro)).length === 0) {
    await abrirModalRegistro(driver);
  }
  console.log('   ✓ Modal listo');

  // 1) DNI + buscar RENIEC
  await escribirInput(driver, SEL.inputDni, DATOS.dni, 'DNI');
  const btnBuscar = await driver.findElement(SEL.btnBuscarDni);
  await driver.wait(until.elementIsEnabled(btnBuscar), TIMEOUT);
  await btnBuscar.click();
  try {
    await driver.wait(until.elementLocated(SEL.loadingReniec), 2000);
    await driver.wait(async () => {
      const elems = await driver.findElements(SEL.loadingReniec);
      return elems.length === 0 || !(await elems[0].isDisplayed());
    }, TIMEOUT);
  } catch (_) {}
  await driver.sleep(1000);

  const nombres   = ((await (await driver.findElement(SEL.inputNombres)).getAttribute('value'))   || '').trim();
  const apellidos = ((await (await driver.findElement(SEL.inputApellidos)).getAttribute('value')) || '').trim();
  if (!nombres || !apellidos) {
    r.detalle = `RENIEC no devolvió datos para DNI ${DATOS.dni} (Nombres="${nombres}", Apellidos="${apellidos}")`;
    return r;
  }
  console.log(`   ✓ RENIEC OK: ${nombres} ${apellidos}`);

  // 2) Correo duplicado
  await escribirInput(driver, SEL.inputCorreo, DATOS.correo, 'correo');
  console.log(`   ✓ Correo duplicado: ${DATOS.correo}`);

  // 3) Teléfono
  await escribirInput(driver, SEL.inputTelefono, DATOS.telefono, 'teléfono');

  // 4) Fecha
  const fecha = await rellenarFechaNacimiento(driver, {
    dia: DATOS.fechaDia, mes: DATOS.fechaMes, anio: DATOS.fechaAnio,
    iso: DATOS.fechaISO, cmp: DATOS.fechaCmp
  });
  console.log(`   ✓ Fecha: ${fecha}`);

  // 5-6) Contraseñas
  await escribirInput(driver, SEL.inputContrasena, DATOS.contrasena, 'contraseña');
  await escribirInput(driver, SEL.inputConfirmar, DATOS.confirmar, 'confirmar');

  // 7) Submit
  const btnCrear = await driver.findElement(SEL.btnCrearCuenta);
  await driver.wait(until.elementIsEnabled(btnCrear), TIMEOUT);
  await btnCrear.click();
  console.log('   ✓ Submit enviado');

  // Esperar alerta-error
  const msgError = await leerAlertaErrorRegistro(driver, 6000);
  if (!msgError) {
    r.detalle =
      'Backend no devolvió .alerta-error. ¿El correo ' + DATOS.correo +
      ' está realmente registrado en BD?';
    return r;
  }
  console.log(`   ✓ Alerta visible: "${msgError}"`);

  r.subchecks['mensaje_backend'] = msgError;
  r.subchecks['modal_sigue_abierto'] = (await driver.findElements(SEL.modalRegistro)).length > 0;

  // Validar contenido del mensaje
  const coincide = REGEX_CORREO_DUP.test(msgError);
  r.subchecks['mensaje_correcto'] = coincide;
  if (!coincide) {
    r.detalle = `Mensaje "${msgError}" no menciona "correo registrado/duplicado/existe"`;
    return r;
  }

  if (!r.subchecks['modal_sigue_abierto']) {
    r.detalle = 'El modal se cerró → el registro SÍ se creó (falla de validación del backend)';
    return r;
  }

  r.estado  = 'PASÓ';
  r.detalle = `Correo duplicado rechazado con mensaje: "${msgError}"`;
  return r;
}

// ======================= TEST PRINCIPAL ======================

(async () => {
  let driver;
  let paso = 'Inicialización';
  const resultados = {
    '5A': { estado: 'NO_EJECUTADO', detalle: 'No se ejecutó' },
    '5B': { estado: 'NO_EJECUTADO', detalle: 'No se ejecutó' }
  };
  const t0 = Date.now();

  try {
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

    paso = 'Abrir /login';
    await driver.get(`${BASE_URL}/login`);
    await esperarVisible(driver, SEL.titulo, TIMEOUT, 'título login');
    console.log('   ✓ Login cargado');

    // ---------- 5A ----------
    paso = 'Sub-caso 5A – Campos vacíos';
    try {
      resultados['5A'] = await subcaso5A_camposVacios(driver);
    } catch (e) {
      resultados['5A'] = { estado: 'FALLÓ', detalle: `[5A] ${e.message}` };
      if (DEBUG) await dumpPageForDebug(driver, '5A');
    }
    console.log(`   → [5A] ${resultados['5A'].estado}: ${resultados['5A'].detalle}`);

    // ---------- 5B ----------
    paso = 'Sub-caso 5B – Correo duplicado';
    try {
      resultados['5B'] = await subcaso5B_correoDuplicado(driver);
    } catch (e) {
      resultados['5B'] = { estado: 'FALLÓ', detalle: `[5B] ${e.message}` };
      if (DEBUG) await dumpPageForDebug(driver, '5B');
    }
    console.log(`   → [5B] ${resultados['5B'].estado}: ${resultados['5B'].detalle}`);

    // ---------- Evidencia ----------
    const todoPaso = resultados['5A'].estado === 'PASÓ' && resultados['5B'].estado === 'PASÓ';
    paso = 'Guardar evidencia';
    await guardarEvidencia(driver, todoPaso ? EVIDENCIA_PASO : EVIDENCIA_FALLO);

  } catch (err) {
    console.log(`\n❌ Error fatal en [${paso}]: ${err.message}`);
    if (driver) await guardarEvidencia(driver, EVIDENCIA_FALLO);
  } finally {
    if (driver) {
      try { await driver.quit(); console.log('   ✓ driver.quit() OK'); } catch (_) {}
    }
  }

  // ---------- Reporte final ----------
  const duracion = Date.now() - t0;
  const todoPaso = resultados['5A'].estado === 'PASÓ' && resultados['5B'].estado === 'PASÓ';

  console.log('\n════════════════════════════════════════════════════');
  console.log(` ${TEST_ID} – ${todoPaso ? 'PASÓ ✅' : 'FALLÓ ❌'}`);
  console.log('────────────────────────────────────────────────────');
  console.log(` [5A] Campos vacíos       → ${resultados['5A'].estado}`);
  console.log(`      ${resultados['5A'].detalle}`);
  console.log(` [5B] Correo duplicado    → ${resultados['5B'].estado}`);
  console.log(`      ${resultados['5B'].detalle}`);
  console.log('────────────────────────────────────────────────────');
  console.log(` Duración total: ${duracion} ms`);
  console.log('════════════════════════════════════════════════════\n');

  process.exit(todoPaso ? 0 : 1);
})();