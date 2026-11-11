/**
 * TC-006 – Asignación de ticket a un técnico
 * Sistema: ColTech
 *
 * HISTORIA: HU-06
 *   "Dado que soy administrador, cuando asigno un ticket a un técnico,
 *    entonces el sistema me permite ver a los técnicos disponibles
 *    y asignarle el ticket al técnico."
 *
 * ⚠️ ESTADO CONOCIDO: este TC está FALLANDO por un bug de backend:
 *    "Column 'id_persona' cannot be null"
 *    El script DETECTA ese error y reporta FALLÓ correctamente.
 *    Cuando el equipo de desarrollo corrija el bug, el test PASARÁ
 *    sin modificar el script.
 *
 * Pasos (matriz):
 *   1) Ingresar al apartado de tickets
 *   2) Click en "Crear Orden"
 *   3) Seleccionar técnico en "Técnico asignado"
 *   4) Click en "Crear Orden" (submit)
 *
 * Resultado esperado:
 *   Aparece "¡Orden #OT creada y técnico asignado!"
 *
 * Resultado observado (bug actual):
 *   Error SQL: "could not execute statement [Column 'id_persona' cannot be null]"
 *
 * Evidencia:
 *   artifacts/TC-006_evidencia_asignacion_tecnico.png         (PASÓ)
 *   artifacts/TC-006_evidencia_asignacion_tecnico_FALLO.png   (FALLÓ)
 *   + captura_asignacion_tecnico_6.jpg (nombre en tu matriz)
 *
 * Uso:
 *   node tests\asignacion-ticket.js
 *   $env:COLTECH_DEBUG="1"; node tests\asignacion-ticket.js
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs   = require('fs');
const path = require('path');

// ======================= CONFIGURACIÓN =======================
const BASE_URL    = process.env.COLTECH_URL || 'http://localhost:4200';
const TIMEOUT     = 25000;
const DEBUG       = process.env.COLTECH_DEBUG === '1';
const TEST_ID     = 'TC-006';

// Credenciales del administrador
const ADMIN = {
  usuario:    'admin',
  contrasena: 'admin123'
};

// Rutas
const LOGIN_PATH      = '/login';
const TICKETS_PATH    = '/administrador/tickets';
const DASHBOARD_PATH  = '/administrador/dashboard';

// Mensajes esperados
const MENSAJE_EXITO_REGEX = /orden.*creada.*t[eé]cnico.*asignad|OT.*creada|creada.*asignad/i;
const MENSAJE_ERROR_SQL   = /id_persona.*cannot be null|no puede ser nulo|Column.*cannot be null|null.*id_persona/i;

// Evidencia (doble nombre: uno para tu matriz, otro con prefijo del sistema)
const EVIDENCIA_PASO_MATRIZ  = 'captura_asignacion_tecnico_6.jpg';
const EVIDENCIA_PASO_EXTRA   = 'TC-006_evidencia_asignacion_tecnico.png';
const EVIDENCIA_FALLO        = 'TC-006_evidencia_asignacion_tecnico_FALLO.png';

// Carpeta artefactos
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

// ======================= SELECTORES ==========================
/**
 * Para cada elemento del flujo, definimos VARIOS selectores posibles.
 * El helper `findFirstVisible` prueba en orden hasta encontrar uno.
 * Esto hace el script tolerante a diferencias entre "botón", "link", "mat-button" etc.
 */
const SELS = {
  // Login (los mismos que ya validamos)
  inputUsuario:    [By.css('input[name="usuario"]')],
  inputContrasena: [By.css('input[name="contrasena"]')],
  btnLogin:        [By.css('button.btn-login')],
  alertaErrorLogin:[By.css('.login-box .alerta-error')],
  tituloLogin:     [By.css('.login-box .titulo')],

  // Menú / navegación al apartado de tickets
  // (el admin layout suele tener un link al módulo tickets)
  linkTickets: [
    By.css('a[routerLink="/administrador/tickets"]'),
    By.css('a[href*="tickets"]'),
    By.xpath("//a[contains(normalize-space(.), 'Tickets') or contains(normalize-space(.), 'tickets')]"),
    By.xpath("//span[normalize-space()='Tickets']/ancestor::a"),
    By.xpath("//mat-icon[contains(.,'confirmation_number')]/ancestor::a")
  ],

  // Indicador de que estamos en la página de tickets
  marcadorTickets: [
    By.css('app-administrador-tickets'),
    By.css('.tickets-container'),
    By.css('.tickets-list'),
    By.css('table'),
    By.css('mat-table')
  ],

  // Botón "Crear Orden" — puede estar en tickets o en orden-trabajo
  btnCrearOrden: [
    By.xpath("//button[contains(normalize-space(.), 'Crear Orden') or contains(normalize-space(.), 'Crear orden') or contains(normalize-space(.), 'Nueva Orden')]"),
    By.xpath("//a[contains(normalize-space(.), 'Crear Orden') or contains(normalize-space(.), 'Crear orden')]"),
    By.css('button.btn-crear-orden'),
    By.css('button.btn-nueva-orden'),
    By.css('[data-testid="btn-crear-orden"]')
  ],

  // Modal o formulario de creación de orden (aparece tras el click)
  marcadorFormOrden: [
    By.css('.modal-content.modal-orden'),
    By.css('.modal-overlay'),
    By.css('mat-dialog-container'),
    By.css('form[name="formOrden"]'),
    By.css('form[name="form-orden"]'),
    By.css('app-crear-orden')
  ],

  // Select de "Técnico asignado"
  selectTecnico: [
    By.css('select[name="tecnico"]'),
    By.css('select[name="idTecnico"]'),
    By.css('select[name="tecnicoAsignado"]'),
    By.css('mat-select[name="tecnico"]'),
    By.css('mat-select[formcontrolname="tecnico"]'),
    By.css('[formcontrolname="tecnico"]')
  ],

  // Botón submit del formulario de orden
  btnConfirmarOrden: [
    By.xpath("//button[contains(normalize-space(.), 'Crear Orden') or contains(normalize-space(.), 'Guardar') or contains(normalize-space(.), 'Asignar') or contains(normalize-space(.), 'Confirmar')]"),
    By.css('button[type="submit"].btn-crear-orden'),
    By.css('.modal-orden button[type="submit"]')
  ],

  // Mensajes de resultado
  alertaExito: [
    By.css('.alerta-exito'),
    By.css('.toast-success'),
    By.css('.swal2-success'),
    By.css('[role="alert"].success'),
    By.css('mat-snack-bar-container')
  ],
  alertaError: [
    By.css('.alerta-error'),
    By.css('.toast-error'),
    By.css('.swal2-error'),
    By.css('[role="alert"].error'),
    By.css('.mat-mdc-snack-bar-label')
  ]
};

// ======================= HELPERS =============================

/**
 * Busca el primer elemento visible entre una LISTA de selectores.
 * Devuelve { selector, elemento } o lanza error si ninguno aparece en `timeout`.
 */
async function findFirstVisible(driver, locators, timeout = TIMEOUT, descripcion = '') {
  const inicio = Date.now();
  const probados = [];

  while (Date.now() - inicio < timeout) {
    for (const loc of locators) {
      try {
        const els = await driver.findElements(loc);
        for (const el of els) {
          if (await el.isDisplayed()) {
            return { elemento: el, selector: loc.toString() };
          }
        }
      } catch (_) {
        probados.push(loc.toString());
      }
    }
    await driver.sleep(300);
  }

  throw new Error(
    `No se encontró ningún elemento visible (${descripcion}). ` +
    `Probados: ${locators.map(l => l.toString()).join(' | ')}`
  );
}

/**
 * Espera a que aparezca un texto en el DOM que coincida con el regex.
 * Útil para capturar mensajes de éxito/error dinámicos (toasts, snackbars).
 */
async function esperarTextoCoincidente(driver, locators, regex, timeout = TIMEOUT) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    for (const loc of locators) {
      try {
        const els = await driver.findElements(loc);
        for (const el of els) {
          if (!(await el.isDisplayed())) continue;
          const txt = ((await el.getText()) || '').trim();
          if (regex.test(txt)) return txt;
        }
      } catch (_) {}
    }
    await driver.sleep(300);
  }
  return null;
}

/**
 * Diagnóstico: vuelca todos los botones, inputs y selects visibles.
 * Se usa cuando un selector no se encuentra.
 */
async function volcarElementosVisibles(driver) {
  try {
    const res = await driver.executeScript(`
      const visible = (el) => el.offsetParent !== null;
      const resumen = { buttons: [], inputs: [], selects: [], links: [], matSelects: [] };
      document.querySelectorAll('button, a, input, select, mat-select').forEach((el) => {
        if (!visible(el)) return;
        const info = {
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.value || '').trim().slice(0, 60),
          name: el.getAttribute('name') || '',
          id: el.id || '',
          type: el.getAttribute('type') || '',
          cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 100),
          routerLink: el.getAttribute('routerLink') || el.getAttribute('href') || ''
        };
        if (el.tagName === 'BUTTON') resumen.buttons.push(info);
        else if (el.tagName === 'INPUT') resumen.inputs.push(info);
        else if (el.tagName === 'SELECT') resumen.selects.push(info);
        else if (el.tagName === 'A') resumen.links.push(info);
        else resumen.matSelects.push(info);
      });
      return resumen;
    `);

    console.log('\n   ─── 🔍 ELEMENTOS VISIBLES EN EL DOM ───');
    for (const cat of ['buttons', 'links', 'inputs', 'selects', 'matSelects']) {
      if (!res[cat] || res[cat].length === 0) continue;
      console.log(`   ${cat.toUpperCase()}:`);
      res[cat].slice(0, 10).forEach(e => {
        console.log(`     ${e.tag} "${e.text}" name="${e.name}" id="${e.id}" type="${e.type}" routerLink="${e.routerLink}"`);
      });
    }
    console.log('   ─────────────────────────────────────────\n');
  } catch (e) {
    console.log(`   ⚠️ No se pudo volcar el DOM: ${e.message}`);
  }
}

async function guardarEvidencia(driver, nombreArchivo) {
  try {
    const file = path.join(ARTIFACTS_DIR, nombreArchivo);
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

// ======================= LOGIN ADMIN =========================

async function loginAdmin(driver) {
  console.log('\n   ─── Login administrador ───');
  await driver.get(`${BASE_URL}${LOGIN_PATH}`);
  const titulo = await findFirstVisible(driver, SELS.tituloLogin, TIMEOUT, 'título login');
  console.log('   ✓ Login cargado');

  const iu = await findFirstVisible(driver, SELS.inputUsuario, TIMEOUT, 'input usuario');
  await iu.elemento.sendKeys(ADMIN.usuario);

  const ip = await findFirstVisible(driver, SELS.inputContrasena, TIMEOUT, 'input contraseña');
  await ip.elemento.sendKeys(ADMIN.contrasena);

  const btn = await findFirstVisible(driver, SELS.btnLogin, TIMEOUT, 'botón login');
  await btn.elemento.click();
  console.log(`   ✓ Credenciales enviadas (${ADMIN.usuario})`);

  // Esperar a que salga de /login
  await driver.wait(async () => {
    const u = await driver.getCurrentUrl();
    return !u.endsWith('/login') && !u.endsWith('/login/');
  }, TIMEOUT, 'El login no redirigió');
  console.log(`   ✓ Redirigido: ${await driver.getCurrentUrl()}`);
}

// ======================= TEST PRINCIPAL ======================

(async () => {
  let driver;
  let paso = 'Inicialización';
  const resultado = { id: TEST_ID, estado: 'FALLÓ', detalle: '', duracion: 0 };
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

    // ---------- Login ----------
    paso = 'Login administrador';
    await loginAdmin(driver);

    // ---------- Paso 1: ir al apartado de tickets ----------
    paso = 'Paso 1 – Navegar a Tickets';
    // Intentamos primero el link del menú; si no, navegamos por URL directa
    try {
      const link = await findFirstVisible(driver, SELS.linkTickets, 5000, 'link tickets');
      await link.elemento.click();
      console.log('   ✓ Click en el link "Tickets" del menú');
    } catch (_) {
      console.log('   ℹ No se encontró link; navegando por URL directa');
      await driver.get(`${BASE_URL}${TICKETS_PATH}`);
    }

    // Confirmar que estamos en la página de tickets
    await findFirstVisible(driver, SELS.marcadorTickets, TIMEOUT, 'marcador de tickets');
    console.log(`   ✓ Página tickets cargada: ${await driver.getCurrentUrl()}`);

    // ---------- Paso 2: click en "Crear Orden" ----------
    paso = 'Paso 2 – Click en "Crear Orden"';
    const btnCrear = await findFirstVisible(driver, SELS.btnCrearOrden, TIMEOUT, 'botón Crear Orden');
    await btnCrear.elemento.click();
    console.log(`   ✓ Click en "Crear Orden" (${btnCrear.selector})`);

    // ---------- Paso 3: seleccionar técnico ----------
    paso = 'Paso 3 – Seleccionar técnico';
    // Esperar a que aparezca el formulario/modal
    await findFirstVisible(driver, SELS.marcadorFormOrden, TIMEOUT, 'formulario de orden');
    console.log('   ✓ Formulario de orden abierto');

    const selTecnico = await findFirstVisible(driver, SELS.selectTecnico, TIMEOUT, 'select técnico');
    console.log(`   ✓ Select técnico encontrado (${selTecnico.selector})`);

    // Tomar el valor del select
    let tecnicoElegido = '';

    if ((await selTecnico.elemento.getTagName()) === 'select') {
      // Select HTML nativo
      const options = await selTecnico.elemento.findElements(By.css('option'));
      let elegido = null;
      for (const opt of options) {
        const value = await opt.getAttribute('value');
        const label = ((await opt.getText()) || '').trim();
        // Tomar el primer option real (no "Seleccione...")
        if (value && value !== '' && value !== '0' && value !== 'null' && label && !/seleccione/i.test(label)) {
          elegido = { value, label };
          break;
        }
      }
      if (!elegido) {
        throw new Error('El select de técnicos no tiene opciones válidas (¿la BD no tiene técnicos?)');
      }
      // Selenium: usar Select o click directo
      const { Select } = require('selenium-webdriver/lib/select');
      const selectObj = new Select(selTecnico.elemento);
      await selectObj.selectByValue(elegido.value);
      tecnicoElegido = `${elegido.label} (value=${elegido.value})`;
    } else {
      // MatSelect u otro widget Angular
      await selTecnico.elemento.click();
      await driver.sleep(800);
      // Buscar opciones del panel desplegado
      const opciones = await driver.findElements(By.css('mat-option, .mat-option, [role="option"]'));
      if (opciones.length === 0) {
        throw new Error('El select no desplegó opciones visibles');
      }
      await opciones[0].click();
      tecnicoElegido = `opción 0 de ${opciones.length} disponibles`;
    }
    console.log(`   ✓ Técnico elegido: ${tecnicoElegido}`);

    // ---------- Paso 4: click en "Crear Orden" (submit) ----------
    paso = 'Paso 4 – Confirmar "Crear Orden"';
    const btnConfirmar = await findFirstVisible(driver, SELS.btnConfirmarOrden, TIMEOUT, 'botón confirmar orden');
    await btnConfirmar.elemento.click();
    console.log('   ✓ Click en confirmar "Crear Orden"');

    // ---------- Validación: buscar mensaje de éxito o de error ----------
    paso = 'Validación – Mensaje de éxito o error';
    // Esperamos hasta 8 s a que aparezca un toast con éxito o error
    const inicio = Date.now();
    let msgExito = null;
    let msgError = null;

    while (Date.now() - inicio < 8000) {
      // Éxito?
      if (!msgExito) msgExito = await esperarTextoCoincidente(driver, SELS.alertaExito, MENSAJE_EXITO_REGEX, 1000);
      // Error?
      if (!msgError) msgError = await esperarTextoCoincidente(driver, SELS.alertaError, MENSAJE_ERROR_SQL, 1000);
      if (msgExito || msgError) break;
      await driver.sleep(500);
    }

    // ---------- Veredicto ----------
    if (msgExito) {
      console.log(`   ✓ Mensaje de éxito detectado: "${msgExito}"`);
      resultado.estado  = 'PASÓ';
      resultado.detalle = `Orden creada correctamente. Mensaje: "${msgExito}"`;
    } else if (msgError) {
      console.log(`   ❌ Error SQL detectado: "${msgError}"`);
      resultado.estado  = 'FALLÓ';
      resultado.detalle =
        `BUG detectado: ${msgError}. ` +
        `El backend no recibe/setea el campo id_persona al crear el equipo.`;
    } else {
      // Ni éxito ni error visible → ¿se cerró el modal? ¿aparece la orden en la tabla?
      const modalSigue = (await driver.findElements(By.css('.modal-overlay'))).length > 0;
      if (modalSigue) {
        resultado.estado  = 'FALLÓ';
        resultado.detalle = 'No apareció mensaje de éxito ni de error (el modal sigue abierto)';
      } else {
        // A veces el modal se cierra sin toast. Verificar si la orden apareció en la tabla
        const hayOrdenes = await driver.executeScript(`
          const filas = document.querySelectorAll('table tbody tr, mat-table mat-row, .ticket-row');
          return filas.length;
        `);
        if (hayOrdenes > 0) {
          resultado.estado  = 'PASÓ';
          resultado.detalle = `Orden creada. ${hayOrdenes} fila(s) en la tabla de órdenes.`;
        } else {
          resultado.estado  = 'FALLÓ';
          resultado.detalle = 'No hay evidencia de creación (ni mensaje ni filas nuevas)';
        }
      }
    }

    // ---------- Evidencia ----------
    paso = 'Guardar evidencia';
    if (resultado.estado === 'PASÓ') {
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
      console.log('\n   🔍 Diagnóstico: volcando elementos visibles para encontrar selectores reales...');
      await volcarElementosVisibles(driver);
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
  console.log(` ${resultado.detalle}`);
  console.log(` Duración: ${resultado.duracion} ms`);
  console.log('════════════════════════════════════════════════════\n');

  process.exit(resultado.estado === 'PASÓ' ? 0 : 1);
})();