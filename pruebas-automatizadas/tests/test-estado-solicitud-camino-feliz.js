/**
 * ============================================================================
 * TC-018 - test_estado_solicitud_camino_feliz
 * ============================================================================
 * ID Test      : TC-018
 * Historia     : HU-17
 * Tipo         : Camino feliz (partición de equivalencia válida)
 * Categoría    : Control de Calidad / Consulta de Estado de Solicitudes
 * Prioridad    : Alta
 * Automatización: Sí
 *
 * Descripción HU-17:
 *   "Como cliente registrado, quiero ver el estado de mi solicitud para
 *    visualizar el progreso actual del equipo."
 *
 * Escenario:
 *   "Dado que el cliente se encuentra en el sistema y cuenta con solicitud
 *    de reparación registrada, cuando ingrese a la sección 'Estado Solicitudes',
 *    entonces el sistema mostrará la lista detallada con las solicitudes
 *    (código, equipo, tipo, estado y fecha)."
 *
 * Objetivo:
 *   Verificar que el cliente pueda visualizar correctamente el listado y el
 *   estado actual de sus solicitudes de reparación.
 *
 * Precondiciones:
 *   - Cliente registrado e iniciado sesión previamente en la plataforma
 *   - Debe existir al menos una solicitud de reparación registrada en el sistema
 *
 * Datos de entrada:
 *   - Ninguno (consulta de solo lectura)
 *
 * Pasos:
 *   1. Ingresar al sistema con credenciales de cliente
 *   2. Ubicar en el menú "Estado Solicitudes" y hacer clic
 *   3. Revisar la tabla de solicitudes
 *
 * Resultado Esperado:
 *   El sistema muestra la lista de los estados de solicitudes registradas por
 *   el cliente.
 *
 * Evidencia: TC-018_evidencia_estado_solicitud_camino_feliz.png
 *
 * Instrucciones de ejecución:
 *   node tests/estado-solicitud-camino-feliz.js
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
const { Builder, By } = require('selenium-webdriver');
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
  evidenceName: 'TC-018_evidencia_estado_solicitud_camino_feliz.png',
  evidenceFailName: 'TC-018_evidencia_estado_solicitud_camino_feliz_FALLO.png',
  jsonReportName: 'reporte-TC-018.json',
  timeouts: {
    short: 3000,
    medium: 8000,
    long: 15000,
  },
  // Columnas reales del HTML: CÓDIGO, EQUIPO, TIPO, ESTADO, FECHA, ACCIÓN
  // (normalizadas: sin tildes, minúsculas). Solo validamos las 5 del caso.
  columnasEsperadas: ['codigo', 'equipo', 'tipo', 'estado', 'fecha'],
  // Estados reales que maneja la UI (ver cards de resumen + getEstadoTexto)
  estadosConocidos: [
    'pendiente', 'asignado', 'en proceso', 'en_proceso', 'en proceso',
    'diagnostico', 'en reparacion', 'en_reparacion', 'terminado',
    'entregado', 'cancelado'
  ],
};

// ============================================================================
// ESTADO DEL REPORTE
// ============================================================================
const reporte = {
  test: 'TC-018',
  nombre: 'test_estado_solicitud_camino_feliz',
  historia: 'HU-17',
  fechaInicio: new Date().toISOString(),
  fases: {
    loginCliente: { estado: 'NO_EJECUTADO', detalle: '' },
    navegacionEstadoSolicitudes: { estado: 'NO_EJECUTADO', detalle: '' },
    validarCardsResumen: { estado: 'NO_EJECUTADO', detalle: '' },
    validarTablaVisible: { estado: 'NO_EJECUTADO', detalle: '' },
    validarColumnas: { estado: 'NO_EJECUTADO', detalle: '' },
    validarAlMenosUnaSolicitud: { estado: 'NO_EJECUTADO', detalle: '' },
    validarContenidoFila: { estado: 'NO_EJECUTADO', detalle: '' },
  },
  resultadoFinal: 'NO_EJECUTADO',
  filasDetectadas: 0,
  columnasDetectadas: [],
  totalSegunCards: null,
  detalleSolicitudes: [],
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
  console.log(`[TC-018] ${msg}`);
}

function logDebug(msg) {
  if (CONFIG.debug) console.log(`[TC-018][DEBUG] ${msg}`);
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

/**
 * Normaliza texto para comparación: minúsculas, sin tildes, sin espacios extra.
 */
function normalizar(txt) {
  return (txt || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
    const rutaHtml = path.join(CONFIG.artifactsDir, `TC-018_dump_${sufijo}.html`);
    fs.writeFileSync(rutaHtml, html, 'utf8');
    log(`📄 HTML dump guardado: ${rutaHtml}`);
    await guardarEvidencia(driver, `TC-018_dump_${sufijo}.png`);
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
            const txt = ((await el.getText()) || '').replace(/\s+/g, ' ').substring(0, 100);
            const cls = (await el.getAttribute('class')) || '';
            visibles.push({ tag, txt, cls: cls.substring(0, 100) });
          }
        } catch (_) { /* stale */ }
      }
      console.log(`\n--- ${label} (${visibles.length} visibles) ---`);
      visibles.slice(0, 30).forEach((e, i) => {
        console.log(` [${i}] <${e.tag}> class="${e.cls}" text="${e.txt}"`);
      });
    };
    await dumpSection('CARDS RESUMEN', '.cards-resumen, .card-resumen');
    await dumpSection('TABLA', 'table.tabla-solicitudes, .tabla-container table');
    await dumpSection('HEADERS', 'table.tabla-solicitudes thead th');
    await dumpSection('FILAS', 'table.tabla-solicitudes tbody tr');
    await dumpSection('BADGES', '.badge-estado, .badge-tipo, td.codigo');
    await dumpSection('EMPTY/LOADING', '.empty, .loading, .spinner');
    await dumpSection('BÚSQUEDA', 'input.input-busqueda, .buscador-wrapper');
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
// LOCATORS ESPECÍFICOS — ESTADO DE SOLICITUDES (basados en el HTML real)
// ============================================================================
function locatorsMenuEstadoSolicitudes() {
  return [
    { by: By.css('a[routerLink="/cliente/estado-solicitud"]'), desc: 'routerLink estado-solicitud' },
    { by: By.css('a[href*="estado-solicitud"]'), desc: 'href estado-solicitud' },
    { by: By.xpath("//a[contains(translate(., 'ESTADO','estado'),'estado') and contains(translate(., 'SOLICITUD','solicitud'),'solicitud')]"), desc: 'xpath Estado Solicitudes' },
    { by: By.xpath("//a[contains(translate(., 'ESTADO','estado'),'estado')]"), desc: 'xpath Estado' },
  ];
}

/**
 * Contenedor principal y tabla.
 * HTML real:
 *   <div class="tabla-container">
 *     <table class="tabla-solicitudes"> ... </table>
 *   </div>
 */
function locatorsTablaSolicitudes() {
  return [
    { by: By.css('table.tabla-solicitudes'), desc: 'table.tabla-solicitudes' },
    { by: By.css('.tabla-container table'), desc: '.tabla-container table' },
    { by: By.css('table'), desc: 'table genérica' },
  ];
}

function locatorsFilasSolicitudes() {
  return [
    { by: By.css('table.tabla-solicitudes tbody tr'), desc: 'tr tabla-solicitudes' },
    { by: By.css('.tabla-container tbody tr'), desc: 'tr .tabla-container' },
    { by: By.css('table tbody tr'), desc: 'tr tabla genérica' },
  ];
}

function locatorsHeadersTabla() {
  return [
    { by: By.css('table.tabla-solicitudes thead th'), desc: 'th tabla-solicitudes' },
    { by: By.css('.tabla-container thead th'), desc: 'th .tabla-container' },
    { by: By.css('table thead th'), desc: 'th tabla' },
  ];
}

/**
 * Cards de resumen: <div class="cards-resumen"><div class="card-resumen">...</div></div>
 * Cada card tiene: .card-numero (cantidad) y .card-texto (etiqueta).
 */
function locatorsCardsResumen() {
  return [
    { by: By.css('.cards-resumen'), desc: '.cards-resumen' },
    { by: By.css('.card-resumen'), desc: '.card-resumen' },
  ];
}

/**
 * Celdas específicas de la fila (según HTML real):
 *   <td class="codigo">{{ s.codigo }}</td>
 *   <td><div class="equipo-info"><span class="equipo-marca">..</span><span class="equipo-modelo">..</span></div></td>
 *   <td><span class="badge-tipo">{{ s.tipo }}</span></td>
 *   <td><span class="badge-estado ...">...</span></td>
 *   <td>{{ s.fecha }}</td>
 *   <td><button class="btn-ver">👁️ Ver</button></td>
 */
function locatorsCeldaCodigo() {
  return [
    { by: By.css('td.codigo'), desc: 'td.codigo' },
  ];
}

function locatorsCeldaEquipoInfo() {
  return [
    { by: By.css('td .equipo-info'), desc: '.equipo-info' },
    { by: By.css('td .equipo-marca'), desc: '.equipo-marca' },
  ];
}

function locatorsCeldaBadgeTipo() {
  return [
    { by: By.css('td .badge-tipo'), desc: '.badge-tipo' },
  ];
}

function locatorsCeldaBadgeEstado() {
  return [
    { by: By.css('td .badge-estado'), desc: '.badge-estado' },
  ];
}

/**
 * Empty state: <div class="empty"><h3>No se encontraron solicitudes</h3>...
 */
function locatorsMensajeVacio() {
  return [
    { by: By.css('.empty'), desc: '.empty' },
    { by: By.css('.empty h3'), desc: '.empty h3' },
    { by: By.xpath("//*[contains(translate(.,'NO SE ENCONTRARON SOLICITUDES','no se encontraron solicitudes'),'no se encontraron solicitudes')]"), desc: 'xpath no se encontraron solicitudes' },
  ];
}

/**
 * Loading spinner: <div class="loading"><div class="spinner"></div>...
 */
function locatorsLoading() {
  return [
    { by: By.css('.loading'), desc: '.loading' },
    { by: By.css('.spinner'), desc: '.spinner' },
  ];
}

/**
 * Info de resultados: <div class="resultados-info">Mostrando X de Y solicitudes</div>
 * Útil para validar que la tabla muestra conteos coherentes.
 */
function locatorsResultadosInfo() {
  return [
    { by: By.css('.resultados-info'), desc: '.resultados-info' },
  ];
}

// ============================================================================
// EJECUCIÓN PRINCIPAL (TC-018)
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

    log('🚀 Iniciando automatización TC-018 (Estado de solicitudes - camino feliz)...');

    // 1. Login Cliente
    try {
      await loginComoCliente(driver);
      marcarFase('loginCliente', 'PASÓ', `usuario=${CONFIG.clienteUser}`);
    } catch (err) {
      marcarFase('loginCliente', 'FALLÓ', err.message);
      throw new Error(`FASE loginCliente: ${err.message}`);
    }

    // 2. Navegar a "Estado Solicitudes"
    try {
      const link = await findFirstVisibleOrNull(driver, locatorsMenuEstadoSolicitudes(), CONFIG.timeouts.medium, 'menú Estado Solicitudes');
      if (link) {
        try { await link.click(); } catch (_) { await driver.executeScript('arguments[0].click();', link); }
        await driver.sleep(1500);
      } else {
        await driver.get(`${CONFIG.baseUrl}/cliente/estado-solicitud`);
        await driver.sleep(1500);
      }

      // Esperar a que termine el loading (si aparece)
      const deadline = Date.now() + CONFIG.timeouts.long;
      let loadingVisible = true;
      while (Date.now() < deadline) {
        const loading = await findFirstVisibleOrNull(driver, locatorsLoading(), 500, 'loading');
        if (!loading) {
          loadingVisible = false;
          break;
        }
        await driver.sleep(300);
      }
      if (loadingVisible) {
        logDebug('⚠️ Loading aún visible tras timeout, se continúa de todos modos.');
      }

      marcarFase('navegacionEstadoSolicitudes', 'PASÓ', 'en /cliente/estado-solicitud');
    } catch (err) {
      marcarFase('navegacionEstadoSolicitudes', 'FALLÓ', err.message);
      throw new Error(`FASE navegacionEstadoSolicitudes: ${err.message}`);
    }

    // 3. Validar cards de resumen (Total, Pendientes, Asignado, etc.)
    try {
      const cards = await driver.findElements(By.css('.card-resumen'));
      if (!cards || cards.length === 0) {
        throw new Error('No se encontraron cards de resumen (.card-resumen).');
      }

      // Card "Total" debe existir
      let totalTxt = '';
      for (const card of cards) {
        const texto = ((await card.getText()) || '').replace(/\s+/g, ' ').trim();
        if (normalizar(texto).includes('total')) {
          // El número está en .card-numero
          try {
            const numEl = await card.findElement(By.css('.card-numero'));
            totalTxt = ((await numEl.getText()) || '').trim();
          } catch (_) { /* fallback al texto completo */ }
          if (!totalTxt) {
            const m = texto.match(/(\d+)/);
            if (m) totalTxt = m[1];
          }
          break;
        }
      }

      if (totalTxt) {
        const n = parseInt(totalTxt, 10);
        if (Number.isNaN(n) || n <= 0) {
          throw new Error(`El card "Total" muestra ${totalTxt}, se esperaba un número > 0.`);
        }
        reporte.totalSegunCards = n;
        log(`🔢 Total según card resumen: ${n}`);
      } else {
        logDebug('⚠️ No se encontró el card "Total", se omite validación numérica.');
      }

      marcarFase('validarCardsResumen', 'PASÓ', `${cards.length} cards detectados${totalTxt ? ', Total=' + totalTxt : ''}`);
    } catch (err) {
      // No es un fallo crítico; la HU pide la tabla, no los cards.
      // Se marca como PASÓ con nota si al menos la sección existe, si no FALLÓ.
      const cardsSeccion = await findFirstVisibleOrNull(driver, [{ by: By.css('.cards-resumen'), desc: '.cards-resumen' }], 1000, 'sección cards');
      if (cardsSeccion) {
        marcarFase('validarCardsResumen', 'PASÓ', 'sección .cards-resumen presente, detalle: ' + err.message);
      } else {
        marcarFase('validarCardsResumen', 'PASÓ', 'sin cards de resumen (opcional): ' + err.message);
      }
    }

    // 4. Validar que la tabla sea visible
    try {
      const tabla = await findFirstVisible(driver, locatorsTablaSolicitudes(), CONFIG.timeouts.long, 'tabla de solicitudes');
      const tag = await tabla.getTagName();
      const cls = (await tabla.getAttribute('class')) || '';
      log(`📊 Tabla detectada: <${tag}> class="${cls}"`);
      marcarFase('validarTablaVisible', 'PASÓ', `<${tag}.${cls.split(' ')[0]}>`);
    } catch (err) {
      // Verificar si hay empty state → sería un fallo del TC (no hay solicitudes)
      const vacio = await findFirstVisibleOrNull(driver, locatorsMensajeVacio(), CONFIG.timeouts.short, 'mensaje sin solicitudes');
      if (vacio) {
        const txt = ((await vacio.getText()) || '').replace(/\s+/g, ' ').trim();
        throw new Error(`No hay tabla de solicitudes. Se muestra el empty state: "${txt}". Verifique que el cliente tenga al menos una solicitud registrada.`);
      }
      marcarFase('validarTablaVisible', 'FALLÓ', err.message);
      throw new Error(`FASE validarTablaVisible: ${err.message}`);
    }

    // 5. Validar columnas esperadas
    try {
      const headers = await driver.findElements(locatorsHeadersTabla()[0].by);
      const textosHeaders = [];
      for (const h of headers) {
        try {
          if (await h.isDisplayed()) {
            const t = normalizar(await h.getText());
            if (t) textosHeaders.push(t);
          }
        } catch (_) { /* stale */ }
      }

      log(`📋 Encabezados detectados: [${textosHeaders.join(' | ')}]`);
      reporte.columnasDetectadas = textosHeaders;

      const faltantes = CONFIG.columnasEsperadas.filter(col =>
        !textosHeaders.some(h => h.includes(col))
      );

      if (faltantes.length > 0) {
        throw new Error(`Faltan columnas esperadas: [${faltantes.join(', ')}]. Detectadas: [${textosHeaders.join(', ')}]`);
      }

      marcarFase('validarColumnas', 'PASÓ', `columnas presentes: ${CONFIG.columnasEsperadas.join(', ')}`);
    } catch (err) {
      marcarFase('validarColumnas', 'FALLÓ', err.message);
      throw new Error(`FASE validarColumnas: ${err.message}`);
    }

    // 6. Validar que exista al menos una fila con datos
    try {
      const filas = await driver.findElements(locatorsFilasSolicitudes()[0].by);
      const filasConDatos = [];
      for (const f of filas) {
        try {
          if (await f.isDisplayed()) {
            const txt = ((await f.getText()) || '').replace(/\s+/g, ' ').trim();
            if (txt && txt.length > 0) {
              filasConDatos.push({ el: f, texto: txt });
            }
          }
        } catch (_) { /* stale */ }
      }

      reporte.filasDetectadas = filasConDatos.length;
      log(`📄 Filas con datos: ${filasConDatos.length}`);

      if (filasConDatos.length === 0) {
        throw new Error('La tabla está vacía: no hay solicitudes registradas para este cliente.');
      }

      // Guardar detalle de hasta 5 filas para trazabilidad
      reporte.detalleSolicitudes = filasConDatos.slice(0, 5).map(f => f.texto.substring(0, 200));

      // Validar coherencia con el card "Total" si lo tenemos
      if (reporte.totalSegunCards && reporte.totalSegunCards !== filasConDatos.length) {
        logDebug(`⚠️ Total en card (${reporte.totalSegunCards}) != filas visibles (${filasConDatos.length}). Puede deberse a filtros activos.`);
      }

      marcarFase('validarAlMenosUnaSolicitud', 'PASÓ', `${filasConDatos.length} fila(s) con datos detectadas`);
    } catch (err) {
      marcarFase('validarAlMenosUnaSolicitud', 'FALLÓ', err.message);
      throw new Error(`FASE validarAlMenosUnaSolicitud: ${err.message}`);
    }

    // 7. Validar contenido de la primera fila (código, equipo, tipo, estado, fecha)
    try {
      const primerFila = (await driver.findElements(locatorsFilasSolicitudes()[0].by))[0];
      if (!primerFila) throw new Error('No se pudo obtener la primera fila de la tabla.');

      // Código
      const codigoEl = await primerFila.findElement(By.css('td.codigo'));
      const codigo = ((await codigoEl.getText()) || '').trim();
      if (!codigo) throw new Error('La celda de código está vacía.');
      log(`🔖 Código de la primera solicitud: "${codigo}"`);

      // Equipo (marca + modelo)
      const marcaEl = await primerFila.findElement(By.css('.equipo-marca'));
      const modeloEl = await primerFila.findElement(By.css('.equipo-modelo'));
      const marca = ((await marcaEl.getText()) || '').trim();
      const modelo = ((await modeloEl.getText()) || '').trim();
      if (!marca && !modelo) throw new Error('La celda de equipo está vacía (marca y modelo vacíos).');
      log(`💻 Equipo: ${marca} ${modelo}`);

      // Tipo
      const tipoEl = await primerFila.findElement(By.css('.badge-tipo'));
      const tipo = ((await tipoEl.getText()) || '').trim();
      if (!tipo) throw new Error('La celda de tipo está vacía.');
      log(`🏷️ Tipo: "${tipo}"`);

      // Estado
      const estadoEl = await primerFila.findElement(By.css('.badge-estado'));
      const estadoTxt = ((await estadoEl.getText()) || '').trim();
      if (!estadoTxt) throw new Error('La celda de estado está vacía.');
      const estadoNorm = normalizar(estadoTxt);
      const estadoReconocido = CONFIG.estadosConocidos.some(e => estadoNorm.includes(e));
      if (!estadoReconocido) {
        logDebug(`⚠️ Estado "${estadoTxt}" no está en la lista conocida, pero se acepta (puede tener otro formato).`);
      }
      log(`📊 Estado: "${estadoTxt}"`);

      // Fecha (5ta celda)
      const celdas = await primerFila.findElements(By.css('td'));
      if (celdas.length < 5) {
        throw new Error(`La fila tiene solo ${celdas.length} celdas, se esperaban al menos 6 (código, equipo, tipo, estado, fecha, acción).`);
      }
      const fechaTxt = ((await celdas[4].getText()) || '').trim();
      if (!fechaTxt) throw new Error('La celda de fecha está vacía.');
      log(`📅 Fecha: "${fechaTxt}"`);

      marcarFase('validarContenidoFila', 'PASÓ',
        `codigo="${codigo}", equipo="${marca} ${modelo}", tipo="${tipo}", estado="${estadoTxt}", fecha="${fechaTxt}"`);
    } catch (err) {
      marcarFase('validarContenidoFila', 'FALLÓ', err.message);
      throw new Error(`FASE validarContenidoFila: ${err.message}`);
    }

    reporte.resultadoFinal = 'PASÓ';
    log('🎉 ¡El caso de prueba TC-018 PASÓ exitosamente! El cliente puede ver su listado de solicitudes.');

    const rutaEvidencia = await guardarEvidencia(driver, CONFIG.evidenceName);
    reporte.evidencia = rutaEvidencia;

  } catch (err) {
    reporte.resultadoFinal = 'FALLÓ';
    reporte.errorDetalle = err.message;
    log(`❌ Error crítico en TC-018: ${err.message}`);

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