/**
 * ============================================================================
 * TC-016 - test_registrar_solicitud_Camino_Feliz
 * ============================================================================
 * ID Test      : TC-016
 * Historia     : HU-16
 * Tipo         : Camino feliz (partición de equivalencia válida)
 * Categoría    : Control de Calidad / Registro de Solicitud (Ticket)
 * Prioridad    : Alta
 * Automatización: Sí
 *
 * Descripción HU-16:
 *   "Como cliente, quiero registrar un ticket de atención al equipo para ser
 *    atendido por la empresa."
 *
 * Escenario:
 *   "Dado que soy un cliente registrado, cuando registre mi solicitud
 *    (adjuntando el tipo de equipo, número de serie, marca, modelo y
 *    descripción de falla de más de 10 caracteres), entonces el sistema
 *    genera el reporte con un mensaje de 'Reporte registrado exitosamente'
 *    con el código de reporte."
 *
 * Objetivo:
 *   Verificar que el reporte esté registrado satisfactoriamente y que genere
 *   un código de operación.
 *
 * Precondiciones:
 *   - Cliente registrado e iniciado sesión previamente en la plataforma
 *
 * Datos de entrada:
 *   - Tipo de equipo  = Laptop
 *   - Número de serie = SN-2024-001
 *   - Marca           = Lenovo
 *   - Modelo          = Thinkpad
 *   - Descripción     = "no enciende PC" (14 caracteres > 10)
 *
 * Pasos:
 *   1. Ingresar al panel cliente y navegar a la sección GENERAR SOLICITUD
 *   2. Llenar el formulario para registrar la solicitud de reparación
 *   3. Hacer clic en enviar reporte
 *
 * Resultado Esperado:
 *   El sistema guarda la solicitud de reparación, cambia su estado a PENDIENTE
 *   y muestra un mensaje emergente de éxito con el código de seguimiento.
 *
 * Evidencia: TC-016_evidencia_registrar_solicitud_Camino_Feliz.png
 *
 * Instrucciones de ejecución:
 *   node tests/registrar-solicitud-camino-feliz.js
 *
 * Variables de entorno opcionales:
 *   COLTECH_URL    (default: http://localhost:4200)
 *   CLIENTE_USER   (default: cliente@gmail.com)
 *   CLIENTE_PASS   (default: 123456)
 *   COLTECH_DEBUG  (1 para diagnóstico extendido de UI)
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Builder, By, until, Select } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const CONFIG = {
  baseUrl: process.env.COLTECH_URL || 'http://localhost:4200',
  clienteUser: process.env.CLIENTE_USER || 'adriana@gmail.com',
  clientePass: process.env.CLIENTE_PASS || '123456',
  debug: process.env.COLTECH_DEBUG === '1',
  artifactsDir: path.resolve(process.cwd(), 'artifacts'),
  evidenceName: 'TC-016_evidencia_registrar_solicitud_Camino_Feliz.png',
  evidenceFailName: 'TC-016_evidencia_registrar_solicitud_Camino_Feliz_FALLO.png',
  jsonReportName: 'reporte-TC-016.json',
  timeouts: {
    short: 3000,
    medium: 8000,
    long: 15000,
  },
  // Datos de entrada del caso de prueba (coinciden con las opciones del HTML)
  datosSolicitud: {
    tipoEquipo: 'Laptop',
    numeroSerie: 'SN-2024-001',
    marca: 'Lenovo',
    modelo: 'Thinkpad',
    descripcionFalla: 'no enciende PC',
  },
};

// ============================================================================
// ESTADO DEL REPORTE
// ============================================================================
const reporte = {
  test: 'TC-016',
  nombre: 'test_registrar_solicitud_Camino_Feliz',
  historia: 'HU-16',
  fechaInicio: new Date().toISOString(),
  fases: {
    loginCliente: { estado: 'NO_EJECUTADO', detalle: '' },
    navegacionGenerarSolicitud: { estado: 'NO_EJECUTADO', detalle: '' },
    completarFormulario: { estado: 'NO_EJECUTADO', detalle: '' },
    enviarReporte: { estado: 'NO_EJECUTADO', detalle: '' },
    validarMensajeExito: { estado: 'NO_EJECUTADO', detalle: '' },
    validarCodigoOperacion: { estado: 'NO_EJECUTADO', detalle: '' },
  },
  resultadoFinal: 'NO_EJECUTADO',
  codigoReporte: null,
  resumenReporte: null,
  errorDetalle: null,
  evidencia: null,
};

// ============================================================================
// HELPERS
// ============================================================================
function asegurarArtifactsDir() {
  if (!fs.existsSync(CONFIG.artifactsDir)) {
    fs.mkdirSync(CONFIG.artifactsDir, { recursive: true });
  }
}

function log(msg) {
  console.log(`[TC-016] ${msg}`);
}

function logDebug(msg) {
  if (CONFIG.debug) console.log(`[TC-016][DEBUG] ${msg}`);
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
    const rutaHtml = path.join(CONFIG.artifactsDir, `TC-016_dump_${sufijo}.html`);
    fs.writeFileSync(rutaHtml, html, 'utf8');
    log(`📄 HTML dump guardado: ${rutaHtml}`);
    await guardarEvidencia(driver, `TC-016_dump_${sufijo}.png`);
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
    await dumpSection('INPUTS/SELECTS/TEXTAREAS', 'input, select, textarea');
    await dumpSection('BOTONES', 'button, [role="button"], .btn, .btn-enviar');
    await dumpSection('ALERTAS/CÓDIGO', '.alerta-error, .exito-card, .codigo, .toast-success, .mat-snack-bar-container');
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

async function loginComoCliente(driver) {
  return loginComo(driver, CONFIG.clienteUser, CONFIG.clientePass);
}

// ============================================================================
// LOCATORS ESPECÍFICOS DEL FLUJO DE SOLICITUD (basados en el HTML real)
// ============================================================================
function locatorsMenuGenerarSolicitud() {
  return [
    { by: By.css('a[routerLink="/cliente/generar-solicitud"]'), desc: 'routerLink generar-solicitud' },
    { by: By.css('a[href*="generar-solicitud"]'), desc: 'href generar-solicitud' },
    { by: By.xpath("//a[contains(translate(., 'GENERAR','generar'),'generar')]"), desc: 'xpath Generar' },
    { by: By.xpath("//a[contains(translate(., 'SOLICITUD','solicitud'),'solicitud')]"), desc: 'xpath Solicitud' },
    { by: By.xpath("//a[contains(translate(., 'REPORTE','reporte'),'reporte')]"), desc: 'xpath Reporte' },
  ];
}

/**
 * Select "Tipo de equipo": <select name="tipoEquipo"> con opción "Laptop".
 */
function locatorsSelectTipoEquipo() {
  return [
    { by: By.css('select[name="tipoEquipo"]'), desc: 'select[name=tipoEquipo]' },
    { by: By.css('select.form-select'), desc: 'select.form-select' },
  ];
}

function locatorsInputNumeroSerie() {
  return [
    { by: By.css('input[name="numeroSerie"]'), desc: 'input[name=numeroSerie]' },
    { by: By.css('input[placeholder="Ej: SN-2024-001"]'), desc: 'input placeholder SN-2024-001' },
  ];
}

/**
 * Select "Marca": <select name="marcaSelect"> con opción "Lenovo".
 */
function locatorsSelectMarca() {
  return [
    { by: By.css('select[name="marcaSelect"]'), desc: 'select[name=marcaSelect]' },
    { by: By.css('select[name="marca"]'), desc: 'select[name=marca]' },
  ];
}

function locatorsInputOtraMarca() {
  return [
    { by: By.css('input[name="otraMarca"]'), desc: 'input[name=otraMarca]' },
  ];
}

function locatorsInputModelo() {
  return [
    { by: By.css('input[name="modelo"]'), desc: 'input[name=modelo]' },
    { by: By.css('input[placeholder*="ThinkPad" i]'), desc: 'input placeholder ThinkPad' },
    { by: By.css('input[placeholder*="Pavilion" i]'), desc: 'input placeholder Pavilion' },
  ];
}

function locatorsTextareaDescripcion() {
  return [
    { by: By.css('textarea[name="descripcionFalla"]'), desc: 'textarea[name=descripcionFalla]' },
    { by: By.css('textarea'), desc: 'textarea genérico' },
  ];
}

function locatorsBtnEnviarReporte() {
  return [
    { by: By.css('button.btn-enviar'), desc: 'button.btn-enviar' },
    { by: By.xpath("//button[contains(translate(.,'ENVIAR REPORTE','enviar reporte'),'enviar reporte')]"), desc: 'xpath Enviar reporte' },
    { by: By.xpath("//button[contains(translate(.,'ENVIAR','enviar'),'enviar')]"), desc: 'xpath Enviar' },
  ];
}

/**
 * Pantalla de éxito: <div class="exito-card"> con h2 "¡Reporte registrado exitosamente!"
 * y <div class="codigo">{{ codigoOperacion }}</div>
 */
function locatorsPantallaExito() {
  return [
    { by: By.css('.exito-card'), desc: '.exito-card' },
    { by: By.css('.exito-card h2'), desc: '.exito-card h2' },
    { by: By.xpath("//*[contains(translate(.,'REPORTE REGISTRADO','reporte registrado'),'reporte registrado')]"), desc: 'xpath Reporte registrado' },
  ];
}

function locatorsCodigoOperacion() {
  return [
    { by: By.css('.exito-card .codigo'), desc: '.exito-card .codigo' },
    { by: By.css('.codigo'), desc: '.codigo' },
  ];
}

function locatorsResumenReporte() {
  return [
    { by: By.css('.resumen-reporte'), desc: '.resumen-reporte' },
  ];
}

function locatorsAlertaError() {
  return [
    { by: By.css('.alerta-error'), desc: '.alerta-error' },
  ];
}

// ============================================================================
// EJECUCIÓN PRINCIPAL (TC-016)
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

    log('🚀 Iniciando automatización TC-016 (Registrar solicitud - camino feliz)...');

    // 1. Login Cliente
    try {
      await loginComoCliente(driver);
      marcarFase('loginCliente', 'PASÓ', `usuario=${CONFIG.clienteUser}`);
    } catch (err) {
      marcarFase('loginCliente', 'FALLÓ', err.message);
      throw new Error(`FASE loginCliente: ${err.message}`);
    }

    // 2. Navegar a GENERAR SOLICITUD
    try {
      const link = await findFirstVisibleOrNull(driver, locatorsMenuGenerarSolicitud(), CONFIG.timeouts.medium, 'menú Generar Solicitud');
      if (link) {
        try { await link.click(); } catch (_) { await driver.executeScript('arguments[0].click();', link); }
        await driver.sleep(1200);
      } else {
        await driver.get(`${CONFIG.baseUrl}/cliente/generar-solicitud`);
        await driver.sleep(1500);
      }
      marcarFase('navegacionGenerarSolicitud', 'PASÓ', 'en /cliente/generar-solicitud');
    } catch (err) {
      marcarFase('navegacionGenerarSolicitud', 'FALLÓ', err.message);
      throw new Error(`FASE navegacionGenerarSolicitud: ${err.message}`);
    }

    // 3. Completar el formulario
    try {
      const { tipoEquipo, numeroSerie, marca, modelo, descripcionFalla } = CONFIG.datosSolicitud;

      // 3.1 Tipo de equipo (SELECT nativo)
      const elTipo = await findFirstVisible(driver, locatorsSelectTipoEquipo(), CONFIG.timeouts.medium, 'select tipoEquipo');
      const selTipo = new Select(elTipo);
      // Intentar por texto visible exacto; fallback por value
      let tipoOk = false;
      try {
        await selTipo.selectByVisibleText(tipoEquipo);
        tipoOk = true;
      } catch (_) {
        try {
          await selTipo.selectByValue(tipoEquipo);
          tipoOk = true;
        } catch (__) { /* sigue abajo */ }
      }
      if (!tipoOk) {
        // Fallback: recorrer opciones y clickear la que coincida
        const opciones = await selTipo.getOptions();
        for (const op of opciones) {
          const t = ((await op.getText()) || '').trim();
          if (t.toLowerCase().includes(tipoEquipo.toLowerCase())) {
            await op.click();
            tipoOk = true;
            break;
          }
        }
      }
      if (!tipoOk) throw new Error(`No se pudo seleccionar tipoEquipo="${tipoEquipo}"`);
      log(`📝 Tipo equipo: "${tipoEquipo}"`);

      // 3.2 Número de serie
      const elSerie = await findFirstVisible(driver, locatorsInputNumeroSerie(), CONFIG.timeouts.medium, 'input numeroSerie');
      await elSerie.clear();
      await elSerie.sendKeys(numeroSerie);
      log(`🔢 Número de serie: "${numeroSerie}"`);

      // 3.3 Marca (SELECT nativo)
      const elMarca = await findFirstVisible(driver, locatorsSelectMarca(), CONFIG.timeouts.medium, 'select marcaSelect');
      const selMarca = new Select(elMarca);
      let marcaOk = false;
      try {
        await selMarca.selectByVisibleText(marca);
        marcaOk = true;
      } catch (_) {
        try {
          await selMarca.selectByValue(marca);
          marcaOk = true;
        } catch (__) { /* sigue abajo */ }
      }
      if (!marcaOk) {
        const opciones = await selMarca.getOptions();
        for (const op of opciones) {
          const t = ((await op.getText()) || '').trim();
          if (t.toLowerCase().includes(marca.toLowerCase())) {
            await op.click();
            marcaOk = true;
            break;
          }
        }
      }
      if (!marcaOk) throw new Error(`No se pudo seleccionar marca="${marca}"`);
      log(`🏷️ Marca: "${marca}"`);

      // 3.4 Si se eligió "Otras" (no es el caso aquí), llenar otraMarca
      if (marca === 'Otras') {
        const elOtra = await findFirstVisible(driver, locatorsInputOtraMarca(), CONFIG.timeouts.short, 'input otraMarca');
        await elOtra.clear();
        await elOtra.sendKeys(CONFIG.datosSolicitud.otraMarca || 'Genérica');
      }

      // 3.5 Modelo
      const elModelo = await findFirstVisible(driver, locatorsInputModelo(), CONFIG.timeouts.medium, 'input modelo');
      await elModelo.clear();
      await elModelo.sendKeys(modelo);
      log(`📦 Modelo: "${modelo}"`);

      // 3.6 Descripción de falla (más de 10 caracteres)
      if (descripcionFalla.length <= 10) {
        throw new Error(`La descripción debe tener más de 10 caracteres. Actual: ${descripcionFalla.length}`);
      }
      const elDesc = await findFirstVisible(driver, locatorsTextareaDescripcion(), CONFIG.timeouts.medium, 'textarea descripcionFalla');
      await elDesc.clear();
      await elDesc.sendKeys(descripcionFalla);
      log(`📄 Descripción: "${descripcionFalla}" (${descripcionFalla.length} caracteres)`);

      marcarFase('completarFormulario', 'PASÓ',
        `tipo=${tipoEquipo}, serie=${numeroSerie}, marca=${marca}, modelo=${modelo}, desc=${descripcionFalla.length} chars`);
    } catch (err) {
      marcarFase('completarFormulario', 'FALLÓ', err.message);
      throw new Error(`FASE completarFormulario: ${err.message}`);
    }

    // 4. Click en "Enviar reporte"
    try {
      const btnEnviar = await findFirstVisible(driver, locatorsBtnEnviarReporte(), CONFIG.timeouts.medium, 'botón Enviar reporte');
      const isDisabledAttr = await btnEnviar.getAttribute('disabled');
      if (isDisabledAttr !== null) {
        // Puede estar deshabilitado mientras "cargando"; esperamos un momento
        await driver.sleep(500);
      }
      try { await btnEnviar.click(); } catch (_) { await driver.executeScript('arguments[0].click();', btnEnviar); }
      log('📤 Click en "Enviar reporte"');
      await driver.sleep(1500);
      marcarFase('enviarReporte', 'PASÓ', 'click ejecutado');
    } catch (err) {
      marcarFase('enviarReporte', 'FALLÓ', err.message);
      throw new Error(`FASE enviarReporte: ${err.message}`);
    }

    // 5. Validar mensaje de éxito (pantalla de éxito .exito-card)
    let textoExito = '';
    try {
      const pantallaExito = await findFirstVisible(driver, locatorsPantallaExito(), CONFIG.timeouts.long, 'pantalla de éxito');
      textoExito = ((await pantallaExito.getText()) || '').replace(/\s+/g, ' ').trim();
      if (!/reporte registrado exitosamente/i.test(textoExito)) {
        throw new Error(`No se encontró el texto "¡Reporte registrado exitosamente!" en la pantalla. Texto actual: "${textoExito.substring(0, 120)}"`);
      }
      log(`✅ Mensaje de éxito mostrado: "${textoExito.substring(0, 100)}"`);
      marcarFase('validarMensajeExito', 'PASÓ', `"${textoExito.substring(0, 80)}"`);
    } catch (err) {
      marcarFase('validarMensajeExito', 'FALLÓ', err.message);
      // Si hay alerta de error, incluimos su texto para diagnóstico
      const alertaErr = await findFirstVisibleOrNull(driver, locatorsAlertaError(), 500, 'alerta de error');
      if (alertaErr) {
        const txtErr = await alertaErr.getText();
        log(`⚠️ Alerta de error en pantalla: "${txtErr}"`);
      }
      throw new Error(`FASE validarMensajeExito: ${err.message}`);
    }

    // 6. Validar código de operación (.exito-card .codigo)
    try {
      const elCodigo = await findFirstVisible(driver, locatorsCodigoOperacion(), CONFIG.timeouts.medium, 'código de operación');
      const codigo = ((await elCodigo.getText()) || '').trim();
      if (!codigo) {
        throw new Error('El código de operación está vacío.');
      }
      // Validación mínima: no debe ser un placeholder vacío
      if (codigo.length < 3) {
        throw new Error(`Código de operación inválido o demasiado corto: "${codigo}"`);
      }
      reporte.codigoReporte = codigo;
      log(`🔖 Código de operación: "${codigo}"`);
      marcarFase('validarCodigoOperacion', 'PASÓ', `codigo="${codigo}"`);
    } catch (err) {
      marcarFase('validarCodigoOperacion', 'FALLÓ', err.message);
      throw new Error(`FASE validarCodigoOperacion: ${err.message}`);
    }

    // 7. (Opcional) Validar resumen del reporte
    try {
      const resumen = await findFirstVisibleOrNull(driver, locatorsResumenReporte(), CONFIG.timeouts.short, 'resumen del reporte');
      if (resumen) {
        const txtResumen = ((await resumen.getText()) || '').replace(/\s+/g, ' ').trim();
        reporte.resumenReporte = txtResumen;
        log(`📋 Resumen del reporte: "${txtResumen}"`);
      }
    } catch (_) { /* opcional */ }

    reporte.resultadoFinal = 'PASÓ';
    log('🎉 ¡El caso de prueba TC-016 PASÓ exitosamente!');

    const rutaEvidencia = await guardarEvidencia(driver, CONFIG.evidenceName);
    reporte.evidencia = rutaEvidencia;

  } catch (err) {
    reporte.resultadoFinal = 'FALLÓ';
    reporte.errorDetalle = err.message;
    log(`❌ Error crítico en TC-016: ${err.message}`);

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