/**
 * TC-007 – Bloqueo por 3 intentos fallidos + desbloqueo por administrador
 * Sistema: ColTech | Módulo: Login + Gestión de usuarios
 *
 * Pasos de la matriz:
 *   1-4) Ingresar contraseña incorrecta 3 veces
 *   5)   Intentar login con la cuenta bloqueada → debe rechazar con "cuenta bloqueada"
 *   6)   Login como admin
 *   7)   Ir a "Gestión de usuarios" → desbloquear la cuenta
 *   8)   Login con credenciales correctas del usuario desbloqueado
 *
 * ⚠️ ESTADO CONOCIDO: este TC está FALLANDO porque el backend NO
 *    implementa el bloqueo automático tras 3 intentos fallidos.
 *    El script lo DETECTA y reporta FALLÓ correctamente.
 *
 * Datos de prueba (matriz):
 *   Usuario a bloquear: jefry@gmail.com
 *   Contraseña incorrecta: 123456     ⚠️ (contraseña usada para los 3 fallos)
 *   Contraseña correcta:   ???        ⚠️ (necesaria para el paso 8)
 *
 * Evidencia:
 *   artifacts/TC-007_evidencia_bloqueo.png            (PASÓ)
 *   artifacts/TC-007_evidencia_bloqueo_FALLO.png      (FALLÓ)
 *   + captura_prueba_3_intentos.jpg (nombre de tu matriz)
 *
 * Uso:
 *   node tests\bloqueo-cuenta.js
 *   $env:COLTECH_DEBUG="1"; node tests\bloqueo-cuenta.js
 */

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs   = require('fs');
const path = require('path');

// ======================= CONFIGURACIÓN =======================
const BASE_URL    = process.env.COLTECH_URL || 'http://localhost:4200';
const TIMEOUT     = 20000;
const DEBUG       = process.env.COLTECH_DEBUG === '1';
const TEST_ID     = 'TC-007';

// Datos de prueba (matriz)
const USUARIO_A_BLOQUEAR = {
  correo:         'jefry@gmail.com',
  passIncorrecta: '123456',                 // ⚠️ contraseña usada para los 3 fallos
  passCorrecta:   process.env.JEFRY_PASS || 'ClaveReal123!'
  // ⚠️ CAMBIA 'passCorrecta' por la contraseña real del usuario jefry@gmail.com
};

const ADMIN = {
  correo:   'admin',
  pass:     'admin123'
};

// Mensajes esperados
const REGEX_ERROR_CREDENCIALES = /credencial|usuario.*contrase|contrase.*usuario|inv[aá]lid|incorrect/i;
const REGEX_CUENTA_BLOQUEADA  = /bloque|bloquead|demasiados intentos|superado.*intentos|intentos.*superado|account.*locked/i;
const REGEX_DESBLOQUEO_OK     = /desbloque|activ|habilit|restablec/i;

// Evidencia
const EVIDENCIA_PASO_MATRIZ = 'captura_prueba_3_intentos.jpg';
const EVIDENCIA_PASO_EXTRA  = 'TC-007_evidencia_bloqueo.png';
const EVIDENCIA_FALLO       = 'TC-007_evidencia_bloqueo_FALLO.png';

// Carpeta artefactos
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

// ======================= SELECTORES ==========================
const SELS = {
  // Login
  inputUsuario:     [By.css('input[name="usuario"]')],
  inputContrasena:  [By.css('input[name="contrasena"]')],
  btnLogin:         [By.css('button.btn-login')],
  alertaError:      [By.css('.login-box .alerta-error')],
  alertaExito:      [By.css('.login-box .alerta-exito')],
  tituloLogin:      [By.css('.login-box .titulo')],

  // Admin layout
  linkUsuarios: [
    By.css('a[routerLink="/administrador/usuarios"]'),
    By.css('a[href*="usuarios"]'),
    By.xpath("//a[contains(normalize-space(.), 'Usuarios') or contains(normalize-space(.), 'usuarios')]"),
    By.xpath("//span[normalize-space()='Usuarios']/ancestor::a")
  ],
  marcadorUsuarios: [
    By.css('app-administrador-usuarios'),
    By.css('.usuarios-container'),
    By.css('table'),
    By.css('mat-table')
  ],

  // Botón "Desbloquear cuenta" en la fila del usuario bloqueado
  btnDesbloquear: [
    By.xpath("//button[contains(normalize-space(.), 'Desbloquear')]"),
    By.xpath("//button[contains(normalize-space(.), 'Desbloquear cuenta')]"),
    By.css('button.btn-desbloquear'),
    By.css('[data-testid="btn-desbloquear"]')
  ]
};

// ======================= HELPERS =============================

async function findFirstVisible(driver, locators, timeout = TIMEOUT, descripcion = '') {
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
  throw new Error(
    `No se encontró elemento visible (${descripcion}). ` +
    `Probados: ${locators.map(l => l.toString()).join(' | ')}`
  );
}

async function esperarTexto(driver, locators, regex, timeout = 5000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    for (const loc of locators) {
      try {
        const els = await driver.findElements(loc);
        for (const el of els) {
          if (!(await el.isDisplayed())) continue;
          const txt = ((await el.getText()) || '').trim();
          if (txt && regex.test(txt)) return txt;
        }
      } catch (_) {}
    }
    await driver.sleep(300);
  }
  return null;
}

async function leerTextoAlertaError(driver) {
  try {
    const el = await driver.wait(until.elementLocated(By.css('.login-box .alerta-error')), 2000);
    if (!(await el.isDisplayed())) return null;
    return ((await el.getText()) || '').trim() || null;
  } catch (_) { return null; }
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
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const url = await driver.getCurrentUrl();
    const html = await driver.getPageSource();
    const file = path.join(ARTIFACTS_DIR, `page-${TEST_ID}-${sufijo}-${ts}.html`);
    fs.writeFileSync(file, `<!-- URL: ${url} -->\n${html}`, 'utf-8');
    console.log(`   📄 HTML guardado: ${file}`);
  } catch (_) {}
}

/**
 * Realiza un intento de login con las credenciales dadas.
 * Devuelve:
 *   { exito: true } si entra al dashboard
 *   { exito: false, mensaje: "..." } si queda en /login con mensaje de error
 *   { exito: false, mensaje: null } si queda en /login sin mensaje
 */
async function intentarLogin(driver, correo, contrasena) {
  // Si no estamos en login, ir
  const url = await driver.getCurrentUrl();
  if (!url.endsWith('/login') && !url.endsWith('/login/')) {
    await driver.get(`${BASE_URL}/login`);
  } else {
    await driver.navigate().refresh();
  }

  await driver.wait(until.elementLocated(SELS.tituloLogin[0]), TIMEOUT);

  const iu = await findFirstVisible(driver, SELS.inputUsuario, TIMEOUT, 'input usuario');
  await iu.elemento.clear();
  await iu.elemento.sendKeys(correo);

  const ip = await findFirstVisible(driver, SELS.inputContrasena, TIMEOUT, 'input contraseña');
  await ip.elemento.clear();
  await ip.elemento.sendKeys(contrasena);

  const btn = await findFirstVisible(driver, SELS.btnLogin, TIMEOUT, 'botón login');
  await driver.wait(until.elementIsEnabled(btn.elemento), TIMEOUT);
  await btn.elemento.click();

  // Esperar: o redirige a dashboard, o se queda en login con/sin mensaje
  const inicio = Date.now();
  while (Date.now() - inicio < 8000) {
    const u = await driver.getCurrentUrl();
    if (!u.endsWith('/login') && !u.endsWith('/login/')) {
      // Login exitoso
      return { exito: true };
    }
    // ¿Apareció mensaje de error?
    const msg = await leerTextoAlertaError(driver);
    if (msg) {
      // Esperar un poco más por si Angular escribe el mensaje completo
      await driver.sleep(400);
      const msgFinal = await leerTextoAlertaError(driver);
      return { exito: false, mensaje: msgFinal || msg };
    }
    await driver.sleep(300);
  }

  return { exito: false, mensaje: null };
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
      bloqueo:            { estado: 'NO_EJECUTADO', detalle: '' },
      desbloqueoAdmin:    { estado: 'NO_EJECUTADO', detalle: '' },
      loginTrasDesbloqueo: { estado: 'NO_EJECUTADO', detalle: '' }
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

    // ---------- PASOS 1-4: 3 intentos fallidos ----------
    console.log('\n   ─── Pasos 1-4: 3 intentos con contraseña incorrecta ───');
    let intentosFallidos = 0;
    let mensajeIntento3 = null;

    for (let intento = 1; intento <= 3; intento++) {
      paso = `Intento fallido #${intento}`;
      console.log(`   ⏳ Intento ${intento}/3 con contraseña incorrecta...`);

      const r = await intentarLogin(
        driver,
        USUARIO_A_BLOQUEAR.correo,
        USUARIO_A_BLOQUEAR.passIncorrecta + (intento > 1 ? `#${intento}` : '')
      );

      if (r.exito) {
        throw new Error(
          `Intento #${intento} NO fue rechazado. El login fue exitoso con contraseña incorrecta. ` +
          `¿La contraseña "${USUARIO_A_BLOQUEAR.passIncorrecta}" es realmente incorrecta?`
        );
      }

      // Validar que el mensaje sea de credenciales inválidas (no de bloqueo)
      if (r.mensaje) {
        console.log(`   ✓ Intento ${intento} rechazado: "${r.mensaje}"`);
        if (REGEX_CUENTA_BLOQUEADA.test(r.mensaje) && intento < 3) {
          console.log(`   ⚠️ El intento ${intento} ya reporta bloqueo (antes del 3ro)`);
        }
      } else {
        console.log(`   ⚠️ Intento ${intento} rechazado sin mensaje visible`);
      }
      intentosFallidos++;
      mensajeIntento3 = r.mensaje;

      await driver.sleep(500);
    }
    console.log(`   ✓ 3 intentos fallidos completados`);

    // ---------- PASO 5: intentar con la cuenta bloqueada ----------
    console.log('\n   ─── Paso 5: intentar login con la cuenta bloqueada ───');
    paso = 'Paso 5 – Verificar bloqueo';
    const rFinal = await intentarLogin(
      driver,
      USUARIO_A_BLOQUEAR.correo,
      USUARIO_A_BLOQUEAR.passIncorrecta
    );

    if (rFinal.exito) {
      throw new Error(
        `El usuario pudo iniciar sesión tras 3 intentos fallidos con contraseña incorrecta. ` +
        `Esto confirma el BUG del backend.`
      );
    }

    const bloqueoDetectado =
      rFinal.mensaje && REGEX_CUENTA_BLOQUEADA.test(rFinal.mensaje);

    if (bloqueoDetectado) {
      console.log(`   ✓ Cuenta bloqueada correctamente. Mensaje: "${rFinal.mensaje}"`);
      resultado.subresultados.bloqueo = {
        estado: 'PASÓ',
        detalle: `Bloqueo detectado tras 3 intentos. Mensaje: "${rFinal.mensaje}"`
      };
    } else {
      console.log(`   ❌ NO se detectó mensaje de "cuenta bloqueada"`);
      console.log(`      Mensaje devuelto: "${rFinal.mensaje || '(ninguno)'}"`);
      console.log(`      → Confirma el BUG del backend: no bloquea la cuenta tras 3 fallos.`);

      resultado.subresultados.bloqueo = {
        estado: 'FALLÓ',
        detalle:
          `Tras 3 intentos fallidos, el mensaje sigue siendo genérico ` +
          `("${rFinal.mensaje || 'sin mensaje'}") en lugar de indicar bloqueo. ` +
          `BUG: el backend no bloquea la cuenta.`
      };

      // BUG DETECTADO → NO tiene sentido probar pasos 6-8
      // (el desbloqueo solo aplica si la cuenta está bloqueada)
      resultado.subresultados.desbloqueoAdmin = {
        estado: 'NO_EJECUTADO',
        detalle: 'No se puede desbloquear una cuenta que nunca se bloqueó'
      };
      resultado.subresultados.loginTrasDesbloqueo = {
        estado: 'NO_EJECUTADO',
        detalle: 'Depende del desbloqueo (paso anterior)'
      };

      // Capturamos evidencia del FALLÓ
      paso = 'Guardar evidencia (fallo detectado)';
      await guardarEvidencia(driver, EVIDENCIA_FALLO);

      throw new Error(
        `BUG confirmado: el sistema NO bloquea la cuenta tras 3 intentos fallidos. ` +
        `Último mensaje: "${rFinal.mensaje || 'sin mensaje'}"`
      );
    }

    // ---------- PASO 6: login como admin ----------
    console.log('\n   ─── Paso 6: login como administrador ───');
    paso = 'Paso 6 – Login admin';
    const rAdmin = await intentarLogin(driver, ADMIN.correo, ADMIN.pass);
    if (!rAdmin.exito) {
      throw new Error(`No se pudo iniciar sesión como admin: "${rAdmin.mensaje || 'sin mensaje'}"`);
    }
    console.log(`   ✓ Admin autenticado. URL: ${await driver.getCurrentUrl()}`);

    // ---------- PASO 7: ir a gestión de usuarios y desbloquear ----------
    console.log('\n   ─── Paso 7: desbloquear cuenta del usuario ───');
    paso = 'Paso 7 – Ir a Gestión de usuarios';

    try {
      const link = await findFirstVisible(driver, SELS.linkUsuarios, 5000, 'link usuarios');
      await link.elemento.click();
      console.log('   ✓ Click en link "Usuarios"');
    } catch (_) {
      console.log('   ℹ Navegando por URL directa a /administrador/usuarios');
      await driver.get(`${BASE_URL}/administrador/usuarios`);
    }

    await findFirstVisible(driver, SELS.marcadorUsuarios, TIMEOUT, 'página de usuarios');
    console.log('   ✓ Página de gestión de usuarios cargada');

    paso = 'Paso 7b – Buscar usuario jefry@gmail.com y desbloquear';
    // Buscar el botón "Desbloquear" (debería estar en la fila de jefry@gmail.com)
    const btnDesbloquear = await findFirstVisible(
      driver,
      SELS.btnDesbloquear,
      TIMEOUT,
      'botón Desbloquear cuenta'
    );
    console.log(`   ✓ Botón "Desbloquear" encontrado (${btnDesbloquear.selector})`);
    await btnDesbloquear.elemento.click();
    console.log('   ✓ Click en "Desbloquear cuenta"');

    // Confirmar que apareció algún mensaje/toast de desbloqueo exitoso
    await driver.sleep(1500);
    const msgDesbloqueo = await esperarTexto(
      driver,
      [By.css('.alerta-exito'), By.css('.toast-success'), By.css('[role="alert"]')],
      REGEX_DESBLOQUEO_OK,
      5000
    );
    if (msgDesbloqueo) {
      console.log(`   ✓ Confirmación desbloqueo: "${msgDesbloqueo}"`);
    } else {
      console.log('   ℹ Sin toast de confirmación (puede ser silencioso)');
    }

    resultado.subresultados.desbloqueoAdmin = {
      estado: 'PASÓ',
      detalle: msgDesbloqueo
        ? `Desbloqueo confirmado con mensaje: "${msgDesbloqueo}"`
        : 'Botón "Desbloquear" ejecutado (sin toast visible)'
    };

    // ---------- PASO 8: login con credenciales correctas ----------
    console.log('\n   ─── Paso 8: login con credenciales correctas del usuario desbloqueado ───');
    paso = 'Paso 8 – Login usuario desbloqueado';

    // Primero cerrar sesión del admin (ir a /login)
    await driver.get(`${BASE_URL}/login`);
    await driver.sleep(1000);

    const rUsuario = await intentarLogin(
      driver,
      USUARIO_A_BLOQUEAR.correo,
      USUARIO_A_BLOQUEAR.passCorrecta
    );

    if (rUsuario.exito) {
      console.log(`   ✓ Login exitoso tras desbloqueo. URL: ${await driver.getCurrentUrl()}`);
      resultado.subresultados.loginTrasDesbloqueo = {
        estado: 'PASÓ',
        detalle: 'El usuario pudo iniciar sesión tras ser desbloqueado'
      };
    } else {
      throw new Error(
        `Login falló tras desbloqueo: "${rUsuario.mensaje || 'sin mensaje'}". ` +
        `Verifica que "passCorrecta" (${USUARIO_A_BLOQUEAR.passCorrecta}) ` +
        `sea la contraseña real de ${USUARIO_A_BLOQUEAR.correo}.`
      );
    }

    // ---------- Veredicto ----------
    resultado.estado  = 'PASÓ';
    resultado.detalle = 'Bloqueo, desbloqueo por admin y nuevo login funcionaron correctamente';

    // Evidencia
    paso = 'Guardar evidencia';
    await guardarEvidencia(driver, EVIDENCIA_PASO_MATRIZ);
    await guardarEvidencia(driver, EVIDENCIA_PASO_EXTRA);

  } catch (err) {
    resultado.estado  = 'FALLÓ';
    resultado.detalle = `[${paso}] ${err.message}`;

    if (driver && resultado.estado === 'FALLÓ') {
      try {
        // Evidencia de fallo si no se guardó antes
        const pathFallo = path.join(ARTIFACTS_DIR, EVIDENCIA_FALLO);
        if (!fs.existsSync(pathFallo)) {
          await guardarEvidencia(driver, EVIDENCIA_FALLO);
        }
        if (DEBUG) await dumpPageForDebug(driver, 'FALLO');
      } catch (_) {}
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
  console.log(` [1] Bloqueo tras 3 intentos      → ${resultado.subresultados.bloqueo.estado}`);
  console.log(`     ${resultado.subresultados.bloqueo.detalle}`);
  console.log(` [2] Desbloqueo por admin         → ${resultado.subresultados.desbloqueoAdmin.estado}`);
  console.log(`     ${resultado.subresultados.desbloqueoAdmin.detalle}`);
  console.log(` [3] Login tras desbloqueo        → ${resultado.subresultados.loginTrasDesbloqueo.estado}`);
  console.log(`     ${resultado.subresultados.loginTrasDesbloqueo.detalle}`);
  console.log('────────────────────────────────────────────────────');
  console.log(` Detalle: ${resultado.detalle}`);
  console.log(` Duración: ${resultado.duracion} ms`);
  console.log('════════════════════════════════════════════════════\n');

  process.exit(resultado.estado === 'PASÓ' ? 0 : 1);
})();