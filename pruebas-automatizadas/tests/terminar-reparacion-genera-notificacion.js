/**
 * ============================================================================
 * TC-013 - test_terminar_reparacion_genera_notificacion_admin
 * ============================================================================
 * ID Test      : TC-013
 * Historia     : HU-13
 * Tipo         : Integración
 * Categoría    : Notificaciones (correo, push, SMS)
 * Prioridad    : Media
 * Automatización: Parcial
 *
 * Descripción HU-13:
 *   "Como técnico, quiero que el sistema envíe una notificación automática al
 *    administrador cuando termino todas las pruebas de un equipo, para que el
 *    administrador sepa que el equipo ya está listo."
 *
 * Escenario:
 *   "Dado que soy un técnico y he terminado todas las pruebas de un equipo,
 *    cuando guardo los resultados, entonces el sistema genera una notificación
 *    para el administrador indicando que el equipo está listo."
 *
 * Objetivo:
 *   Verificar que al cambiar la orden a "Terminado", el sistema cree
 *   automáticamente una notificación para el administrador.
 *
 * Precondiciones:
 *   - Técnico logueado (adriana@gmail.com / 123456)
 *   - Orden en estado "En Reparación" (EN_REPARACION)
 *   - Administrador puede iniciar sesión (admin@gmail.com / 123456)
 *
 * Pasos:
 *   1. Iniciar sesión como Técnico.
 *   2. Ir a "Pruebas", seleccionar la orden.
 *   3. Marcar todo como "OK" y guardar.
 *   4. Iniciar sesión como Administrador.
 *   5. Ir a "Notificaciones".
 *
 * Resultado Esperado:
 *   El administrador ve una nueva notificación con el texto:
 *   "Reparación Terminada: La orden OT-XX está lista. Ya puede pagarse."
 *
 * Evidencia: TC-013_evidencia_terminar_reparacion_notificacion_admin.png
 *
 * Instrucciones de ejecución:
 *   node tests/terminar-reparacion-genera-notificacion.js
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
  evidenceName: 'TC-013_evidencia_terminar_reparacion_notificacion_admin.png',
  evidenceFailName: 'TC-013_evidencia_terminar_reparacion_notificacion_admin_FALLO.png',
  jsonReportName: 'reporte-TC-013.json',
  timeouts: {
    short: 3000,
    medium: 8000,
    long: 15000,
    notifRetry: 15000,
  },
};

// Regex para detectar la notificación esperada
const NOTIF_REGEX = /reparaci[oó]n\s+terminad[oa]|orden\s+OT[-\s]?\w+\s+est[aá]\s+lista|list[oa].*pagar|ya\s+puede\s+pagarse/i;

// ============================================================================
// ESTADO DEL REPORTE
// ============================================================================
const reporte = {
  test: 'TC-013',
  nombre: 'test_terminar_reparacion_genera_notificacion_admin',
  historia: 'HU-13',
  fechaInicio: new Date().toISOString(),
  fases: {
    loginTecnico: { estado: 'NO_EJECUTADO', detalle: '' },
    navegacionPruebas: { estado: 'NO_EJECUTADO', detalle: '' },
    seleccionOrden: { estado: 'NO_EJECUTADO', detalle: '' },
    marcarPruebasOK: { estado: 'NO_EJECUTADO', detalle: '' },
    guardarResultados: { estado: 'NO_EJECUTADO', detalle: '' },
    estadoTerminado: { estado: 'NO_EJECUTADO', detalle: '' },
    logoutTecnico: { estado: 'NO_EJECUTADO', detalle: '' },
    loginAdmin: { estado: 'NO_EJECUTADO', detalle: '' },
    panelNotificaciones: { estado: 'NO_EJECUTADO', detalle: '' },
    notificacionRecibida: { estado: 'NO_EJECUTADO', detalle: '' },
  },
  resultadoFinal: 'NO_EJECUTADO',
  errorDetalle: null,
  idOrdenDetectado: null,
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
  console.log(`[TC-013] ${msg}`);
}

function logDebug(msg) {
  if (CONFIG.debug) console.log(`[TC-013][DEBUG] ${msg}`);
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

async function esperarTexto(driver, locators, regex, timeout = CONFIG.timeouts.long) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const loc of locators) {
      try {
        const els = await driver.findElements(loc.by);
        for (const el of els) {
          try {
            if (!(await el.isDisplayed())) continue;
            const txt = (await el.getText()) || '';
            if (regex.test(txt)) {
              logDebug(`esperarTexto OK via ${loc.desc}: "${txt.substring(0, 120)}"`);
              return txt;
            }
          } catch (_) { /* stale */ }
        }
      } catch (_) { /* ignore */ }
    }
    await driver.sleep(300);
  }
  throw new Error(`No se encontró texto que cumpla ${regex} en ${timeout} ms`);
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
    const rutaHtml = path.join(CONFIG.artifactsDir, `TC-013_dump_${sufijo}.html`);
    fs.writeFileSync(rutaHtml, html, 'utf8');
    log(`📄 HTML dump guardado: ${rutaHtml}`);
    await guardarEvidencia(driver, `TC-013_dump_${sufijo}.png`);
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
            const href = (await el.getAttribute('href')) || '';
            visibles.push({ tag, txt, id, name, cls: cls.substring(0, 80), type, href });
          }
        } catch (_) { /* stale */ }
      }
      console.log(`\n--- ${label} (${visibles.length} visibles) ---`);
      visibles.slice(0, 30).forEach((e, i) => {
        console.log(` [${i}] <${e.tag}${e.type ? ' type=' + e.type : ''}> ` +
          `id="${e.id}" name="${e.name}" class="${e.cls}" href="${e.href}" ` +
          `text="${e.txt}"`);
      });
    };
    await dumpSection('INPUTS', 'input');
    await dumpSection('CHECKBOXES/RADIOS', 'input[type="checkbox"], input[type="radio"], mat-checkbox, mat-radio-button');
    await dumpSection('BOTONES', 'button, [role="button"], .btn');
    await dumpSection('LINKS', 'a[href], a[routerLink]');
    await dumpSection('FILAS DE TABLA', 'tr, mat-row, .row, .order-row');
    await dumpSection('SELECTS', 'select, mat-select');
  } catch (err) {
    console.log(`⚠️ volcarEstructuraUI error: ${err.message}`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

function loginLocators() {
  return {
    userInput: [
      { by: By.css('input[formcontrolname="email"]'), desc: 'input[formcontrolname=email]' },
      { by: By.css('input[formcontrolname="correo"]'), desc: 'input[formcontrolname=correo]' },
      { by: By.css('input[type="email"]'), desc: 'input[type=email]' },
      { by: By.css('input[name="email"]'), desc: 'input[name=email]' },
      { by: By.css('input#email'), desc: 'input#email' },
      { by: By.css('input[id*="email" i]'), desc: 'input[id*=email]' },
      { by: By.css('input[placeholder*="correo" i]'), desc: 'input[placeholder*=correo]' },
      { by: By.xpath("//input[@type='email' or contains(@name,'email') or contains(@id,'email') or contains(@placeholder,'orreo')]"), desc: 'xpath email' },
    ],
    passInput: [
      { by: By.css('input[formcontrolname="password"]'), desc: 'input[formcontrolname=password]' },
      { by: By.css('input[formcontrolname="contrasena"]'), desc: 'input[formcontrolname=contrasena]' },
      { by: By.css('input[type="password"]'), desc: 'input[type=password]' },
      { by: By.css('input[name="password"]'), desc: 'input[name=password]' },
      { by: By.css('input#password'), desc: 'input#password' },
      { by: By.xpath("//input[@type='password']"), desc: 'xpath password' },
    ],
    submitBtn: [
      { by: By.css('button[type="submit"]'), desc: 'button[type=submit]' },
      { by: By.css('button.btn-primary'), desc: 'button.btn-primary' },
      { by: By.css('button[mat-button]'), desc: 'button[mat-button]' },
      { by: By.xpath("//button[contains(translate(.,'INGRESAR','ingresar'),'ingresar')]"), desc: 'xpath Ingresar' },
      { by: By.xpath("//button[contains(translate(.,'LOGIN','login'),'login')]"), desc: 'xpath Login' },
      { by: By.xpath("//button[contains(translate(.,'ENTRAR','entrar'),'entrar')]"), desc: 'xpath Entrar' },
      { by: By.xpath("//button[contains(translate(.,'INICIAR','iniciar'),'iniciar')]"), desc: 'xpath Iniciar' },
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
  try {
    await btn.click();
  } catch (_) {
    await driver.executeScript('arguments[0].click();', btn);
  }
  try {
    await driver.wait(async () => {
      const url = await driver.getCurrentUrl();
      return !/\/login/i.test(url) || (await driver.findElements(By.css('.toast-success, .mat-snack-bar-container, .alert-success'))).length > 0;
    }, CONFIG.timeouts.medium, 'timeout esperando salida de /login');
  } catch (_) {
    logDebug('No se detectó salida clara de /login; continuando...');
  }
  await driver.sleep(800);
}

async function logout(driver) {
  log('🚪 Logout (limpieza de storage)');
  try {
    await driver.executeScript(`
      try { window.localStorage.clear(); } catch(e) {}
      try { window.sessionStorage.clear(); } catch(e) {}
    `);
  } catch (_) { /* ignore */ }
  try {
    await driver.get(`${CONFIG.baseUrl}/login`);
  } catch (_) {
    try {
      await driver.executeScript(`window.location.href = '${CONFIG.baseUrl}/login';`);
    } catch (__) { /* ignore */ }
  }
  await driver.sleep(1200);
}

async function capturarIdOrdenDesdeFila(driver) {
  const candidatos = ['tr', 'mat-row', '.order-row', '.orden-row', '.card', '.order-card', '.list-item', '.item-orden', '[data-ot]'];
  const regexOt = /\bOT[-\s]?\d{1,6}\b/i;
  for (const sel of candidatos) {
    try {
      const filas = await driver.findElements(By.css(sel));
      for (const fila of filas) {
        try {
          if (!(await fila.isDisplayed())) continue;
          const dataOt = await fila.getAttribute('data-ot');
          if (dataOt && /OT[-\s]?\d+/.test(dataOt)) {
            const m = dataOt.match(regexOt);
            if (m) return m[0];
          }
          const txt = await fila.getText();
          const m = txt && txt.match(regexOt);
          if (m) return m[0];
        } catch (_) { /* stale */ }
      }
    } catch (_) { /* ignore */ }
  }
  try {
    const body = await driver.findElement(By.css('body'));
    const txt = await body.getText();
    const m = txt && txt.match(regexOt);
    if (m) return m[0];
  } catch (_) { /* ignore */ }
  return null;
}

// ============================================================================
// LOCATORS ESPECÍFICOS POR PANTALLA
// ============================================================================
function locatorsMenuPruebas() {
  return [
    { by: By.css('a[routerLink="/tecnico/pruebas-funcionamiento"]'), desc: 'routerLink pruebas-funcionamiento' },
    { by: By.css('a[href*="pruebas-funcionamiento"]'), desc: 'href pruebas-funcionamiento' },
    { by: By.css('a[href*="pruebas"]'), desc: 'href pruebas' },
    { by: By.xpath("//a[contains(translate(., 'PRUEBAS','pruebas'),'pruebas')]"), desc: 'xpath Pruebas' },
    { by: By.xpath("//*[contains(translate(., 'PRUEBAS','pruebas'),'pruebas') and (self::a or self::button or self::span)]"), desc: 'xpath texto Pruebas' },
  ];
}

function locatorsSelectOrden() {
  return [
    { by: By.css('mat-select'), desc: 'mat-select' },
    { by: By.css('select'), desc: 'select' },
    { by: By.css('input[placeholder*="orden" i]'), desc: 'input placeholder orden' },
    { by: By.css('input[placeholder*="OT" i]'), desc: 'input placeholder OT' },
    { by: By.xpath("//mat-select"), desc: 'xpath mat-select' },
    { by: By.xpath("//select"), desc: 'xpath select' },
  ];
}

function locatorsGuardarResultados() {
  return [
    { by: By.xpath("//button[contains(translate(.,'GUARDAR','guardar'),'guardar')]"), desc: 'xpath Guardar' },
    { by: By.xpath("//button[contains(translate(.,'RESULTADOS','resultados'),'resultados')]"), desc: 'xpath Resultados' },
    { by: By.xpath("//button[contains(translate(.,'TERMINAR','terminar'),'terminar')]"), desc: 'xpath Terminar' },
    { by: By.css('button.btn-primary'), desc: 'button.btn-primary' },
    { by: By.css('button[type="submit"]'), desc: 'button[type=submit]' },
    { by: By.css('button.mat-raised-button'), desc: 'button.mat-raised-button' },
  ];
}

function locatorsToastExito() {
  return [
    { by: By.css('.toast-success'), desc: '.toast-success' },
    { by: By.css('.mat-snack-bar-container'), desc: '.mat-snack-bar-container' },
    { by: By.css('.alert-success'), desc: '.alert-success' },
    { by: By.css('.swal2-success'), desc: '.swal2-success' },
    { by: By.xpath("//*[contains(@class,'success')]"), desc: 'xpath class success' },
    { by: By.xpath("//*[contains(translate(.,'GUARDADO','guardado'),'guardado')]"), desc: 'xpath Guardado' },
    { by: By.xpath("//*[contains(translate(.,'ÉXITO','éxito'),'éxito')]"), desc: 'xpath éxito' },
    { by: By.xpath("//*[contains(translate(.,'EXITO','exito'),'exito')]"), desc: 'xpath exito' },
  ];
}

function locatorsLinkNotificaciones() {
  return [
    { by: By.css('a[routerLink="/admin/notificaciones"]'), desc: 'routerLink /admin/notificaciones' },
    { by: By.css('a[href*="notificaciones"]'), desc: 'href notificaciones' },
    { by: By.xpath("//a[contains(translate(., 'NOTIFICACIONES','notificaciones'),'notificaciones')]"), desc: 'xpath Notificaciones' },
    { by: By.css('a[href*="/admin/notificaciones"]'), desc: 'href /admin/notificaciones' },
    { by: By.xpath("//button[contains(translate(., 'NOTIFICACIONES','notificaciones'),'notificaciones')]"), desc: 'xpath button notificaciones' },
    { by: By.xpath("//*[contains(@class,'bell') or contains(@class,'campana') or contains(@class,'notification')]"), desc: 'xpath campana/notification' },
  ];
}

// ============================================================================
// FASE 1 - TÉCNICO
// ============================================================================
async function fase1Tecnico(driver) {
  // a) Login técnico
  try {
    await loginComo(driver, CONFIG.tecnicoUser, CONFIG.tecnicoPass);
    marcarFase('loginTecnico', 'PASÓ', `usuario=${CONFIG.tecnicoUser}`);
  } catch (err) {
    marcarFase('loginTecnico', 'FALLÓ', err.message);
    throw new Error(`FASE loginTecnico: ${err.message}`);
  }

  // b) Navegar a pruebas
  try {
    const link = await findFirstVisibleOrNull(driver, locatorsMenuPruebas(), CONFIG.timeouts.medium, 'menú Pruebas');
    if (link) {
      try {
        await link.click();
      } catch (_) {
        await driver.executeScript('arguments[0].click();', link);
      }
      await driver.sleep(1200);
    } else {
      logDebug('No se encontró link Pruebas, navegando por URL directa');
      await driver.get(`${CONFIG.baseUrl}/tecnico/pruebas-funcionamiento`);
      await driver.sleep(1500);
    }
    marcarFase('navegacionPruebas', 'PASÓ', 'en /tecnico/pruebas-funcionamiento');
  } catch (err) {
    marcarFase('navegacionPruebas', 'FALLÓ', err.message);
    throw new Error(`FASE navegacionPruebas: ${err.message}`);
  }

  // c) Seleccionar orden EN_REPARACION
  try {
    const selectOrden = await findFirstVisibleOrNull(driver, locatorsSelectOrden(), CONFIG.timeouts.short, 'select/mat-select orden');
    if (selectOrden) {
      try {
        await selectOrden.click();
      } catch (_) {
        await driver.executeScript('arguments[0].click();', selectOrden);
      }
      await driver.sleep(700);
      const opciones = await driver.findElements(By.css('mat-option, option, .mat-option'));
      let seleccionada = false;
      for (const op of opciones) {
        try {
          if (!(await op.isDisplayed())) continue;
          const txt = (await op.getText()) || '';
          if (/OT|reparaci/i.test(txt) || txt.trim().length > 0) {
            try {
              await op.click();
            } catch (_) {
              await driver.executeScript('arguments[0].click();', op);
            }
            seleccionada = true;
            logDebug(`Orden seleccionada: "${txt.trim()}"`);
            break;
          }
        } catch (_) { /* stale */ }
      }
      if (!seleccionada) throw new Error('No se pudo seleccionar opción de orden');
    } else {
      const filas = await driver.findElements(By.css('tr, mat-row, .order-row, .card'));
      let clicked = false;
      for (const f of filas) {
        try {
          if (!(await f.isDisplayed())) continue;
          const txt = await f.getText();
          if (/EN\s*REPARACI[OÓ]N|EN_REPARACION|reparaci/i.test(txt)) {
            try {
              await f.click();
            } catch (_) {
              await driver.executeScript('arguments[0].click();', f);
            }
            clicked = true;
            break;
          }
        } catch (_) { /* stale */ }
      }
      if (!clicked) {
        for (const f of filas) {
          try {
            if (await f.isDisplayed()) {
              try {
                await f.click();
              } catch (_) {
                await driver.executeScript('arguments[0].click();', f);
              }
              clicked = true;
              break;
            }
          } catch (_) { /* ignore */ }
        }
      }
      if (!clicked) throw new Error('No se encontró orden seleccionable');
    }

    await driver.sleep(1000);
    const idOrden = await capturarIdOrdenDesdeFila(driver);
    if (idOrden) {
      reporte.idOrdenDetectado = idOrden;
      log(`🔖 ID de orden detectado: ${idOrden}`);
    } else {
      log('⚠️ No se detectó ID OT-XX en la pantalla');
    }
    marcarFase('seleccionOrden', 'PASÓ', idOrden ? `orden=${idOrden}` : 'seleccionada sin ID detectable');
  } catch (err) {
    marcarFase('seleccionOrden', 'FALLÓ', err.message);
    throw new Error(`FASE seleccionOrden: ${err.message}`);
  }

  // d) Marcar todo OK
  try {
    const checkboxes = await driver.findElements(By.css('input[type="checkbox"], mat-checkbox, mat-radio-button, input[type="radio"]'));
    let marcados = 0;
    for (const cb of checkboxes) {
      try {
        if (!(await cb.isDisplayed())) continue;
        const tag = await cb.getTagName();
        if (tag === 'input') {
          const checked = await cb.isSelected();
          if (!checked) {
            try {
              await cb.click();
            } catch (_) {
              await driver.executeScript('arguments[0].click();', cb);
            }
            marcados++;
          }
        } else {
          try {
            await cb.click();
          } catch (_) {
            await driver.executeScript('arguments[0].click();', cb);
          }
          marcados++;
        }
      } catch (_) { /* stale */ }
    }

    if (marcados === 0) {
      const okBtns = await driver.findElements(By.xpath("//*[contains(translate(.,'OK','ok'),'ok') and (self::button or self::label or self::mat-radio-button or self::mat-checkbox)]"));
      for (const b of okBtns) {
        try {
          if (await b.isDisplayed()) {
            try {
              await b.click();
            } catch (_) {
              await driver.executeScript('arguments[0].click();', b);
            }
            marcados++;
          }
        } catch (_) { /* ignore */ }
      }
    }

    marcarFase('marcarPruebasOK', 'PASÓ', `${marcados} controles marcados`);
    await driver.sleep(500);
  } catch (err) {
    marcarFase('marcarPruebasOK', 'FALLÓ', err.message);
    throw new Error(`FASE marcarPruebasOK: ${err.message}`);
  }

  // e) Guardar resultados
  try {
    const btnGuardar = await findFirstVisible(driver, locatorsGuardarResultados(), CONFIG.timeouts.medium, 'botón Guardar Resultados');
    try {
      await btnGuardar.click();
    } catch (_) {
      await driver.executeScript('arguments[0].click();', btnGuardar);
    }
    await driver.sleep(1000);
    const toast = await findFirstVisibleOrNull(driver, locatorsToastExito(), CONFIG.timeouts.medium, 'toast éxito');
    if (toast) {
      let ttxt = '';
      try { ttxt = await toast.getText(); } catch (_) {}
      marcarFase('guardarResultados', 'PASÓ', `toast: ${(ttxt || '').substring(0, 80)}`);
    } else {
      marcarFase('guardarResultados', 'PASÓ', 'guardado sin toast detectable');
    }
  } catch (err) {
    marcarFase('guardarResultados', 'FALLÓ', err.message);
    throw new Error(`FASE guardarResultados: ${err.message}`);
  }

  // f) Validar "Terminado"
  try {
    await driver.sleep(1500);
    const body = await driver.findElement(By.css('body'));
    const txt = await body.getText();
    if (/terminad[oa]/i.test(txt)) {
      marcarFase('estadoTerminado', 'PASÓ', 'texto "Terminado" visible');
    } else {
      await driver.navigate().refresh();
      await driver.sleep(1500);
      const body2 = await driver.findElement(By.css('body'));
      const txt2 = await body2.getText();
      if (/terminad[oa]/i.test(txt2)) {
        marcarFase('estadoTerminado', 'PASÓ', 'texto "Terminado" visible tras refresh');
      } else {
        marcarFase('estadoTerminado', 'FALLÓ', 'no aparece "Terminado"');
        throw new Error('No aparece estado "Terminado"');
      }
    }
  } catch (err) {
    marcarFase('estadoTerminado', 'FALLÓ', err.message);
    throw new Error(`FASE estadoTerminado: ${err.message}`);
  }
}

// ============================================================================
// FASE 2 - ADMIN
// ============================================================================
async function fase2Admin(driver) {
  // g) Logout técnico
  try {
    await logout(driver);
    marcarFase('logoutTecnico', 'PASÓ', 'storage limpiado + /login');
  } catch (err) {
    marcarFase('logoutTecnico', 'FALLÓ', err.message);
    throw new Error(`FASE logoutTecnico: ${err.message}`);
  }

  // h) Login administrador
  try {
    await loginComo(driver, CONFIG.adminUser, CONFIG.adminPass);
    marcarFase('loginAdmin', 'PASÓ', `usuario=${CONFIG.adminUser}`);
  } catch (err) {
    marcarFase('loginAdmin', 'FALLÓ', err.message);
    throw new Error(`FASE loginAdmin: ${err.message}`);
  }

  // i) Navegar a /admin/notificaciones
  try {
    const linkNotif = await findFirstVisibleOrNull(driver, locatorsLinkNotificaciones(), CONFIG.timeouts.medium, 'link Notificaciones');
    if (linkNotif) {
      try {
        await linkNotif.click();
      } catch (_) {
        await driver.executeScript('arguments[0].click();', linkNotif);
      }
      await driver.sleep(1200);
    } else {
      logDebug('No se encontró link de notificaciones, navegando directamente por URL');
      await driver.get(`${CONFIG.baseUrl}/admin/notificaciones`);
      await driver.sleep(1500);
    }
    marcarFase('panelNotificaciones', 'PASÓ', 'en panel de notificaciones');
  } catch (err) {
    marcarFase('panelNotificaciones', 'FALLÓ', err.message);
    throw new Error(`FASE panelNotificaciones: ${err.message}`);
  }

  // j), k), l) Buscar notificación con reintentos y validar ID de orden
  try {
    const deadline = Date.now() + CONFIG.timeouts.notifRetry;
    let textoEncontrado = null;

    while (Date.now() < deadline) {
      try {
        const items = await driver.findElements(By.css('.notificacion-item, .notification-item, mat-list-item, mat-card, .card, li'));
        for (const it of items) {
          if (await it.isDisplayed()) {
            const txt = (await it.getText()) || '';
            if (NOTIF_REGEX.test(txt)) {
              textoEncontrado = txt;
              break;
            }
          }
        }

        if (!textoEncontrado) {
          const body = await driver.findElement(By.css('body'));
          const bodyTxt = (await body.getText()) || '';
          if (NOTIF_REGEX.test(bodyTxt)) {
            textoEncontrado = bodyTxt;
            break;
          }
        }

        if (textoEncontrado) break;
      } catch (_) { /* ignore stales */ }

      await driver.navigate().refresh();
      await driver.sleep(2000);
    }

    if (!textoEncontrado) {
      throw new Error('No se encontró ninguna notificación que cumpla con el criterio tras los reintentos');
    }

    if (reporte.idOrdenDetectado) {
      if (!textoEncontrado.includes(reporte.idOrdenDetectado)) {
        log(`⚠️ La notificación fue encontrada pero no contiene explícitamente el ID ${reporte.idOrdenDetectado}. Texto: "${textoEncontrado.substring(0, 100)}"`);
      } else {
        log(`✅ Notificación verificada con éxito para la orden ${reporte.idOrdenDetectado}`);
      }
    }

    marcarFase('notificacionRecibida', 'PASÓ', `encontrado: "${textoEncontrado.substring(0, 80).replace(/\n/g, ' ')}"`);
  } catch (err) {
    marcarFase('notificacionRecibida', 'FALLÓ', err.message);
    throw new Error(`FASE notificacionRecibida: ${err.message}`);
  }
}

// ============================================================================
// MAIN / EJECUCIÓN PRINCIPAL
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

    log('🚀 Iniciando automatización TC-013...');

    await fase1Tecnico(driver);
    await fase2Admin(driver);

    reporte.resultadoFinal = 'PASÓ';
    log('🎉 ¡El caso de prueba TC-013 PASÓ exitosamente!');

    const rutaEvidencia = await guardarEvidencia(driver, CONFIG.evidenceName);
    reporte.evidencia = rutaEvidencia;

  } catch (err) {
    reporte.resultadoFinal = 'FALLÓ';
    reporte.errorDetalle = err.message;
    log(`❌ Error crítico en TC-013: ${err.message}`);

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
      try {
        await driver.quit();
      } catch (_) {}
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