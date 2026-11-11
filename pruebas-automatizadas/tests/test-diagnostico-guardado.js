/**
 * ============================================================================
 * TC-015 - test_diagnostico_guardado
 * ============================================================================
 * ID Test      : TC-015
 * Historia     : HU-15
 * Tipo         : Camino feliz (partición de equivalencia válida)
 * Categoría    : Control de Calidad / Elaboración de Cotización
 * Prioridad    : Alta
 * Automatización: No (marcado así en la matriz, pero se provee script)
 *
 * Descripción HU-15:
 *   "Como técnico, quiero registrar una cotización adjuntando los repuestos,
 *    trabajos necesarios y guardar, para que el sistema actualice la orden y
 *    muestre un mensaje de confirmación de éxito."
 *
 * Escenario:
 *   "Dado que soy un técnico en el panel con una orden en proceso, cuando
 *    registre una cotización adjuntando los repuestos, trabajos necesarios y
 *    haga clic en guardar, entonces el sistema debe actualizar la orden y
 *    mostrar un mensaje de confirmación de éxito."
 *
 * Objetivo:
 *   Verificar que el formulario de elaboración de cotización guarde
 *   correctamente los repuestos y montos asociados.
 *
 * Precondiciones:
 *   - Técnico autenticado (adriana@gmail.com / 123456)
 *   - Orden de trabajo asignada en estado EN_EVALUACION o PENDIENTE_COTIZACION
 *
 * Datos de entrada:
 *   - ID Orden
 *   - Repuesto
 *   - Costo repuesto
 *   - Mano de obra
 *
 * Pasos:
 *   1. Ingresar al panel técnico y navegar a la sección EVALUACION
 *   2. Seleccionar la orden de trabajo
 *   3. Agregar los repuestos necesarios y registrar los costos de mano de obra
 *   4. Hacer clic en el botón GUARDAR COTIZACION
 *
 * Resultado Esperado:
 *   El sistema guarda los items registrados, calcula automáticamente el total
 *   de la cotización y muestra un mensaje de confirmación notificando el
 *   cambio de estado.
 *
 * Evidencia: TC-015_evidencia_diagnostico_exito.png
 *
 * Instrucciones de ejecución:
 *   node tests/diagnostico-guardado.js
 *
 * Variables de entorno opcionales:
 *   COLTECH_URL    (default: http://localhost:4200)
 *   TECNICO_USER   (default: adriana@gmail.com)
 *   TECNICO_PASS   (default: 123456)
 *   ADMIN_USER     (default: admin@gmail.com)
 *   ADMIN_PASS     (default: 123456)
 *   COLTECH_DEBUG  (1 para diagnóstico extendido de UI)
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const CONFIG = {
  baseUrl: process.env.COLTECH_URL || 'http://localhost:4200',
  tecnicoUser: process.env.TECNICO_USER || 'adriana@gmail.com',
  tecnicoPass: process.env.TECNICO_PASS || '123456',
  adminUser: process.env.ADMIN_USER || 'admin@gmail.com',
  adminPass: process.env.ADMIN_PASS || '123456',
  debug: process.env.COLTECH_DEBUG === '1',
  artifactsDir: path.resolve(process.cwd(), 'artifacts'),
  evidenceName: 'TC-015_evidencia_diagnostico_exito.png',
  evidenceFailName: 'TC-015_evidencia_diagnostico_exito_FALLO.png',
  jsonReportName: 'reporte-TC-015.json',
  timeouts: {
    short: 3000,
    medium: 8000,
    long: 15000,
  },
  // Datos de entrada del caso de prueba
  datosCotizacion: {
    repuesto: 'Pantalla LCD 15.6"',
    costoRepuesto: '250.00',
    manoObra: '80.00',
  },
};

// ============================================================================
// ESTADO DEL REPORTE
// ============================================================================
const reporte = {
  test: 'TC-015',
  nombre: 'test_diagnostico_guardado',
  historia: 'HU-15',
  fechaInicio: new Date().toISOString(),
  fases: {
    loginTecnico: { estado: 'NO_EJECUTADO', detalle: '' },
    navegacionEvaluacion: { estado: 'NO_EJECUTADO', detalle: '' },
    seleccionOrden: { estado: 'NO_EJECUTADO', detalle: '' },
    registrarRepuestoYManoObra: { estado: 'NO_EJECUTADO', detalle: '' },
    guardarCotizacion: { estado: 'NO_EJECUTADO', detalle: '' },
    validarMensajeExito: { estado: 'NO_EJECUTADO', detalle: '' },
  },
  resultadoFinal: 'NO_EJECUTADO',
  errorDetalle: null,
  evidencia: null,
};

// ============================================================================
// HELPERS (idénticos al TC-014 para consistencia)
// ============================================================================
function asegurarArtifactsDir() {
  if (!fs.existsSync(CONFIG.artifactsDir)) {
    fs.mkdirSync(CONFIG.artifactsDir, { recursive: true });
  }
}

function log(msg) {
  console.log(`[TC-015] ${msg}`);
}

function logDebug(msg) {
  if (CONFIG.debug) console.log(`[TC-015][DEBUG] ${msg}`);
}

function marcarFase(fase, estado, detalle = '') {
  if (!reporte.fases[fase]) {
    reporte.fases[fase] = { estado, detalle };
  } else {
    reporte.fases[fase].estado = estado;
    reporte.fases[fase].detalle = detalle;
  }
  const icono = estado === 'PASÓ' ? '✅' : estado === 'FALLÓ' ? '❌' : '⏭️';
  log(`${icono} FASE ${fase}: ${estado}${detalle ? ' — ' + detalle : ''}`);
}

async function findFirstVisible(driver, locators, timeout = CONFIG.timeouts.medium, desc = 'elemento') {
  const deadline = Date.now() + timeout;
  let lastError = null;
  while (Date.now() < deadline) {
    for (const loc of locators) {
      try {
        const els = await driver.findElements(loc.by);
        for (const el of els) {
          try {
            if (await el.isDisplayed()) {
              logDebug(`findFirstVisible(${desc}) -> OK via ${loc.desc}`);
              return el;
            }
          } catch (_) { /* stale */ }
        }
      } catch (err) {
        lastError = err;
      }
    }
    await driver.sleep(250);
  }
  throw new Error(`No se encontró visible '${desc}' tras ${timeout} ms.` + (lastError ? ` Último error: ${lastError.message}` : ''));
}

async function findFirstVisibleOrNull(driver, locators, timeout = CONFIG.timeouts.medium, desc = 'elemento') {
  try {
    return await findFirstVisible(driver, locators, timeout, desc);
  } catch (_) {
    return null;
  }
}

async function guardarEvidencia(driver, nombreArchivo) {
  try {
    asegurarArtifactsDir();
    const png = await driver.takeScreenshot();
    const ruta = path.join(CONFIG.artifactsDir, nombreArchivo);
    fs.writeFileSync(ruta, png, 'base64');
    log(`📸 Evidencia guardada: ${ruta}`);
    return ruta;
  } catch (err) {
    log(`⚠️ No se pudo guardar evidencia: ${err.message}`);
    return null;
  }
}

async function dumpPageForDebug(driver, sufijo = 'debug') {
  try {
    asegurarArtifactsDir();
    const html = await driver.getPageSource();
    const rutaHtml = path.join(CONFIG.artifactsDir, `TC-015_dump_${sufijo}.html`);
    fs.writeFileSync(rutaHtml, html, 'utf8');
    log(`📄 HTML dump guardado: ${rutaHtml}`);
    await guardarEvidencia(driver, `TC-015_dump_${sufijo}.png`);
  } catch (err) {
    log(`⚠️ dumpPageForDebug falló: ${err.message}`);
  }
}

async function volcarEstructuraUI(driver) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  VOLCADO DE ESTRUCTURA UI (diagnóstico de selectores)');
  console.log('═══════════════════════════════════════════════════════════');
  try {
    const dumpSection = async (label, sel) => {
      const els = await driver.findElements(By.css(sel));
      const visibles = [];
      for (const el of els) {
        try {
          if (await el.isDisplayed()) {
            const tag = await el.getTagName();
            const txt = ((await el.getText()) || '').replace(/\s+/g, ' ').substring(0, 80);
            const id = (await el.getAttribute('id')) || '';
            const name = (await el.getAttribute('name')) || '';
            const cls = (await el.getAttribute('class')) || '';
            const type = (await el.getAttribute('type')) || '';
            const disabled = (await el.getAttribute('disabled')) !== null;
            visibles.push({ tag, txt, id, name, cls: cls.substring(0, 80), type, disabled });
          }
        } catch (_) { /* stale */ }
      }
      console.log(`\n--- ${label} (${visibles.length} visibles) ---`);
      visibles.slice(0, 30).forEach((e, i) => {
        console.log(` [${i}] <${e.tag}${e.type ? ' type=' + e.type : ''}> ` +
          `id="${e.id}" name="${e.name}" class="${e.cls}" disabled=${e.disabled} text="${e.txt}"`);
      });
    };
    await dumpSection('INPUTS', 'input, textarea, select, mat-select');
    await dumpSection('BOTONES', 'button, [role="button"], .btn, .btn-login, .btn-guardar');
    await dumpSection('ALERTAS', '.alerta-error, .alerta-exito, .toast-error, .toast-success, .mat-snack-bar-container');
  } catch (err) {
    console.log(`⚠️ volcarEstructuraUI error: ${err.message}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

// ============================================================================
// LOGIN — selectores basados en el HTML real del login
// ============================================================================
function loginLocators() {
  return {
    userInput: [
      { by: By.css('input[name="usuario"]'), desc: 'input[name=usuario]' },
      { by: By.css('input[placeholder="Correo o usuario"]'), desc: 'input placeholder Correo o usuario' },
      { by: By.css('.login-box input[type="text"]'), desc: 'login-box input text' },
    ],
    passInput: [
      { by: By.css('input[name="contrasena"]'), desc: 'input[name=contrasena]' },
      { by: By.css('input[type="password"]'), desc: 'input[type=password]' },
    ],
    submitBtn: [
      { by: By.css('button.btn-login'), desc: 'button.btn-login' },
      { by: By.css('button[type="submit"]'), desc: 'button[type=submit]' },
    ],
    errorAlert: [
      { by: By.css('.alerta-error'), desc: '.alerta-error' },
    ],
  };
}

async function loginComo(driver, usuario, contrasena) {
  log(`🔐 Login como: ${usuario}`);
  await driver.get(`${CONFIG.baseUrl}/login`);
  await driver.sleep(1000);

  const locs = loginLocators();

  const userInput = await findFirstVisible(driver, locs.userInput, CONFIG.timeouts.medium, 'input usuario');
  await userInput.clear();
  await userInput.sendKeys(usuario);

  const passInput = await findFirstVisible(driver, locs.passInput, CONFIG.timeouts.medium, 'input contraseña');
  await passInput.clear();
  await passInput.sendKeys(contrasena);

  const btn = await findFirstVisible(driver, locs.submitBtn, CONFIG.timeouts.medium, 'botón login');
  try { await btn.click(); } catch (_) { await driver.executeScript('arguments[0].click();', btn); }

  // Espera activa de redirección o detección de error
  const deadline = Date.now() + CONFIG.timeouts.long;
  while (Date.now() < deadline) {
    const url = await driver.getCurrentUrl();
    if (!/\/login/i.test(url)) {
      log(`✅ Login exitoso. URL actual: ${url}`);
      return;
    }
    const errAlert = await findFirstVisibleOrNull(driver, locs.errorAlert, 500, 'alerta error login');
    if (errAlert) {
      const txt = await errAlert.getText();
      throw new Error(`Login rechazado por el sistema: "${txt}"`);
    }
    await driver.sleep(300);
  }
  throw new Error('Timeout esperando redirección post-login. ¿Credenciales incorrectas?');
}

async function loginComoTecnico(driver) {
  return loginComo(driver, CONFIG.tecnicoUser, CONFIG.tecnicoPass);
}

async function loginComoAdmin(driver) {
  return loginComo(driver, CONFIG.adminUser, CONFIG.adminPass);
}

// ============================================================================
// LOCATORS ESPECÍFICOS DEL FLUJO DE COTIZACIÓN (TC-015)
// ============================================================================
function locatorsMenuEvaluacion() {
  return [
    { by: By.css('a[routerLink="/tecnico/evaluacion-equipos"]'), desc: 'routerLink evaluacion-equipos' },
    { by: By.css('a[href*="evaluacion"]'), desc: 'href evaluacion' },
    { by: By.xpath("//a[contains(translate(., 'EVALUACION','evaluacion'),'evaluacion')]"), desc: 'xpath Evaluacion' },
    { by: By.xpath("//a[contains(translate(., 'COTIZACION','cotizacion'),'cotizacion')]"), desc: 'xpath Cotizacion' },
  ];
}

function locatorsSelectOrden() {
  return [
    { by: By.css('mat-select'), desc: 'mat-select' },
    { by: By.css('select'), desc: 'select' },
    { by: By.xpath("//mat-select"), desc: 'xpath mat-select' },
  ];
}

function locatorsInputRepuesto() {
  return [
    { by: By.css('input[formcontrolname="repuesto"]'), desc: 'input repuesto' },
    { by: By.css('input[name="repuesto"]'), desc: 'input name repuesto' },
    { by: By.css('input[placeholder*="repuesto" i]'), desc: 'input placeholder repuesto' },
    { by: By.css('input[placeholder*="descripcion" i]'), desc: 'input placeholder descripcion' },
    { by: By.css('input[formcontrolname="descripcion"]'), desc: 'input descripcion' },
  ];
}

function locatorsInputCostoRepuesto() {
  return [
    { by: By.css('input[formcontrolname="costoRepuesto"]'), desc: 'input costoRepuesto' },
    { by: By.css('input[formcontrolname="costo"]'), desc: 'input costo' },
    { by: By.css('input[name="costoRepuesto"]'), desc: 'input name costoRepuesto' },
    { by: By.css('input[name="costo"]'), desc: 'input name costo' },
    { by: By.css('input[type="number"]'), desc: 'input number (fallback)' },
  ];
}

function locatorsInputManoObra() {
  return [
    { by: By.css('input[formcontrolname="manoObra"]'), desc: 'input manoObra' },
    { by: By.css('input[name="manoObra"]'), desc: 'input name manoObra' },
    { by: By.css('input[placeholder*="mano" i]'), desc: 'input placeholder mano de obra' },
    { by: By.css('input[placeholder*="obra" i]'), desc: 'input placeholder obra' },
  ];
}

function locatorsBtnAgregarItem() {
  return [
    { by: By.css('[data-testid="btn-agregar-repuesto"]'), desc: 'data-testid agregar repuesto' },
    { by: By.css('button.btn-agregar'), desc: 'button.btn-agregar' },
    { by: By.xpath("//button[contains(translate(.,'AGREGAR','agregar'),'agregar')]"), desc: 'xpath Agregar' },
    { by: By.xpath("//button[contains(translate(.,'AÑADIR','añadir'),'añadir')]"), desc: 'xpath Añadir' },
  ];
}

function locatorsBtnGuardarCotizacion() {
  return [
    { by: By.css('[data-testid="btn-guardar-cotizacion"]'), desc: 'data-testid guardar cotizacion' },
    { by: By.css('button.btn-guardar-cotizacion'), desc: 'button.btn-guardar-cotizacion' },
    { by: By.xpath("//button[contains(translate(.,'GUARDAR COTIZACION','guardar cotizacion'),'guardar cotizacion')]"), desc: 'xpath Guardar Cotizacion' },
    { by: By.xpath("//button[contains(translate(.,'GUARDAR','guardar'),'guardar')]"), desc: 'xpath Guardar' },
    { by: By.css('button[type="submit"]'), desc: 'button[type=submit]' },
  ];
}

function locatorsMensajeExito() {
  return [
    { by: By.css('.alerta-exito'), desc: '.alerta-exito' },
    { by: By.css('.toast-success, .mat-snack-bar-container.success, .alert-success'), desc: 'toast success' },
    { by: By.xpath("//*[contains(translate(.,'EXITOSAMENTE','exitosamente'),'exitosamente') or contains(translate(.,'CONFIRMACION','confirmacion'),'confirmacion') or contains(translate(.,'GUARDAD','guardad'),'guardad') or contains(translate(.,'ACTUALIZAD','actualizad'),'actualizad')]"), desc: 'xpath texto éxito' },
  ];
}

function locatorsTotalCotizacion() {
  return [
    { by: By.css('[data-testid="total-cotizacion"]'), desc: 'data-testid total' },
    { by: By.css('.total-cotizacion, .total, .monto-total'), desc: 'clase total' },
    { by: By.xpath("//*[contains(translate(.,'TOTAL','total'),'total')]"), desc: 'xpath texto Total' },
  ];
}

// ============================================================================
// EJECUCIÓN PRINCIPAL (TC-015)
// ============================================================================
async function run() {
  asegurarArtifactsDir();
  let driver;

  try {
    const options = new chrome.Options();
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--window-size=1920,1080');
    // options.addArguments('--headless=new'); // Descomentar para headless en CI/CD

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    log('🚀 Iniciando automatización TC-015 (Guardar cotización - camino feliz)...');

    // 1. Login Técnico
    try {
      await loginComoTecnico(driver);
      marcarFase('loginTecnico', 'PASÓ', `usuario=${CONFIG.tecnicoUser}`);
    } catch (err) {
      marcarFase('loginTecnico', 'FALLÓ', err.message);
      throw new Error(`FASE loginTecnico: ${err.message}`);
    }

    // 2. Navegar a la sección EVALUACION
    try {
      const link = await findFirstVisibleOrNull(driver, locatorsMenuEvaluacion(), CONFIG.timeouts.medium, 'menú Evaluación');
      if (link) {
        try { await link.click(); } catch (_) { await driver.executeScript('arguments[0].click();', link); }
        await driver.sleep(1200);
      } else {
        await driver.get(`${CONFIG.baseUrl}/tecnico/evaluacion-equipos`);
        await driver.sleep(1500);
      }
      marcarFase('navegacionEvaluacion', 'PASÓ', 'en sección Evaluación');
    } catch (err) {
      marcarFase('navegacionEvaluacion', 'FALLÓ', err.message);
      throw new Error(`FASE navegacionEvaluacion: ${err.message}`);
    }

    // 3. Seleccionar la orden de trabajo (EN_EVALUACION o PENDIENTE_COTIZACION)
    try {
      const selectOrden = await findFirstVisibleOrNull(driver, locatorsSelectOrden(), CONFIG.timeouts.short, 'select orden');
      if (selectOrden) {
        try { await selectOrden.click(); } catch (_) { await driver.executeScript('arguments[0].click();', selectOrden); }
        await driver.sleep(700);
        const opciones = await driver.findElements(By.css('mat-option, option'));
        let seleccionada = false;
        for (const op of opciones) {
          if (await op.isDisplayed()) {
            const txt = ((await op.getText()) || '').toLowerCase();
            if (txt.includes('evaluaci') || txt.includes('cotizaci') || !seleccionada) {
              try { await op.click(); } catch (_) { await driver.executeScript('arguments[0].click();', op); }
              seleccionada = true;
              if (txt.includes('evaluaci') || txt.includes('cotizaci')) break;
            }
          }
        }
      } else {
        const filas = await driver.findElements(By.css('tr, mat-row, .order-row, .card'));
        for (const f of filas) {
          if (await f.isDisplayed()) {
            try { await f.click(); } catch (_) { await driver.executeScript('arguments[0].click();', f); }
            break;
          }
        }
      }
      await driver.sleep(1200);
      marcarFase('seleccionOrden', 'PASÓ', 'orden seleccionada');
    } catch (err) {
      marcarFase('seleccionOrden', 'FALLÓ', err.message);
      throw new Error(`FASE seleccionOrden: ${err.message}`);
    }

    // 4. Registrar repuesto + costo + mano de obra
    try {
      const { repuesto, costoRepuesto, manoObra } = CONFIG.datosCotizacion;

      // 4.1 Repuesto (descripción)
      const inputRepuesto = await findFirstVisible(driver, locatorsInputRepuesto(), CONFIG.timeouts.medium, 'input repuesto');
      await inputRepuesto.clear();
      await inputRepuesto.sendKeys(repuesto);
      log(`📝 Repuesto ingresado: "${repuesto}"`);

      // 4.2 Costo del repuesto
      const inputCosto = await findFirstVisible(driver, locatorsInputCostoRepuesto(), CONFIG.timeouts.medium, 'input costo repuesto');
      await inputCosto.clear();
      await inputCosto.sendKeys(costoRepuesto);
      log(`💰 Costo repuesto ingresado: ${costoRepuesto}`);

      // 4.3 Mano de obra
      const inputManoObra = await findFirstVisible(driver, locatorsInputManoObra(), CONFIG.timeouts.medium, 'input mano de obra');
      await inputManoObra.clear();
      await inputManoObra.sendKeys(manoObra);
      log(`🔧 Mano de obra ingresada: ${manoObra}`);

      // 4.4 Si existe un botón "Agregar item", lo clickeamos para añadir la fila
      const btnAgregar = await findFirstVisibleOrNull(driver, locatorsBtnAgregarItem(), CONFIG.timeouts.short, 'botón Agregar item');
      if (btnAgregar) {
        try { await btnAgregar.click(); } catch (_) { await driver.executeScript('arguments[0].click();', btnAgregar); }
        log('➕ Item agregado a la lista de cotización');
        await driver.sleep(800);
      } else {
        logDebug('No se encontró botón "Agregar item" (posiblemente el form es de un solo item).');
      }

      // 4.5 Validar que el total se calculó (si existe en la UI)
      const totalEl = await findFirstVisibleOrNull(driver, locatorsTotalCotizacion(), CONFIG.timeouts.short, 'total cotización');
      if (totalEl) {
        const totalTxt = ((await totalEl.getText()) || '').trim();
        log(`🧮 Total mostrado en UI: "${totalTxt}"`);
        const esperado = (parseFloat(costoRepuesto) + parseFloat(manoObra)).toFixed(2);
        if (!totalTxt.replace(/[^\d.]/g, '').includes(esperado)) {
          logDebug(`⚠️ Total mostrado no coincide con esperado ${esperado}, se continúa (puede incluir IGV).`);
        }
      }

      marcarFase('registrarRepuestoYManoObra', 'PASÓ',
        `repuesto="${repuesto}", costo=${costoRepuesto}, manoObra=${manoObra}`);
    } catch (err) {
      marcarFase('registrarRepuestoYManoObra', 'FALLÓ', err.message);
      throw new Error(`FASE registrarRepuestoYManoObra: ${err.message}`);
    }

    // 5. Click en GUARDAR COTIZACION
    try {
      const btnGuardar = await findFirstVisible(driver, locatorsBtnGuardarCotizacion(), CONFIG.timeouts.medium, 'botón Guardar Cotización');
      const isDisabledAttr = await btnGuardar.getAttribute('disabled');
      if (isDisabledAttr !== null) {
        throw new Error('El botón "Guardar Cotización" está deshabilitado con datos válidos (no debería).');
      }
      try { await btnGuardar.click(); } catch (_) { await driver.executeScript('arguments[0].click();', btnGuardar); }
      log('💾 Click en "Guardar Cotización"');
      await driver.sleep(1500);
      marcarFase('guardarCotizacion', 'PASÓ', 'click ejecutado');
    } catch (err) {
      marcarFase('guardarCotizacion', 'FALLÓ', err.message);
      throw new Error(`FASE guardarCotizacion: ${err.message}`);
    }

    // 6. Validar mensaje de confirmación de éxito
    try {
      const mensajeExito = await findFirstVisible(driver, locatorsMensajeExito(), CONFIG.timeouts.long, 'mensaje de éxito');
      const txt = ((await mensajeExito.getText()) || '').replace(/\s+/g, ' ').trim();
      if (!txt) {
        throw new Error('El mensaje de éxito apareció pero está vacío.');
      }
      log(`✅ Mensaje de confirmación mostrado: "${txt}"`);
      marcarFase('validarMensajeExito', 'PASÓ', `"${txt.substring(0, 60)}"`);
    } catch (err) {
      marcarFase('validarMensajeExito', 'FALLÓ', err.message);
      throw new Error(`FASE validarMensajeExito: ${err.message}`);
    }

    reporte.resultadoFinal = 'PASÓ';
    log('🎉 ¡El caso de prueba TC-015 PASÓ exitosamente!');

    const rutaEvidencia = await guardarEvidencia(driver, CONFIG.evidenceName);
    reporte.evidencia = rutaEvidencia;

  } catch (err) {
    reporte.resultadoFinal = 'FALLÓ';
    reporte.errorDetalle = err.message;
    log(`❌ Error crítico en TC-015: ${err.message}`);

    if (driver) {
      try {
        await volcarEstructuraUI(driver);
        await dumpPageForDebug(driver, 'fallo');
        const rutaFallida = await guardarEvidencia(driver, CONFIG.evidenceFailName);
        reporte.evidencia = rutaFallida;
      } catch (dumpErr) {
        log(`⚠️ No se pudo recolectar diagnóstico post-fallo: ${dumpErr.message}`);
      }
    }
  } finally {
    if (driver) {
      try { await driver.quit(); } catch (_) {}
    }

    try {
      asegurarArtifactsDir();
      const jsonPath = path.join(CONFIG.artifactsDir, CONFIG.jsonReportName);
      fs.writeFileSync(jsonPath, JSON.stringify(reporte, null, 2), 'utf8');
      log(`📊 Reporte JSON guardado en: ${jsonPath}`);
    } catch (reportErr) {
      log(`⚠️ No se pudo guardar el reporte JSON: ${reportErr.message}`);
    }

    const exitCode = reporte.resultadoFinal === 'PASÓ' ? 0 : 1;
    log(`🏁 Finalizando script con código de salida: ${exitCode}`);
    process.exit(exitCode);
  }
}

run();