/**
 * ============================================================================
 * TC-017 - test_registrar_solicitud_Particion_invalida
 * ============================================================================
 * ID Test      : TC-017
 * Historia     : HU-16 (validación negativa)
 * Tipo         : Partición de equivalencia inválida
 * Categoría    : Control de Calidad / Registro de Solicitud (Ticket)
 * Prioridad    : Alta
 * Automatización: Sí
 *
 * Escenario:
 *   "Dado que soy un cliente registrado, cuando registre mi solicitud
 *    (adjuntando el tipo de equipo, número de serie, marca, modelo y
 *    descripción de falla de MENOS de 10 caracteres), entonces el sistema
 *    NO debe generar el reporte."
 *
 * Objetivo:
 *   Verificar que el sistema genere un error y no registre el reporte de
 *   solicitud cuando la descripción tiene menos de 10 caracteres.
 *
 * Precondiciones:
 *   - Cliente registrado e iniciado sesión previamente en la plataforma
 *
 * Datos de entrada (inválidos a propósito):
 *   - Tipo de equipo  = Laptop
 *   - Número de serie = SN-2024-002
 *   - Marca           = Lenovo
 *   - Modelo          = Thinkpad
 *   - Descripción     = "falla PC"  (8 caracteres < 10 → INVÁLIDO)
 *
 * Pasos:
 *   1. Ingresar al panel cliente y navegar a la sección GENERAR SOLICITUD
 *   2. Llenar el formulario para registrar la solicitud de reparación
 *   3. Hacer clic en enviar reporte
 *
 * Resultado Esperado:
 *   El sistema NO debe permitir el registro y debe mostrar un mensaje de
 *   error indicando que la descripción es muy corta (mínimo 10 caracteres).
 *
 * Evidencia: TC-017_evidencia_registrar_solicitud_Particion_invalida.png
 *
 * Instrucciones de ejecución:
 *   node tests/registrar-solicitud-particion-invalida.js
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
  evidenceName: 'TC-017_evidencia_registrar_solicitud_Particion_invalida.png',
  evidenceFailName: 'TC-017_evidencia_registrar_solicitud_Particion_invalida_FALLO.png',
  jsonReportName: 'reporte-TC-017.json',
  timeouts: {
    short: 3000,
    medium: 8000,
    long: 15000,
  },
  // Datos de entrada INVÁLIDOS (descripción < 10 caracteres)
  datosSolicitud: {
    tipoEquipo: 'Laptop',
    numeroSerie: 'SN-2024-002',
    marca: 'Lenovo',
    modelo: 'Thinkpad',
    descripcionFalla: 'falla PC', // 8 caracteres → INVÁLIDO (mínimo 10)
    minimoCaracteres: 10,
  },
};

// ============================================================================
// ESTADO DEL REPORTE
// ============================================================================
const reporte = {
  test: 'TC-017',
  nombre: 'test_registrar_solicitud_Particion_invalida',
  historia: 'HU-16',
  fechaInicio: new Date().toISOString(),
  fases: {
    loginCliente: { estado: 'NO_EJECUTADO', detalle: '' },
    navegacionGenerarSolicitud: { estado: 'NO_EJECUTADO', detalle: '' },
    completarFormularioInvalido: { estado: 'NO_EJECUTADO', detalle: '' },
    enviarReporte: { estado: 'NO_EJECUTADO', detalle: '' },
    validarErrorDescripcionCorta: { estado: 'NO_EJECUTADO', detalle: '' },
    validarNoSeRegistro: { estado: 'NO_EJECUTADO', detalle: '' },
  },
  resultadoFinal: 'NO_EJECUTADO',      // PASÓ = el sistema se comportó bien (rechazó)
  resultadoNegocio: 'NO_EJECUTADO',    // RECHAZADO = correcto para este TC
  mensajeErrorCapturado: null,
  codigoReporte: null,                  // Debe quedar null si el sistema rechaza
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
  console.log(`[TC-017] ${msg}`);
}

function logDebug(msg) {
  if (CONFIG.debug) console.log(`[TC-017][DEBUG] ${msg}`);
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
    const rutaHtml = path.join(CONFIG.artifactsDir, `TC-017_dump_${sufijo}.html`);
    fs.writeFileSync(rutaHtml, html, 'utf8');
    log(`📄 HTML dump guardado: ${rutaHtml}`);
    await guardarEvidencia(driver, `TC-017_dump_${sufijo}.png`);
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
    await dumpSection('ALERTAS/ÉXITO', '.alerta-error, .exito-card, .codigo, .toast-error, .mat-snack-bar-container');
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

function locatorsSelectMarca() {
  return [
    { by: By.css('select[name="marcaSelect"]'), desc: 'select[name=marcaSelect]' },
    { by: By.css('select[name="marca"]'), desc: 'select[name=marca]' },
  ];
}

function locatorsInputModelo() {
  return [
    { by: By.css('input[name="modelo"]'), desc: 'input[name=modelo]' },
    { by: By.css('input[placeholder*="ThinkPad" i]'), desc: 'input placeholder ThinkPad' },
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
 * Alerta de error en el formulario: <div class="alerta-error">⚠️ {{ error }}</div>
 * En este TC, el texto debe indicar "Descripción corta (mínimo 10 caracteres)".
 */
function locatorsAlertaError() {
  return [
    { by: By.css('.alerta-error'), desc: '.alerta-error' },
    { by: By.xpath("//*[contains(translate(.,'DESCRIPCIÓN','descripción'),'descripción') and (contains(translate(.,'CORTA','corta'),'corta') or contains(translate(.,'MÍNIMO','mínimo'),'mínimo') or contains(translate(.,'MINIMO','minimo'),'minimo') or contains(translate(.,'10','10'),'10'))]"), desc: 'xpath descripción corta/mínimo 10' },
  ];
}

/**
 * Pantalla de éxito: NO debe aparecer en este TC.
 * Se usa para validar la NO-regresión (asegurar que el reporte NO se registró).
 */
function locatorsPantallaExito() {
  return [
    { by: By.css('.exito-card'), desc: '.exito-card' },
    { by: By.css('.exito-card h2'), desc: '.exito-card h2' },
    { by: By.css('.exito-card .codigo'), desc: '.exito-card .codigo' },
    { by: By.xpath("//*[contains(translate(.,'REPORTE REGISTRADO','reporte registrado'),'reporte registrado')]"), desc: 'xpath Reporte registrado' },
  ];
}

function locatorsResumenReporte() {
  return [
    { by: By.css('.resumen-reporte'), desc: '.resumen-reporte' },
  ];
}

// ============================================================================
// EJECUCIÓN PRINCIPAL (TC-017)
// ============================================================================
async function run() {
  asegurarArtifactsDir();
  let driver;

  try {
    const options = new chrome.Options();
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--window-size=1920,1080');
    // options.addArguments('--headless=new');

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    log('🚀 Iniciando automatización TC-017 (Solicitud con descripción corta - partición inválida)...');

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

    // 3. Completar el formulario con datos INVÁLIDOS (descripción corta)
    try {
      const { tipoEquipo, numeroSerie, marca, modelo, descripcionFalla, minimoCaracteres } = CONFIG.datosSolicitud;

      // Validación previa (sanity check del propio test)
      if (descripcionFalla.length >= minimoCaracteres) {
        throw new Error(
          `Datos del test inconsistentes: la descripción "${descripcionFalla}" tiene ${descripcionFalla.length} caracteres y debería ser < ${minimoCaracteres}.`
        );
      }
      log(`🧪 Descripción inválida elegida: "${descripcionFalla}" (${descripcionFalla.length} caracteres < ${minimoCaracteres})`);

      // 3.1 Tipo de equipo (SELECT nativo)
      const elTipo = await findFirstVisible(driver, locatorsSelectTipoEquipo(), CONFIG.timeouts.medium, 'select tipoEquipo');
      const selTipo = new Select(elTipo);
      try {
        await selTipo.selectByVisibleText(tipoEquipo);
      } catch (_) {
        try { await selTipo.selectByValue(tipoEquipo); } catch (__) { /* fallback abajo */ }
      }
      log(`📝 Tipo equipo: "${tipoEquipo}"`);

      // 3.2 Número de serie
      const elSerie = await findFirstVisible(driver, locatorsInputNumeroSerie(), CONFIG.timeouts.medium, 'input numeroSerie');
      await elSerie.clear();
      await elSerie.sendKeys(numeroSerie);
      log(`🔢 Número de serie: "${numeroSerie}"`);

      // 3.3 Marca (SELECT nativo)
      const elMarca = await findFirstVisible(driver, locatorsSelectMarca(), CONFIG.timeouts.medium, 'select marcaSelect');
      const selMarca = new Select(elMarca);
      try {
        await selMarca.selectByVisibleText(marca);
      } catch (_) {
        try { await selMarca.selectByValue(marca); } catch (__) { /* fallback abajo */ }
      }
      log(`🏷️ Marca: "${marca}"`);

      // 3.4 Modelo
      const elModelo = await findFirstVisible(driver, locatorsInputModelo(), CONFIG.timeouts.medium, 'input modelo');
      await elModelo.clear();
      await elModelo.sendKeys(modelo);
      log(`📦 Modelo: "${modelo}"`);

      // 3.5 Descripción CORTA (inválida)
      const elDesc = await findFirstVisible(driver, locatorsTextareaDescripcion(), CONFIG.timeouts.medium, 'textarea descripcionFalla');
      await elDesc.clear();
      await elDesc.sendKeys(descripcionFalla);
      log(`📄 Descripción inválida ingresada: "${descripcionFalla}" (${descripcionFalla.length} caracteres)`);

      marcarFase('completarFormularioInvalido', 'PASÓ',
        `desc="${descripcionFalla}" (${descripcionFalla.length} chars < ${minimoCaracteres})`);
    } catch (err) {
      marcarFase('completarFormularioInvalido', 'FALLÓ', err.message);
      throw new Error(`FASE completarFormularioInvalido: ${err.message}`);
    }

    // 4. Click en "Enviar reporte"
    try {
      const btnEnviar = await findFirstVisible(driver, locatorsBtnEnviarReporte(), CONFIG.timeouts.medium, 'botón Enviar reporte');
      try { await btnEnviar.click(); } catch (_) { await driver.executeScript('arguments[0].click();', btnEnviar); }
      log('📤 Click en "Enviar reporte" (con datos inválidos)');
      await driver.sleep(1500);
      marcarFase('enviarReporte', 'PASÓ', 'click ejecutado');
    } catch (err) {
      marcarFase('enviarReporte', 'FALLÓ', err.message);
      throw new Error(`FASE enviarReporte: ${err.message}`);
    }

    // 5. Validar que aparece el mensaje de error de descripción corta
    try {
      // Buscar el .alerta-error con texto relacionado a "corta" / "mínimo 10"
      const deadline = Date.now() + CONFIG.timeouts.long;
      let alertaEncontrada = null;
      let textoError = '';

      while (Date.now() < deadline) {
        const alerta = await findFirstVisibleOrNull(driver, locatorsAlertaError(), 1000, 'alerta de error');
        if (alerta) {
          const txt = ((await alerta.getText()) || '').replace(/\s+/g, ' ').trim();
          if (txt) {
            // Verificar que el mensaje mencione descripción corta o mínimo 10
            const txtLower = txt.toLowerCase();
            const esErrorDescripcion =
              txtLower.includes('corta') ||
              txtLower.includes('corto') ||
              txtLower.includes('mínimo') ||
              txtLower.includes('minimo') ||
              txtLower.includes('10 caracteres') ||
              txtLower.includes('descripci');

            if (esErrorDescripcion) {
              alertaEncontrada = alerta;
              textoError = txt;
              break;
            }
          }
        }
        await driver.sleep(300);
      }

      if (!alertaEncontrada) {
        throw new Error('No apareció el mensaje de error de descripción corta (mínimo 10 caracteres).');
      }

      reporte.mensajeErrorCapturado = textoError;
      log(`✅ Mensaje de error mostrado: "${textoError}"`);

      // Validación estricta del texto esperado (contiene "corta" o "mínimo 10")
      const cumpleMensaje =
        /corta|corto|mínimo|minimo|10 caracteres/i.test(textoError);
      if (!cumpleMensaje) {
        throw new Error(`El mensaje de error no menciona "descripción corta" ni "mínimo 10 caracteres". Texto: "${textoError}"`);
      }

      marcarFase('validarErrorDescripcionCorta', 'PASÓ', `"${textoError.substring(0, 80)}"`);
    } catch (err) {
      marcarFase('validarErrorDescripcionCorta', 'FALLÓ', err.message);
      throw new Error(`FASE validarErrorDescripcionCorta: ${err.message}`);
    }

    // 6. Validar que el reporte NO se registró (no aparece .exito-card ni código)
    try {
      // Esperar un poco para descartar navegación tardía
      await driver.sleep(1500);

      const exitoCard = await findFirstVisibleOrNull(driver, locatorsPantallaExito(), CONFIG.timeouts.short, 'pantalla de éxito');
      if (exitoCard) {
        const txtExito = ((await exitoCard.getText()) || '').replace(/\s+/g, ' ').trim();
        throw new Error(`¡El sistema SÍ registró el reporte! Apareció pantalla de éxito: "${txtExito.substring(0, 100)}"`);
      }

      // Verificar que seguimos en el formulario (no navegó)
      const urlActual = await driver.getCurrentUrl();
      if (!/generar-solicitud|reporte|cliente/i.test(urlActual)) {
        logDebug(`URL actual inesperada: ${urlActual} (puede ser OK si sigue en el form)`);
      }

      // Verificar que NO existe el código de operación en pantalla
      const codigoEl = await findFirstVisibleOrNull(driver, [{ by: By.css('.codigo'), desc: '.codigo' }], CONFIG.timeouts.short, 'código');
      if (codigoEl) {
        const txtCod = ((await codigoEl.getText()) || '').trim();
        if (txtCod) {
          throw new Error(`¡El sistema generó un código de operación "${txtCod}" a pesar de la descripción inválida!`);
        }
      }

      // Confirmar que el formulario sigue visible
      const textarea = await findFirstVisibleOrNull(driver, locatorsTextareaDescripcion(), CONFIG.timeouts.short, 'textarea descripción');
      if (!textarea) {
        throw new Error('El formulario de solicitud desapareció (posible registro exitoso).');
      }

      reporte.codigoReporte = null;
      marcarFase('validarNoSeRegistro', 'PASÓ', 'no apareció pantalla de éxito ni código de operación');
    } catch (err) {
      marcarFase('validarNoSeRegistro', 'FALLÓ', err.message);
      throw new Error(`FASE validarNoSeRegistro: ${err.message}`);
    }

    // Si llegamos aquí, el sistema rechazó correctamente la solicitud
    reporte.resultadoFinal = 'PASÓ';        // El test pasó
    reporte.resultadoNegocio = 'RECHAZADO'; // El sistema rechazó (correcto para TC-017)
    log('🎉 ¡El caso de prueba TC-017 PASÓ exitosamente! El sistema rechazó correctamente la solicitud.');

    const rutaEvidencia = await guardarEvidencia(driver, CONFIG.evidenceName);
    reporte.evidencia = rutaEvidencia;

  } catch (err) {
    reporte.resultadoFinal = 'FALLÓ';
    reporte.errorDetalle = err.message;
    log(`❌ Error crítico en TC-017: ${err.message}`);

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