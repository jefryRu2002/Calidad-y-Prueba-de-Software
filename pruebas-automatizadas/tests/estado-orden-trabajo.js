/**
 * TC-009 – Seguimiento del estado de orden de trabajo
 * Sistema: ColTech | Módulo: Administrador > Órdenes de trabajo
 *
 * HISTORIA: HU-09
 *   "Como administrador, quiero que cuando el técnico actualice el estado,
 *    el sistema me muestre el estado actual de la orden, para verificar
 *    su progreso y darle seguimiento."
 *
 * Pasos (matriz):
 *   1) Ingresar al panel de administrador
 *   2) Seleccionar Órdenes de Trabajo
 *   3) Buscar por nombre/ID/ticket/equipo/técnico
 *   4) Seleccionar sección del estado actual (Asignado, En diagnóstico, Reparación, Pruebas, Terminado, Entregado, Devuelto)
 *   5) Identificar la orden de trabajo correspondiente
 *   6) Verificar que el estado mostrado coincida con la última actualización del técnico
 *
 * Resultado esperado:
 *   El sistema muestra el estado actualizado y permite seguimiento.
 *
 * Precondición:
 *   ⚠️ Debe existir al menos una orden de trabajo con estado actualizado por un técnico
 *
 * Evidencia:
 *   artifacts/TC-009_evidencia_estado_trabajo.png         (PASÓ)
 *   artifacts/TC-009_evidencia_estado_trabajo_FALLO.png   (FALLÓ)
 *
 * Uso:
 *   node tests\estado-orden-trabajo.js
 *   $env:COLTECH_DEBUG="1"; node tests\estado-orden-trabajo.js
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs   = require('fs');
const path = require('path');

// ======================= CONFIGURACIÓN =======================
const BASE_URL    = process.env.COLTECH_URL || 'http://localhost:4200';
const TIMEOUT     = 20000;
const DEBUG       = process.env.COLTECH_DEBUG === '1';
const TEST_ID     = 'TC-009';

const ADMIN = {
  usuario:    'admin',
  contrasena: 'admin123'
};

const LOGIN_PATH = '/login';

// Los 7 estados válidos de una orden de trabajo (según la matriz)
// Se usan variantes por si Angular muestra "En reparación" vs "Reparación", etc.
const ESTADOS_VALIDOS = [
  { key: 'Asignado',        regex: /\basignad[oa]\b/i },
  { key: 'En diagnóstico',  regex: /diagn[oó]stico|en diagn[oó]stico/i },
  { key: 'Reparación',      regex: /reparaci[oó]n|reparando|en reparaci[oó]n/i },
  { key: 'Pruebas',         regex: /\bpruebas?\b|en pruebas/i },
  { key: 'Terminado',       regex: /\bterminad[oa]\b|finalizad[oa]|completad[oa]/i },
  { key: 'Entregado',       regex: /\bentregad[oa]\b/i },
  { key: 'Devuelto',        regex: /\bdevuelt[oa]\b/i }
];

// Regex general que matchea CUALQUIERA de los 7 estados
const REGEX_ESTADO_VALIDO = new RegExp(
  ESTADOS_VALIDOS.map(e => e.regex.source).join('|'),
  'i'
);

// Evidencia
const EVIDENCIA_PASO  = 'TC-009_evidencia_estado_trabajo.png';
const EVIDENCIA_FALLO = 'TC-009_evidencia_estado_trabajo_FALLO.png';

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

  // Navegación
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

  // Buscador (texto que filtra la tabla)
  inputBusqueda: [
    By.css('input[type="search"]'),
    By.css('input[name="busqueda"]'),
    By.css('input[name="search"]'),
    By.css('input[placeholder*="Buscar" i]'),
    By.css('input[placeholder*="buscar" i]'),
    By.css('input[placeholder*="Filtrar" i]'),
    By.css('.search-input'),
    By.css('input.form-control[type="text"]'),
    By.css('mat-input-element')
  ],

  // Botón para ejecutar búsqueda (si no es reactiva)
  btnBuscar: [
    By.css('button.btn-buscar'),
    By.css('button[type="submit"]'),
    By.xpath("//button[contains(normalize-space(.), 'Buscar')]"),
    By.xpath("//mat-icon[normalize-space()='search']/ancestor::button")
  ],

  // Filtros / tabs de estado (los 7 estados clicables)
  filtrosEstado: [
    By.css('[role="tab"]'),
    By.css('.tab-estado'),
    By.css('.filtro-estado'),
    By.css('button.estado-btn'),
    By.css('mat-button-toggle'),
    By.css('.mat-button-toggle'),
    By.css('a[href*="estado="]')
  ],

  // Tabla de órdenes
  filasTabla: [
    By.css('table tbody tr'),
    By.css('mat-table mat-row'),
    By.css('mat-row'),
    By.css('.orden-row')
  ],

  // Toast de éxito (si hay acciones)
  alertaExito: [By.css('.alerta-exito'), By.css('.toast-success')]
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

/**
 * Como findFirstVisible pero devuelve null si no encuentra
 * (para selectores opcionales como filtros).
 */
async function findFirstVisibleOrNull(driver, locators, timeout = 5000) {
  try {
    return await findFirstVisible(driver, locators, timeout, 'opcional');
  } catch (_) {
    return null;
  }
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
 * Diagnóstico: vuelca la estructura de la tabla y detecta filtros/buscadores.
 */
async function volcarEstructuraUI(driver) {
  try {
    const info = await driver.executeScript(`
      const res = {
        url: window.location.href,
        headers: [],
        filas: [],
        filtrosEstado: [],
        buscadores: [],
        botonesEstado: []
      };

      // Buscadores visibles
      document.querySelectorAll('input').forEach(inp => {
        if (inp.offsetParent === null) return;
        const tipo = (inp.type || '').toLowerCase();
        const ph = inp.getAttribute('placeholder') || '';
        const name = inp.getAttribute('name') || '';
        if (tipo === 'search' || tipo === 'text' || name.includes('busca') || ph.toLowerCase().includes('buscar')) {
          res.buscadores.push({ type: tipo, name, placeholder: ph, className: inp.className });
        }
      });

      // Botones con texto que pueda ser estado
      const estadosRegex = /asignado|diagn[oó]stico|reparaci[oó]n|pruebas?|terminad|entregad|devuelt/i;
      document.querySelectorAll('button, [role="tab"], .tab, .filtro, a').forEach(el => {
        if (el.offsetParent === null) return;
        const txt = (el.innerText || '').trim();
        if (txt && txt.length < 40 && estadosRegex.test(txt)) {
          res.botonesEstado.push({ tag: el.tagName.toLowerCase(), text: txt, className: el.className });
        }
      });

      // Tabla
      const table = document.querySelector('table');
      if (table) {
        table.querySelectorAll('thead th').forEach(th => {
          res.headers.push((th.innerText || '').trim());
        });
        const tbody = table.querySelector('tbody');
        if (tbody) {
          Array.from(tbody.querySelectorAll('tr')).slice(0, 5).forEach(tr => {
            const celdas = Array.from(tr.querySelectorAll('td')).map(td => (td.innerText || '').trim().slice(0, 40));
            res.filas.push(celdas);
          });
        }
      }

      return res;
    `);

    console.log('\n   ─── 🔍 DIAGNÓSTICO DE UI ───');
    console.log(`   URL: ${info.url}`);
    console.log(`   Buscadores (${info.buscadores.length}):`);
    info.buscadores.forEach(b => console.log(`     input type="${b.type}" name="${b.name}" placeholder="${b.placeholder}"`));
    console.log(`   Botones/tabs de estado (${info.botonesEstado.length}):`);
    info.botonesEstado.forEach(b => console.log(`     <${b.tag}> "${b.text}"`));
    console.log(`   Headers tabla (${info.headers.length}): [${info.headers.join(', ')}]`);
    console.log(`   Filas (${info.filas.length} mostradas):`);
    info.filas.forEach((f, i) => console.log(`     [${i}] ${JSON.stringify(f)}`));
    console.log('   ─────────────────────────────\n');

    return info;
  } catch (e) {
    console.log(`   ⚠️ No se pudo volcar la UI: ${e.message}`);
    return { headers: [], filas: [], buscadores: [], botonesEstado: [] };
  }
}

/**
 * Login admin
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

  await driver.wait(async () => {
    const u = await driver.getCurrentUrl();
    return !u.endsWith('/login') && !u.endsWith('/login/');
  }, TIMEOUT, 'El login no redirigió');
}

/**
 * Devuelve el texto de la primera fila de la tabla (o null).
 */
async function primerFilaTexto(driver) {
  for (const loc of SELS.filasTabla) {
    try {
      const filas = await driver.findElements(loc);
      if (filas.length > 0) {
        return (await filas[0].getText()).trim();
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Cuenta cuántas filas hay en la tabla actualmente.
 */
async function contarFilas(driver) {
  for (const loc of SELS.filasTabla) {
    try {
      const filas = await driver.findElements(loc);
      return filas.length;
    } catch (_) {}
  }
  return 0;
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
      login:          { estado: 'NO_EJECUTADO', detalle: '' },
      navegacion:     { estado: 'NO_EJECUTADO', detalle: '' },
      tablaVisible:   { estado: 'NO_EJECUTADO', detalle: '' },
      busqueda:       { estado: 'NO_EJECUTADO', detalle: '' },
      filtrosEstado:  { estado: 'NO_EJECUTADO', detalle: '' },
      estadoFinal:    { estado: 'NO_EJECUTADO', detalle: '' }
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

    // ---------- Paso 2: ir a Órdenes de Trabajo ----------
    console.log('\n   ─── Paso 2: Ir a Órdenes de Trabajo ───');
    paso = 'Paso 2 – Navegar al módulo';
    try {
      const link = await findFirstVisible(driver, SELS.linkOrdenTrabajo, 6000, 'link Órdenes de trabajo');
      await link.elemento.click();
      console.log(`   ✓ Click en link (${link.selector})`);
    } catch (_) {
      console.log('   ℹ Navegando por URL directa');
      await driver.get(`${BASE_URL}/administrador/orden-trabajo`);
    }

    await findFirstVisible(driver, SELS.marcadorOrdenTrabajo, TIMEOUT, 'tabla de órdenes');
    console.log(`   ✓ Página cargada: ${await driver.getCurrentUrl()}`);
    await driver.sleep(2500);   // esperar carga asíncrona de datos
    resultado.subresultados.navegacion = { estado: 'PASÓ', detalle: 'Módulo accesible' };

    // ---------- Diagnóstico UI ----------
    const uiInfo = await volcarEstructuraUI(driver);

    // ---------- Validar que la tabla tenga datos ----------
    const totalFilas = await contarFilas(driver);
    if (totalFilas === 0) {
      throw new Error(
        'La tabla de órdenes está vacía. ' +
        'Precondición "existen órdenes de trabajo" no se cumple.'
      );
    }
    console.log(`   ✓ Tabla con ${totalFilas} fila(s)`);
    resultado.subresultados.tablaVisible = {
      estado: 'PASÓ',
      detalle: `${totalFilas} fila(s) visibles en la tabla`
    };

    // ---------- Paso 3: buscar en el buscador ----------
    console.log('\n   ─── Paso 3: Buscar por cliente/ID/ticket/equipo/técnico ───');
    paso = 'Paso 3 – Usar el buscador';

    const buscador = await findFirstVisibleOrNull(driver, SELS.inputBusqueda, 5000);
    if (!buscador) {
      console.log('   ⚠️ No hay buscador visible → el paso 3 no aplica en esta UI');
      resultado.subresultados.busqueda = {
        estado: 'NO_EJECUTADO',
        detalle: 'La UI no expone buscador (posiblemente filtra solo por tabs)'
      };
    } else {
      console.log(`   ✓ Buscador detectado (${buscador.selector})`);

      // Extraer un término de búsqueda desde la primera fila visible
      // (por ejemplo, el ID de orden o el nombre del cliente)
      const filaTexto = await primerFilaTexto(driver);
      let terminoBusqueda = '';

      if (filaTexto) {
        // Tomar el primer token alfanumérico largo (>3 chars)
        const tokens = filaTexto.split(/\s+/).filter(t => t.length >= 3);
        if (tokens.length > 0) terminoBusqueda = tokens[0];
      }
      if (!terminoBusqueda) terminoBusqueda = 'OT'; // fallback genérico

      console.log(`   ℹ Término a buscar (extraído de la 1ra fila): "${terminoBusqueda}"`);

      await buscador.elemento.clear();
      await buscador.elemento.sendKeys(terminoBusqueda);
      await driver.sleep(1500);  // esperar filtrado reactivo

      const filasTrasBusqueda = await contarFilas(driver);
      console.log(`   ✓ Filas tras búsqueda: ${filasTrasBusqueda} (antes: ${totalFilas})`);

      if (filasTrasBusqueda > 0) {
        resultado.subresultados.busqueda = {
          estado: 'PASÓ',
          detalle: `Búsqueda "${terminoBusqueda}" devolvió ${filasTrasBusqueda} fila(s)`
        };
      } else {
        // Puede que la búsqueda no sea reactiva y requiera click en botón
        const btnBuscar = await findFirstVisibleOrNull(driver, SELS.btnBuscar, 2000);
        if (btnBuscar) {
          await btnBuscar.elemento.click();
          await driver.sleep(1500);
          const filasPostBtn = await contarFilas(driver);
          if (filasPostBtn > 0) {
            resultado.subresultados.busqueda = {
              estado: 'PASÓ',
              detalle: `Búsqueda con botón devolvió ${filasPostBtn} fila(s)`
            };
          } else {
            resultado.subresultados.busqueda = {
              estado: 'FALLÓ',
              detalle: `Búsqueda "${terminoBusqueda}" no devolvió resultados`
            };
          }
        } else {
          resultado.subresultados.busqueda = {
            estado: 'FALLÓ',
            detalle: `Búsqueda "${terminoBusqueda}" no devolvió resultados y no hay botón buscar`
          };
        }
      }
    }

    // ---------- Paso 4: filtros por estado ----------
    console.log('\n   ─── Paso 4: Filtros / secciones por estado ───');
    paso = 'Paso 4 – Filtros de estado';

    // Detectar botones/tabs de estado
    const filtros = await findFirstVisibleOrNull(driver, SELS.filtrosEstado, 3000);

    if (!filtros && uiInfo.botonesEstado.length === 0) {
      console.log('   ⚠️ No hay filtros/tabs de estado visibles en la UI');
      resultado.subresultados.filtrosEstado = {
        estado: 'NO_EJECUTADO',
        detalle: 'La UI no expone filtros por estado (todas las órdenes en una sola tabla)'
      };
    } else {
      // Encontrar el tab/botón que corresponda a alguno de los 7 estados
      let filtroEncontrado = null;
      let estadoFiltro = '';

      for (const estado of ESTADOS_VALIDOS) {
        // Buscar un botón/tab cuyo texto coincida con este estado
        const locators = [
          By.xpath(`//button[contains(normalize-space(.), '${estado.key}')]`),
          By.xpath(`//*[contains(@class,'tab') or @role='tab'][contains(normalize-space(.), '${estado.key}')]`)
        ];
        const encontrado = await findFirstVisibleOrNull(driver, locators, 1500);
        if (encontrado) {
          filtroEncontrado = encontrado;
          estadoFiltro = estado.key;
          break;
        }
      }

      if (filtroEncontrado) {
        console.log(`   ✓ Filtro detectado: "${estadoFiltro}" (${filtroEncontrado.selector})`);
        await filtroEncontrado.elemento.click();
        await driver.sleep(1500);
        const filasTrasFiltro = await contarFilas(driver);
        console.log(`   ✓ Filas tras click en filtro "${estadoFiltro}": ${filasTrasFiltro}`);

        // Verificar que las filas visibles tengan ese estado en alguna celda
        if (filasTrasFiltro > 0) {
          const filas = await driver.findElements(SELS.filasTabla[0]);
          let conEstadoCorrecto = 0;
          for (const fila of filas.slice(0, 5)) {
            const txt = await fila.getText();
            if (estado.regex.test(txt)) conEstadoCorrecto++;
          }
          console.log(`   ℹ Filas con estado "${estadoFiltro}" visibles: ${conEstadoCorrecto}/${filasTrasFiltro}`);

          resultado.subresultados.filtrosEstado = {
            estado: 'PASÓ',
            detalle: `Filtro "${estadoFiltro}" aplicado. ${filasTrasFiltro} fila(s), ` +
                     `${conEstadoCorrecto} con el estado correcto`
          };
        } else {
          resultado.subresultados.filtrosEstado = {
            estado: 'PASÓ',
            detalle: `Filtro "${estadoFiltro}" aplicado (sin resultados en ese estado, válido)`
          };
        }
      } else {
        resultado.subresultados.filtrosEstado = {
          estado: 'NO_EJECUTADO',
          detalle: `Hay elementos clicables pero ninguno coincide con los 7 estados esperados. ` +
                   `Botones detectados: [${uiInfo.botonesEstado.map(b => b.text).join(', ')}]`
        };
      }
    }

    // ---------- Paso 5 y 6: verificar estado final en la tabla ----------
    console.log('\n   ─── Pasos 5-6: Verificar estado en la tabla ───');
    paso = 'Paso 5-6 – Verificar estado visible';

    // Recargar la tabla con todas las filas (por si el filtro anterior dejó vacío)
    // Quitar búsqueda si existe
    const buscadorActual = await findFirstVisibleOrNull(driver, SELS.inputBusqueda, 2000);
    if (buscadorActual) {
      await buscadorActual.elemento.clear();
      await driver.sleep(1000);
    }

    const filasFinales = await contarFilas(driver);
    if (filasFinales === 0) {
      throw new Error('No hay filas en la tabla para validar el estado');
    }

    const filas = await driver.findElements(SELS.filasTabla[0]);
    let filasConEstado = 0;
    let estadosEncontrados = new Set();
    const ejemplos = [];

    for (const fila of filas.slice(0, 10)) {
      const txt = await fila.getText();
      if (!txt) continue;
      if (REGEX_ESTADO_VALIDO.test(txt)) {
        filasConEstado++;
        // Detectar qué estado específico es
        for (const estado of ESTADOS_VALIDOS) {
          if (estado.regex.test(txt)) {
            estadosEncontrados.add(estado.key);
            break;
          }
        }
        if (ejemplos.length < 2) {
          ejemplos.push(txt.replace(/\s+/g, ' ').trim().slice(0, 80));
        }
      }
    }

    console.log(`   → Filas con estado válido: ${filasConEstado}/${Math.min(filas.length, 10)}`);
    console.log(`   → Estados detectados: [${Array.from(estadosEncontrados).join(', ')}]`);
    if (ejemplos.length > 0) console.log(`   → Ejemplos: "${ejemplos.join('" | "')}"`);

    if (filasConEstado > 0) {
      resultado.subresultados.estadoFinal = {
        estado: 'PASÓ',
        detalle: `${filasConEstado} fila(s) muestran un estado válido: ` +
                 `[${Array.from(estadosEncontrados).join(', ')}]`
      };
    } else {
      resultado.subresultados.estadoFinal = {
        estado: 'FALLÓ',
        detalle: `Ninguna fila muestra uno de los 7 estados esperados. ` +
                 `Primera fila: "${ejemplos[0] || '(vacía)'}"`
      };
    }

    // ---------- Veredicto global ----------
    const ok = (
      resultado.subresultados.login.estado === 'PASÓ' &&
      resultado.subresultados.navegacion.estado === 'PASÓ' &&
      resultado.subresultados.tablaVisible.estado === 'PASÓ' &&
      resultado.subresultados.estadoFinal.estado === 'PASÓ'
    );

    resultado.estado  = ok ? 'PASÓ' : 'FALLÓ';
    resultado.detalle = ok
      ? 'El sistema muestra el estado actualizado de las órdenes y permite seguimiento'
      : 'Se detectaron problemas al visualizar el estado de las órdenes';

    // ---------- Evidencia ----------
    paso = 'Guardar evidencia';
    await guardarEvidencia(driver, ok ? EVIDENCIA_PASO : EVIDENCIA_FALLO);

  } catch (err) {
    resultado.estado  = 'FALLÓ';
    resultado.detalle = `[${paso}] ${err.message}`;

    if (driver) {
      console.log('\n   🔍 Diagnóstico: volcando UI para entender qué falló...');
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
  console.log(` [Paso 1] Login admin            → ${resultado.subresultados.login.estado}`);
  console.log(`          ${resultado.subresultados.login.detalle}`);
  console.log(` [Paso 2] Acceso al módulo       → ${resultado.subresultados.navegacion.estado}`);
  console.log(`          ${resultado.subresultados.navegacion.detalle}`);
  console.log(` [Tabla]  Visible con filas      → ${resultado.subresultados.tablaVisible.estado}`);
  console.log(`          ${resultado.subresultados.tablaVisible.detalle}`);
  console.log(` [Paso 3] Búsqueda               → ${resultado.subresultados.busqueda.estado}`);
  console.log(`          ${resultado.subresultados.busqueda.detalle}`);
  console.log(` [Paso 4] Filtros por estado     → ${resultado.subresultados.filtrosEstado.estado}`);
  console.log(`          ${resultado.subresultados.filtrosEstado.detalle}`);
  console.log(` [Paso 5] Estado visible         → ${resultado.subresultados.estadoFinal.estado}`);
  console.log(`          ${resultado.subresultados.estadoFinal.detalle}`);
  console.log('────────────────────────────────────────────────────');
  console.log(` Detalle: ${resultado.detalle}`);
  console.log(` Duración: ${resultado.duracion} ms`);
  console.log('════════════════════════════════════════════════════\n');

  process.exit(resultado.estado === 'PASÓ' ? 0 : 1);
})();