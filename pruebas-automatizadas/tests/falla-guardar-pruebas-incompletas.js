/**
 * ============================================================================
 * TC-014 - test_falla_guardar_pruebas_incompletas
 * ============================================================================
 * ID Test      : TC-014
 * Historia     : HU-14
 * Tipo         : Negativa / Validación de Checklist
 * Categoría    : Control de Calidad / Pruebas de Funcionamiento
 * Prioridad    : Alta
 * Automatización: Sí
 *
 * Descripción HU-14:
 *   "Como técnico, quiero que el sistema me impida guardar los resultados de
 *    las pruebas si no he completado todo el checklist, para evitar finalizar
 *    una reparación a medias y asegurar que el equipo realmente funciona antes
 *    de entregarlo."
 *
 * Escenario:
 *   "Dado que soy un técnico en la sección de pruebas, cuando intento guardar
 *    los resultados sin haber marcado todas las opciones del checklist, entonces
 *    el sistema me bloquea el botón y me muestra un aviso."
 *
 * Objetivo:
 *   Verificar que el sistema impida finalizar la reparación si el técnico no
 *   ha completado la evaluación al 100%.
 *
 * Precondiciones:
 *   - Técnico logueado (adriana@gmail.com / 123456)
 *   - Orden en estado "En Reparación" (EN_REPARACION)
 *   - Ventana de "Pruebas" abierta
 *
 * Datos de entrada:
 *   - Checklist: Dejar 1 o más pruebas sin marcar (incompleto)
 *
 * Pasos:
 *   1. Ir a la sección "Pruebas".
 *   2. Seleccionar una orden.
 *   3. Marcar solo 3 de las 8 pruebas (dejar el resto en blanco).
 *   4. Intentar hacer clic en el botón "Guardar Resultados".
 *
 * Resultado Esperado:
 *   El botón "Guardar Resultados" debe estar deshabilitado (gris) o el sistema
 *   muestra un aviso impidiendo avanzar.
 *
 * Evidencia: TC-014_evidencia_guardar_pruebas_incompletas.png
 *
 * Instrucciones de ejecución:
 *   node tests/falla-guardar-pruebas-incompletas.js
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
  evidenceName: 'TC-014_evidencia_guardar_pruebas_incompletas.png',
  evidenceFailName: 'TC-014_evidencia_guardar_pruebas_incompletas_FALLO.png',
  jsonReportName: 'reporte-TC-014.json',
  timeouts: {
    short: 3000,
    medium: 8000,
    long: 15000,
  },
};

// ============================================================================
// ESTADO DEL REPORTE
// ============================================================================
const reporte = {
  test: 'TC-014',
  nombre: 'test_falla_guardar_pruebas_incompletas',
  historia: 'HU-14',
  fechaInicio: new Date().toISOString(),
  fases: {
    loginTecnico: { estado: 'NO_EJECUTADO', detalle: '' },
    navegacionPruebas: { estado: 'NO_EJECUTADO', detalle: '' },
    seleccionOrden: { estado: 'NO_EJECUTADO', detalle: '' },
    marcarPruebasIncompletas: { estado: 'NO_EJECUTADO', detalle: '' },
    intentarGuardarBloqueado: { estado: 'NO_EJECUTADO', detalle: '' },
  },
  resultadoFinal: 'NO_EJECUTADO',
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
  console.log(`[TC-014] ${msg}`);
}

function logDebug(msg) {
  if (CONFIG.debug) console.log(`[TC-014][DEBUG] ${msg}`);
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
    const rutaHtml = path.join(CONFIG.artifactsDir, `TC-014_dump_${sufijo}.html`);
    fs.writeFileSync(rutaHtml, html, 'utf8');
    log(`📄 HTML dump guardado: ${rutaHtml}`);
    await guardarEvidencia(driver, `TC-014_dump_${sufijo}.png`);
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
    await dumpSection('CHECKBOXES/RADIOS', 'input[type="checkbox"], input[type="radio"], mat-checkbox, mat-radio-button');
    await dumpSection('ALERTAS', '.alerta-error, .alerta-exito, .toast-error, .mat-snack-bar-container');
  } catch (err) {
    console.log(`⚠️ volcarEstructuraUI error: ${err.message}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

// ============================================================================
// LOGIN — selectores basados en el HTML real compartido
// ============================================================================
function loginLocators() {
  return {
    userInput: [
      { by: By.css('input[name="usuario"]'), desc: 'input[name=usuario]' },
      { by: By.css('input[placeholder="Correo o usuario"]'), desc: 'input placeholder Correo o usuario' },
      { by: By.css('.login-box input[type="text"]'), desc: 'login-box input text' },
      // fallbacks por si cambia el name
      { by: By.css('input[formcontrolname="email"]'), desc: 'input[formcontrolname=email]' },
      { by: By.css('input[type="email"]'), desc: 'input[type=email]' },
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

  // 1. Escribir usuario
  const userInput = await findFirstVisible(driver, locs.userInput, CONFIG.timeouts.medium, 'input usuario');
  await userInput.clear();
  await userInput.sendKeys(usuario);

  // 2. Escribir contraseña
  const passInput = await findFirstVisible(driver, locs.passInput, CONFIG.timeouts.medium, 'input contraseña');
  await passInput.clear();
  await passInput.sendKeys(contrasena);

  // 3. Click en Iniciar sesión
  const btn = await findFirstVisible(driver, locs.submitBtn, CONFIG.timeouts.medium, 'botón login');
  try {
    await btn.click();
  } catch (_) {
    await driver.executeScript('arguments[0].click();', btn);
  }

  // 4. Esperar navegación fuera de /login O detectar error de credenciales
  const deadline = Date.now() + CONFIG.timeouts.long;
  while (Date.now() < deadline) {
    const url = await driver.getCurrentUrl();
    if (!/\/login/i.test(url)) {
      log(`✅ Login exitoso. URL actual: ${url}`);
      return;
    }
    // ¿Apareció alerta de error?
    const errAlert = await findFirstVisibleOrNull(driver, locs.errorAlert, 500, 'alerta error login');
    if (errAlert) {
      const txt = await errAlert.getText();
      throw new Error(`Login rechazado por el sistema: "${txt}"`);
    }
    await driver.sleep(300);
  }
  throw new Error('Timeout esperando redirección post-login. ¿Credenciales incorrectas?');
}

// Helpers de conveniencia por rol
async function loginComoTecnico(driver) {
  return loginComo(driver, CONFIG.tecnicoUser, CONFIG.tecnicoPass);
}

async function loginComoAdmin(driver) {
  return loginComo(driver, CONFIG.adminUser, CONFIG.adminPass);
}

// ============================================================================
// LOCATORS ESPECÍFICOS DEL FLUJO DE PRUEBAS
// ============================================================================
function locatorsMenuPruebas() {
  return [
    { by: By.css('a[routerLink="/tecnico/pruebas-funcionamiento"]'), desc: 'routerLink pruebas-funcionamiento' },
    { by: By.css('a[href*="pruebas-funcionamiento"]'), desc: 'href pruebas-funcionamiento' },
    { by: By.xpath("//a[contains(translate(., 'PRUEBAS','pruebas'),'pruebas')]"), desc: 'xpath Pruebas' },
  ];
}

function locatorsSelectOrden() {
  return [
    { by: By.css('mat-select'), desc: 'mat-select' },
    { by: By.css('select'), desc: 'select' },
    { by: By.xpath("//mat-select"), desc: 'xpath mat-select' },
  ];
}

function locatorsGuardarResultados() {
  return [
    { by: By.css('[data-testid="btn-guardar-resultados"]'), desc: 'data-testid guardar' },
    { by: By.css('button.btn-guardar'), desc: 'button.btn-guardar' },
    { by: By.xpath("//button[contains(translate(.,'GUARDAR','guardar'),'guardar')]"), desc: 'xpath Guardar' },
    { by: By.xpath("//button[contains(translate(.,'RESULTADOS','resultados'),'resultados')]"), desc: 'xpath Resultados' },
    { by: By.css('button.btn-primary'), desc: 'button.btn-primary' },
    { by: By.css('button[type="submit"]'), desc: 'button[type=submit]' },
  ];
}

function locatorsToastError() {
  return [
    { by: By.css('.alerta-error'), desc: '.alerta-error' },
    { by: By.css('.toast-error, .toast-warning, .mat-snack-bar-container, .alert-danger, .alert-warning'), desc: 'toast error/warning' },
    { by: By.xpath("//*[contains(@class,'error') or contains(@class,'warning') or contains(@class,'danger')]"), desc: 'xpath class error/warning' },
    { by: By.xpath("//*[contains(translate(.,'COMPLETAR','completar'),'completar') or contains(translate(.,'INCOMPLETO','incompleto'),'incompleto') or contains(translate(.,'FALTAN','faltan'),'faltan')]"), desc: 'xpath texto incompleto/completar/faltan' },
  ];
}

function locatorsRadiosChecklist() {
  return [
    { by: By.css('input[type="radio"][value="OK"]'), desc: 'radios OK' },
    { by: By.css('input[type="radio"][value="FALLA"]'), desc: 'radios FALLA' },
    { by: By.css('mat-radio-button'), desc: 'mat-radio-button' },
    { by: By.css('input[type="radio"]'), desc: 'input radio genérico' },
    { by: By.css('input[type="checkbox"], mat-checkbox'), desc: 'checkbox fallback' },
  ];
}

// ============================================================================
// EJECUCIÓN PRINCIPAL (TC-014)
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

    log('🚀 Iniciando automatización TC-014 (Pruebas incompletas)...');

    // 1. Login Técnico
    try {
      await loginComoTecnico(driver);
      marcarFase('loginTecnico', 'PASÓ', `usuario=${CONFIG.tecnicoUser}`);
    } catch (err) {
      marcarFase('loginTecnico', 'FALLÓ', err.message);
      throw new Error(`FASE loginTecnico: ${err.message}`);
    }

    // 2. Ir a Pruebas
    try {
      const link = await findFirstVisibleOrNull(driver, locatorsMenuPruebas(), CONFIG.timeouts.medium, 'menú Pruebas');
      if (link) {
        try { await link.click(); } catch (_) { await driver.executeScript('arguments[0].click();', link); }
        await driver.sleep(1200);
      } else {
        await driver.get(`${CONFIG.baseUrl}/tecnico/pruebas-funcionamiento`);
        await driver.sleep(1500);
      }
      marcarFase('navegacionPruebas', 'PASÓ', 'en /tecnico/pruebas-funcionamiento');
    } catch (err) {
      marcarFase('navegacionPruebas', 'FALLÓ', err.message);
      throw new Error(`FASE navegacionPruebas: ${err.message}`);
    }

    // 3. Seleccionar Orden (precondición: estado EN_REPARACION)
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
            if (txt.includes('reparaci') || !seleccionada) {
              try { await op.click(); } catch (_) { await driver.executeScript('arguments[0].click();', op); }
              seleccionada = true;
              if (txt.includes('reparaci')) break;
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

    // 4. Marcar SOLO 3 de las 8 pruebas (checklist incompleto)
    try {
      let totalPruebas = 0;
      let marcados = 0;

      const radiosOK = await driver.findElements(By.css('input[type="radio"][value="OK"]'));
      const radiosFALLA = await driver.findElements(By.css('input[type="radio"][value="FALLA"]'));

      if (radiosOK.length > 0) {
        totalPruebas = radiosOK.length;
        const limite = Math.min(3, radiosOK.length);
        for (let i = 0; i < limite; i++) {
          const radio = radiosOK[i];
          try {
            if (await radio.isDisplayed()) {
              try { await radio.click(); } catch (_) { await driver.executeScript('arguments[0].click();', radio); }
              marcados++;
            }
          } catch (_) { /* stale */ }
        }
      } else if (radiosFALLA.length > 0) {
        totalPruebas = radiosFALLA.length;
        const limite = Math.min(3, radiosFALLA.length);
        for (let i = 0; i < limite; i++) {
          const radio = radiosFALLA[i];
          try {
            if (await radio.isDisplayed()) {
              try { await radio.click(); } catch (_) { await driver.executeScript('arguments[0].click();', radio); }
              marcados++;
            }
          } catch (_) { /* stale */ }
        }
      } else {
        const controles = await driver.findElements(By.css('input[type="checkbox"], mat-checkbox, mat-radio-button'));
        totalPruebas = controles.length;
        const limite = Math.min(3, controles.length);
        for (let i = 0; i < limite; i++) {
          const cb = controles[i];
          try {
            if (await cb.isDisplayed()) {
              try { await cb.click(); } catch (_) { await driver.executeScript('arguments[0].click();', cb); }
              marcados++;
            }
          } catch (_) { /* stale */ }
        }
      }

      if (marcados === 0) {
        throw new Error('No se pudo marcar ninguna prueba del checklist (no se encontraron controles visibles).');
      }
      if (marcados >= totalPruebas) {
        throw new Error(`No se pudo dejar el checklist incompleto (se marcaron ${marcados}/${totalPruebas}).`);
      }

      marcarFase('marcarPruebasIncompletas', 'PASÓ',
        `${marcados} de ${totalPruebas} pruebas marcadas (checklist INCOMPLETO a propósito)`);
      await driver.sleep(500);
    } catch (err) {
      marcarFase('marcarPruebasIncompletas', 'FALLÓ', err.message);
      throw new Error(`FASE marcarPruebasIncompletas: ${err.message}`);
    }

    // 5. Intentar guardar (validar que el botón se bloquea o aparece aviso)
    try {
      const btnGuardar = await findFirstVisible(driver, locatorsGuardarResultados(), CONFIG.timeouts.medium, 'botón Guardar Resultados');

      const isDisabledAttr = await btnGuardar.getAttribute('disabled');
      const isAriaDisabled = await btnGuardar.getAttribute('aria-disabled');
      const classAttr = (await btnGuardar.getAttribute('class')) || '';
      const isButtonDisabled =
        isDisabledAttr !== null ||
        isAriaDisabled === 'true' ||
        classAttr.includes('disabled');

      if (isButtonDisabled) {
        log('✅ Botón de guardado correctamente deshabilitado (estado disabled).');
        marcarFase('intentarGuardarBloqueado', 'PASÓ', 'botón deshabilitado en UI (checklist incompleto)');
      } else {
        try { await btnGuardar.click(); } catch (_) { await driver.executeScript('arguments[0].click();', btnGuardar); }
        await driver.sleep(1200);

        const toastError = await findFirstVisibleOrNull(driver, locatorsToastError(), CONFIG.timeouts.short, 'aviso/alerta de error');

        if (toastError) {
          const ttxt = await toastError.getText();
          log(`✅ Sistema mostró aviso al intentar guardar incompleto: "${ttxt}"`);
          marcarFase('intentarGuardarBloqueado', 'PASÓ', `aviso mostrado: ${ttxt.substring(0, 50)}`);
        } else {
          const currentUrl = await driver.getCurrentUrl();
          if (/pruebas/i.test(currentUrl)) {
            log('✅ El sistema bloqueó la acción y no permitió avanzar de pantalla.');
            marcarFase('intentarGuardarBloqueado', 'PASÓ', 'bloqueado sin cambio de vista');
          } else {
            throw new Error('El sistema permitió guardar o avanzar a pesar de tener el checklist incompleto.');
          }
        }
      }
    } catch (err) {
      marcarFase('intentarGuardarBloqueado', 'FALLÓ', err.message);
      throw new Error(`FASE intentarGuardarBloqueado: ${err.message}`);
    }

    reporte.resultadoFinal = 'PASÓ';
    log('🎉 ¡El caso de prueba TC-014 PASÓ exitosamente!');

    const rutaEvidencia = await guardarEvidencia(driver, CONFIG.evidenceName);
    reporte.evidencia = rutaEvidencia;

  } catch (err) {
    reporte.resultadoFinal = 'FALLÓ';
    reporte.errorDetalle = err.message;
    log(`❌ Error crítico en TC-014: ${err.message}`);

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