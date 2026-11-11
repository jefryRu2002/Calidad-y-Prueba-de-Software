/**
 * TC-002 – Inicio de sesión exitoso de cliente
 * Sistema: ColTech
 *
 * Datos de prueba (matriz): maria@gmail.com / 123456
 * Rutas reales (app.routes.ts):
 *   /login  →  /cliente/dashboard
 *
 * Evidencia generada:
 *   artifacts/TC-002_evidencia_inicio_sesion_cliente.png  (PASÓ)
 *   artifacts/TC-002_evidencia_inicio_sesion_cliente_FALLO.png  (si falla)
 *
 * Uso:
 *   node tests\login-cliente-exitoso.js
 *   $env:COLTECH_DEBUG="1"; node tests\login-cliente-exitoso.js   (guarda HTML)
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs   = require('fs');
const path = require('path');

// ======================= CONFIGURACIÓN =======================
const BASE_URL    = process.env.COLTECH_URL || 'http://localhost:4200';
const TIMEOUT     = 15000;
const DEBUG       = process.env.COLTECH_DEBUG === '1';
const TEST_ID     = 'TC-002';
const LOGIN_PATH  = '/login';

// Datos de prueba (matriz TC-002)
const DATOS = {
  usuario:    'andre@gmail.com',
  contrasena: 'Andr3@'
};

// Criterios de aceptación
const ESPERADO = {
  dashboardPath: '/cliente/dashboard',
  dashboardMarkers: [
    'app-cliente-dashboard',
    '.cliente-dashboard',
    'app-cliente-layout',
    'main'
  ],
  descripcion: 'Cliente autenticado y redirigido al dashboard de reparaciones'
};

// Evidencia con nombre oficial para la matriz
const EVIDENCIA_PASO  = 'TC-002_evidencia_inicio_sesion_cliente.png';
const EVIDENCIA_FALLO = 'TC-002_evidencia_inicio_sesion_cliente_FALLO.png';

// Carpeta de artefactos
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

// ======================= SELECTORES LOGIN ====================
const SEL = {
  inputUsuario:    By.css('input[name="usuario"]'),
  inputContrasena: By.css('input[name="contrasena"]'),
  btnLogin:        By.css('button.btn-login'),
  alertaError:     By.css('.login-box .alerta-error'),
  alertaExito:     By.css('.login-box .alerta-exito'),
  titulo:          By.css('.login-box .titulo')
};

// ======================= HELPERS =============================

/**
 * Espera a que CUALQUIERA de los selectores esté visible.
 * Devuelve { selector, elemento } del primero que aparezca.
 */
async function waitForAnySelector(driver, selectors, timeout = TIMEOUT) {
  const inicio = Date.now();
  let ultimoError;

  while (Date.now() - inicio < timeout) {
    for (const sel of selectors) {
      try {
        const el = await driver.findElement(By.css(sel));
        if (await el.isDisplayed()) {
          return { selector: sel, elemento: el };
        }
      } catch (e) {
        ultimoError = e;
      }
    }
    await driver.sleep(250);
  }
  throw new Error(
    `Ningún selector visible tras ${timeout} ms. Probados: ${selectors.join(' | ')}. ` +
    `Último error: ${ultimoError?.message || 'N/A'}`
  );
}

/**
 * Espera ACTIVAMENTE hasta `maxMs` a que aparezca el alerta de error.
 * Devuelve el texto si aparece, o `null` si NO aparece (login OK).
 */
async function esperarAlertaError(driver, maxMs = 1500) {
  try {
    const el = await driver.wait(
      until.elementLocated(SEL.alertaError),
      maxMs
    );
    const texto = (await el.getText()).trim();
    return texto || null;
  } catch (_) {
    return null; // No apareció → login correcto
  }
}

/**
 * Guarda screenshot con el nombre oficial de evidencia.
 */
async function guardarEvidencia(driver, nombreArchivo) {
  try {
    const file = path.join(ARTIFACTS_DIR, nombreArchivo);
    const png  = await driver.takeScreenshot();
    fs.writeFileSync(file, png, 'base64');
    console.log(`   📸 Evidencia guardada: ${file}`);
    return file;
  } catch (e) {
    console.log(`   ⚠️ No se pudo capturar evidencia: ${e.message}`);
  }
}

/**
 * Guarda URL final + HTML de la página (solo con COLTECH_DEBUG=1).
 */
async function dumpPageForDebug(driver) {
  try {
    const ts       = new Date().toISOString().replace(/[:.]/g, '-');
    const url      = await driver.getCurrentUrl();
    const html     = await driver.getPageSource();
    const htmlFile = path.join(ARTIFACTS_DIR, `page-${TEST_ID}-${ts}.html`);
    fs.writeFileSync(htmlFile, `<!-- URL: ${url} -->\n${html}`, 'utf-8');
    console.log(`   📄 HTML guardado: ${htmlFile}`);
    console.log(`   🌐 URL final:     ${url}`);
  } catch (_) { /* silencioso */ }
}

// ======================= TEST PRINCIPAL ======================

(async () => {
  let driver;
  let paso = 'Inicialización';
  const resultado = {
    id:       TEST_ID,
    estado:   'FALLÓ',
    detalle:  '',
    duracion: 0,
    dashboard: null
  };
  const t0 = Date.now();

  try {
    // ---------- Setup ----------
    paso = 'Lanzar Chrome';
    const options = new chrome.Options();
    // options.addArguments('--headless=new'); // descomenta en CI
    options.addArguments('--start-maximized');
    options.addArguments('--disable-notifications');
    options.addArguments('--incognito'); // sesión limpia

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    await driver.manage().setTimeouts({ implicit: 0, pageLoad: TIMEOUT, script: TIMEOUT });
    console.log('   ✓ Chrome lanzado');

    // ---------- Abrir login ----------
    paso = 'Abrir página de login';
    await driver.get(`${BASE_URL}${LOGIN_PATH}`);
    await driver.wait(until.elementLocated(SEL.titulo), TIMEOUT);
    console.log(`   ✓ Login cargado en ${BASE_URL}${LOGIN_PATH}`);

    // ---------- Usuario ----------
    paso = `Ingresar usuario "${DATOS.usuario}"`;
    const inputUsuario = await driver.findElement(SEL.inputUsuario);
    await inputUsuario.clear();
    await inputUsuario.sendKeys(DATOS.usuario);
    console.log(`   ✓ Usuario: ${DATOS.usuario}`);

    // ---------- Contraseña ----------
    paso = 'Ingresar contraseña';
    const inputPass = await driver.findElement(SEL.inputContrasena);
    await inputPass.clear();
    await inputPass.sendKeys(DATOS.contrasena);
    console.log('   ✓ Contraseña ingresada');

    // ---------- Click login ----------
    paso = 'Click en "Iniciar sesión"';
    const btnLogin = await driver.findElement(SEL.btnLogin);
    await driver.wait(until.elementIsEnabled(btnLogin), TIMEOUT);
    await btnLogin.click();
    console.log('   ✓ Click realizado');

    // ---------- Verificar que NO haya alerta de error ----------
    paso = 'Verificar ausencia de mensaje de error';
    const errorUI = await esperarAlertaError(driver, 1500);
    if (errorUI) {
      throw new Error(`Backend rechazó el login: "${errorUI}"`);
    }
    console.log('   ✓ Sin alerta de error');

    // ---------- Verificar redirección ----------
    paso = `Esperar URL "${ESPERADO.dashboardPath}"`;
    await driver.wait(until.urlContains(ESPERADO.dashboardPath), TIMEOUT);
    const urlFinal = await driver.getCurrentUrl();
    console.log(`   ✓ URL actual: ${urlFinal}`);

    // ---------- Verificar dashboard visible ----------
    paso = 'Verificar dashboard renderizado';
    const { selector, elemento } = await waitForAnySelector(
      driver,
      ESPERADO.dashboardMarkers,
      TIMEOUT
    );
    await driver.wait(until.elementIsVisible(elemento), TIMEOUT);
    console.log(`   ✓ Dashboard visible (selector: ${selector})`);
    resultado.dashboard = selector;

    // ---------- Verificar sesión persistida ----------
    paso = 'Verificar persistencia de sesión';
    const storage = await driver.executeScript(`
      const ks = (s) => Object.keys(s || {});
      return {
        localStorage:   ks(window.localStorage).filter(k => /token|jwt|auth|user|role/i.test(k)),
        sessionStorage: ks(window.sessionStorage).filter(k => /token|jwt|auth|user|role/i.test(k)),
        cookies:        document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean)
      };
    `);
    const tieneSesion =
      storage.localStorage.length   > 0 ||
      storage.sessionStorage.length > 0 ||
      storage.cookies.length        > 0;
    if (tieneSesion) {
      console.log(
        `   ✓ Sesión persistida → ` +
        `localStorage:[${storage.localStorage.join(',')}] ` +
        `sessionStorage:[${storage.sessionStorage.join(',')}]`
      );
    } else {
      console.log('   ℹ Sin rastro de sesión en storage/cookies (puede ser sesión en memoria)');
    }

    // ---------- Evidencia oficial ----------
    paso = 'Guardar evidencia';
    await guardarEvidencia(driver, EVIDENCIA_PASO);

    resultado.estado  = 'PASÓ';
    resultado.detalle = ESPERADO.descripcion;

  } catch (err) {
    resultado.estado  = 'FALLÓ';
    resultado.detalle = `[${paso}] ${err.message}`;

    if (driver) {
      try {
        const errs = await driver.findElements(SEL.alertaError);
        if (errs.length) {
          const t = (await errs[0].getText()).trim();
          if (t) resultado.detalle += ` | UI dice: "${t}"`;
        }
      } catch (_) {}

      await guardarEvidencia(driver, EVIDENCIA_FALLO);
      if (DEBUG) await dumpPageForDebug(driver);
    }
  } finally {
    if (driver) {
      try {
        await driver.quit();
        console.log('   ✓ driver.quit() OK');
      } catch (e) {
        console.log(`   ⚠️ Error al cerrar driver: ${e.message}`);
      }
    }
    resultado.duracion = Date.now() - t0;
  }

  // ---------- Reporte en consola ----------
  const icono = resultado.estado === 'PASÓ' ? '✅' : '❌';
  console.log('\n============================================');
  console.log(` ${resultado.id} – ${resultado.estado} ${icono}`);
  console.log(` ${resultado.detalle}`);
  console.log(` Duración: ${resultado.duracion} ms`);
  if (resultado.dashboard) console.log(` Marcador dashboard: ${resultado.dashboard}`);
  console.log('============================================\n');

  process.exit(resultado.estado === 'PASÓ' ? 0 : 1);
})();