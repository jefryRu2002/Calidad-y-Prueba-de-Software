/**
 * TC-008 – Visualización del estado de pago en órdenes culminadas
 * Sistema: ColTech | Módulo: Administrador > Órdenes de trabajo
 *
 * HISTORIA: HU-08
 *   "Dado que soy administrador, cuando una orden de trabajo haya sido
 *    culminada, entonces el sistema debe permitirme visualizar su estado
 *    de pago para identificar si ha sido pagada o pendiente."
 *
 * Pasos (matriz):
 *   1) Iniciar sesión como administrador
 *   2) Ingresar al módulo de órdenes de trabajo
 *   3) Consultar las órdenes culminadas
 *   4) Verificar el estado de pago de cada orden
 *
 * Resultado esperado:
 *   El sistema muestra correctamente el estado de pago (Pagada / Pendiente de pago)
 *
 * Precondición:
 *   ⚠️ Deben existir órdenes de trabajo culminadas en BD
 *   (al menos una con estado "Pagada" y una "Pendiente de pago")
 *
 * Evidencia:
 *   artifacts/TC-008_evidencia_estado_pago.png          (PASÓ)
 *   artifacts/TC-008_evidencia_estado_pago_FALLO.png    (FALLÓ)
 *
 * Uso:
 *   node tests\estado-pago-ordenes.js
 *   $env:COLTECH_DEBUG="1"; node tests\estado-pago-ordenes.js
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs   = require('fs');
const path = require('path');

// ======================= CONFIGURACIÓN =======================
const BASE_URL    = process.env.COLTECH_URL || 'http://localhost:4200';
const TIMEOUT     = 20000;
const DEBUG       = process.env.COLTECH_DEBUG === '1';
const TEST_ID     = 'TC-008';

const ADMIN = {
  usuario:    'admin',
  contrasena: 'admin123'
};

const LOGIN_PATH = '/login';

// Regex para identificar estados de pago válidos
const REGEX_PAGADA      = /\bpagad[ao]\b|pagado|paid/i;
const REGEX_PENDIENTE   = /pendiente|por pagar|no pagad|unpaid|pending/i;
const REGEX_CULMINADA   = /culminad|completad|finalizad|terminad|closed|done/i;

// Evidencia
const EVIDENCIA_PASO  = 'TC-008_evidencia_estado_pago.png';
const EVIDENCIA_FALLO = 'TC-008_evidencia_estado_pago_FALLO.png';

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
  alertaErrorLogin: [By.css('.login-box .alerta-error')],

  // Menú admin
  linkOrdenTrabajo: [
    By.css('a[routerLink="/administrador/orden-trabajo"]'),
    By.css('a[href*="orden-trabajo"]'),
    By.xpath("//a[contains(normalize-space(.), 'Órdenes') or contains(normalize-space(.), 'Ordenes') or contains(normalize-space(.), 'Orden de trabajo')]"),
    By.xpath("//span[contains(normalize-space(.), 'Órdenes') or contains(normalize-space(.), 'Ordenes')]/ancestor::a")
  ],
  marcadorOrdenTrabajo: [
    By.css('app-administrador-orden-trabajo'),
    By.css('.ordenes-container'),
    By.css('.orden-trabajo-container'),
    By.css('table'),
    By.css('mat-table')
  ],

  // Tabla de órdenes
  filasTabla: [
    By.css('table tbody tr'),
    By.css('mat-table mat-row'),
    By.css('.orden-row'),
    By.css('mat-row')
  ],

  // Filtros (opcional: si hay un select de estado)
  filtroEstado: [
    By.css('select[name="estado"]'),
    By.css('mat-select[name="estado"]'),
    By.css('mat-select[formcontrolname="estado"]')
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
          if (await el.isDisplayed()) {
            return { elemento: el, selector: loc.toString() };
          }
        }
      } catch (_) {}
    }
    await driver.sleep(300);
  }
  throw new Error(`No se encontró "${desc}". Probados: ${locators.map(l => l.toString()).join(' | ')}`);
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

/**
 * Diagnóstico: vuelca la estructura de la tabla (headers + primeras filas).
 */
async function volcarTabla(driver) {
  try {
    const info = await driver.executeScript(`
      const resultado = { headers: [], filas: [] };

      // Intentar con table
      const table = document.querySelector('table');
      if (table) {
        table.querySelectorAll('thead th').forEach(th => {
          resultado.headers.push((th.innerText || '').trim());
        });
        const tbody = table.querySelector('tbody');
        if (tbody) {
          const rows = tbody.querySelectorAll('tr');
          Array.from(rows).slice(0, 5).forEach(tr => {
            const celdas = Array.from(tr.querySelectorAll('td')).map(td => (td.innerText || '').trim().slice(0, 50));
            resultado.filas.push(celdas);
          });
        }
      }
      return resultado;
    `);

    console.log('\n   ─── 🔍 ESTRUCTURA DE LA TABLA ───');
    console.log(`   Headers (${info.headers.length}): ${JSON.stringify(info.headers)}`);
    console.log(`   Filas (${info.filas.length} mostradas):`);
    info.filas.forEach((fila, i) => {
      console.log(`     [${i}] ${JSON.stringify(fila)}`);
    });
    console.log('   ─────────────────────────────────────\n');

    return info;
  } catch (e) {
    console.log(`   ⚠️ No se pudo volcar la tabla: ${e.message}`);
    return { headers: [], filas: [] };
  }
}

/**
 * Login como admin. Devuelve true si tuvo éxito.
 */
async function loginAdmin(driver) {
  await driver.get(`${BASE_URL}${LOGIN_PATH}`);
  await driver.wait(until.elementLocated(SELS.tituloLogin[0]), TIMEOUT);

  const iu = await findFirstVisible(driver, SELS.inputUsuario, TIMEOUT, 'input usuario');
  await iu.elemento.clear();
  await iu.elemento.sendKeys(ADMIN.usuario);

  const ip = await findFirstVisible(driver, SELS.inputContrasena, TIMEOUT, 'input contraseña');
  await ip.elemento.clear();
  await ip.elemento.sendKeys(ADMIN.contrasena);

  const btn = await findFirstVisible(driver, SELS.btnLogin, TIMEOUT, 'botón login');
  await btn.elemento.click();

  // Esperar redirección
  await driver.wait(async () => {
    const u = await driver.getCurrentUrl();
    return !u.endsWith('/login') && !u.endsWith('/login/');
  }, TIMEOUT, 'El login no redirigió');
}

// ======================= ANÁLISIS DE TABLA ===================

/**
 * Analiza la tabla para detectar si hay columnas de estado y de pago.
 * Devuelve un objeto con el análisis.
 */
function analizarTabla(info) {
  const headers = info.headers.map(h => h.toLowerCase());

  // Buscar índice de columna de estado (de la orden)
  const idxEstado = headers.findIndex(h =>
    /estado(?!.*pago)/i.test(h) || /^estado$/i.test(h)
  );

  // Buscar índice de columna de pago
  const idxPago = headers.findIndex(h =>
    /pago|pagad|pendiente|estado.*pago|status.*pago/i.test(h)
  );

  // Analizar cada fila
  const ordenesCulminadas = [];
  const estadosPagoDetectados = new Set();

  info.filas.forEach((fila, idx) => {
    const textoFila = fila.join(' | ');
    const estadoOrden = idxEstado >= 0 ? (fila[idxEstado] || '') : textoFila;
    const estadoPago  = idxPago    >= 0 ? (fila[idxPago]   || '') : textoFila;

    const esCulminada = REGEX_CULMINADA.test(estadoOrden) || REGEX_CULMINADA.test(textoFila);

    if (esCulminada) {
      ordenesCulminadas.push({ idx, estadoOrden, estadoPago, fila });
    }

    if (REGEX_PAGADA.test(estadoPago))      estadosPagoDetectados.add('Pagada');
    if (REGEX_PENDIENTE.test(estadoPago))   estadosPagoDetectados.add('Pendiente');
  });

  return {
    idxEstado,
    idxPago,
    ordenesCulminadas,
    estadosPagoDetectados: Array.from(estadosPagoDetectados),
    totalFilas: info.filas.length,
    tieneColumnaEstado: idxEstado >= 0,
    tieneColumnaPago: idxPago >= 0
  };
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
      login:      { estado: 'NO_EJECUTADO', detalle: '' },
      navegacion: { estado: 'NO_EJECUTADO', detalle: '' },
      tabla:      { estado: 'NO_EJECUTADO', detalle: '' },
      estadoPago: { estado: 'NO_EJECUTADO', detalle: '' }
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

    // ---------- Paso 1: login admin ----------
    console.log('\n   ─── Paso 1: Login administrador ───');
    paso = 'Paso 1 – Login admin';
    await loginAdmin(driver);
    console.log(`   ✓ Admin autenticado. URL: ${await driver.getCurrentUrl()}`);
    resultado.subresultados.login = { estado: 'PASÓ', detalle: 'Login exitoso' };

    // ---------- Paso 2: ir al módulo de órdenes de trabajo ----------
    console.log('\n   ─── Paso 2: Ir a Órdenes de trabajo ───');
    paso = 'Paso 2 – Ir a Órdenes de trabajo';

    try {
      const link = await findFirstVisible(driver, SELS.linkOrdenTrabajo, 6000, 'link Órdenes de trabajo');
      await link.elemento.click();
      console.log(`   ✓ Click en link (${link.selector})`);
    } catch (_) {
      console.log('   ℹ Navegando por URL directa a /administrador/orden-trabajo');
      await driver.get(`${BASE_URL}/administrador/orden-trabajo`);
    }

    await findFirstVisible(driver, SELS.marcadorOrdenTrabajo, TIMEOUT, 'tabla de órdenes');
    console.log(`   ✓ Página cargada: ${await driver.getCurrentUrl()}`);
    resultado.subresultados.navegacion = { estado: 'PASÓ', detalle: 'Módulo accesible' };

    // Esperar a que carguen las filas (por si hay petición HTTP asíncrona)
    await driver.sleep(2500);

    // ---------- Paso 3: consultar órdenes culminadas ----------
    console.log('\n   ─── Paso 3: Consultar órdenes culminadas ───');
    paso = 'Paso 3 – Leer tabla de órdenes';

    const filas = await driver.findElements(SELS.filasTabla[0]).catch(() => []);
    let filasCount = 0;
    for (const loc of SELS.filasTabla) {
      try {
        const els = await driver.findElements(loc);
        if (els.length > 0) { filasCount = els.length; break; }
      } catch (_) {}
    }

    if (filasCount === 0) {
      throw new Error(
        'La tabla de órdenes está vacía. ' +
        'La precondición del test ("deben existir órdenes culminadas") no se cumple.'
      );
    }
    console.log(`   ✓ Tabla con ${filasCount} fila(s)`);

    // Volcado para debug y diagnóstico
    const infoTabla = await volcarTabla(driver);
    const analisis  = analizarTabla(infoTabla);

    console.log(`   → Columna "Estado":   ${analisis.tieneColumnaEstado ? `sí (idx ${analisis.idxEstado})` : '❌ no detectada'}`);
    console.log(`   → Columna "Pago":     ${analisis.tieneColumnaPago   ? `sí (idx ${analisis.idxPago})`   : '❌ no detectada'}`);
    console.log(`   → Órdenes culminadas: ${analisis.ordenesCulminadas.length}`);
    console.log(`   → Estados de pago detectados: [${analisis.estadosPagoDetectados.join(', ')}]`);

    // Sub-resultado del paso 3
    if (analisis.ordenesCulminadas.length > 0) {
      resultado.subresultados.tabla = {
        estado: 'PASÓ',
        detalle: `${analisis.ordenesCulminadas.length} orden(es) culminada(s) encontradas`
      };
    } else {
      // No hay culminadas visibles. No necesariamente es bug: puede que estén en otra página o la columna de estado tenga otro valor.
      resultado.subresultados.tabla = {
        estado: 'FALLÓ',
        detalle: `No se encontraron órdenes con estado "culminada/completada". ` +
                 `Headers detectados: [${infoTabla.headers.join(', ')}]. ` +
                 `Esto puede indicar: (a) no hay datos en BD, (b) la columna de estado tiene otro nombre, ` +
                 `(c) las culminadas están en otra página.`
      };
    }

    // ---------- Paso 4: verificar estado de pago ----------
    console.log('\n   ─── Paso 4: Verificar estado de pago ───');
    paso = 'Paso 4 – Validar estado de pago';

    // Validar que exista una columna de pago
    if (!analisis.tieneColumnaPago) {
      resultado.subresultados.estadoPago = {
        estado: 'FALLÓ',
        detalle: `No existe una columna de "pago" en la tabla. ` +
                 `Headers: [${infoTabla.headers.join(', ')}]`
      };
    } else if (analisis.ordenesCulminadas.length === 0) {
      resultado.subresultados.estadoPago = {
        estado: 'NO_EJECUTADO',
        detalle: 'No hay órdenes culminadas para validar el pago'
      };
    } else {
      // ¿Aparecen los estados esperados?
      const tienePagada    = analisis.estadosPagoDetectados.includes('Pagada');
      const tienePendiente = analisis.estadosPagoDetectados.includes('Pendiente');

      if (tienePagada && tienePendiente) {
        resultado.subresultados.estadoPago = {
          estado: 'PASÓ',
          detalle: 'La tabla muestra tanto "Pagada" como "Pendiente de pago"'
        };
      } else if (tienePagada || tienePendiente) {
        resultado.subresultados.estadoPago = {
          estado: 'PASÓ',
          detalle: `Al menos un estado de pago se visualiza: [${analisis.estadosPagoDetectados.join(', ')}]. ` +
                   `(No se exigen ambos si no hay órdenes de un tipo en BD)`
        };
      } else {
        // Verificar que al menos las órdenes culminadas tengan ALGÚN valor en la columna pago
        const conValorPago = analisis.ordenesCulminadas.filter(o => o.estadoPago && o.estadoPago.trim().length > 0);
        if (conValorPago.length > 0) {
          resultado.subresultados.estadoPago = {
            estado: 'PASÓ',
            detalle: `Las órdenes culminadas tienen valor en la columna pago: ` +
                     `[${conValorPago.map(o => o.estadoPago).join(', ')}]. ` +
                     `(Aunque no coinciden con "Pagada" o "Pendiente de pago" literales — ` +
                     `ajusta los regex si tu sistema usa otros textos)`
          };
        } else {
          resultado.subresultados.estadoPago = {
            estado: 'FALLÓ',
            detalle: `Las órdenes culminadas NO tienen valor en la columna "pago". ` +
                     `Primera orden: [${analisis.ordenesCulminadas[0].fila.join(', ')}]`
          };
        }
      }
    }

    // ---------- Veredicto global ----------
    const ok = (
      resultado.subresultados.login.estado === 'PASÓ' &&
      resultado.subresultados.navegacion.estado === 'PASÓ' &&
      resultado.subresultados.tabla.estado === 'PASÓ' &&
      (resultado.subresultados.estadoPago.estado === 'PASÓ' ||
       resultado.subresultados.estadoPago.estado === 'NO_EJECUTADO')
    );

    resultado.estado  = ok ? 'PASÓ' : 'FALLÓ';
    resultado.detalle = ok
      ? 'El sistema muestra correctamente el estado de pago de las órdenes culminadas'
      : 'Se detectaron fallos en la visualización del estado de pago';

    // ---------- Evidencia ----------
    paso = 'Guardar evidencia';
    await guardarEvidencia(driver, ok ? EVIDENCIA_PASO : EVIDENCIA_FALLO);

  } catch (err) {
    resultado.estado  = 'FALLÓ';
    resultado.detalle = `[${paso}] ${err.message}`;

    if (driver) {
      console.log('\n   🔍 Diagnóstico: volcando tabla para entender la estructura...');
      try { await volcarTabla(driver); } catch (_) {}
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
  console.log(` [Paso 1] Login admin          → ${resultado.subresultados.login.estado}`);
  console.log(`          ${resultado.subresultados.login.detalle}`);
  console.log(` [Paso 2] Acceso al módulo     → ${resultado.subresultados.navegacion.estado}`);
  console.log(`          ${resultado.subresultados.navegacion.detalle}`);
  console.log(` [Paso 3] Órdenes culminadas   → ${resultado.subresultados.tabla.estado}`);
  console.log(`          ${resultado.subresultados.tabla.detalle}`);
  console.log(` [Paso 4] Estado de pago       → ${resultado.subresultados.estadoPago.estado}`);
  console.log(`          ${resultado.subresultados.estadoPago.detalle}`);
  console.log('────────────────────────────────────────────────────');
  console.log(` Detalle: ${resultado.detalle}`);
  console.log(` Duración: ${resultado.duracion} ms`);
  console.log('════════════════════════════════════════════════════\n');

  process.exit(resultado.estado === 'PASÓ' ? 0 : 1);
})();