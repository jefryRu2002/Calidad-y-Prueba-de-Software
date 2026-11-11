// tests/TC-019_MiPerfil.test.js
require('dotenv').config();
const { expect } = require('chai');
const { By, until } = require('selenium-webdriver');

const { buildDriver } = require('../utils/driverFactory');
const PerfilPage = require('../pages/PerfilPage');

// ====== Configuración ======
const LOGIN_URL  = process.env.LOGIN_URL  || 'http://localhost:4200/login';
const USER_EMAIL = process.env.TEST_USER  || 'cliente@zolutionstic.com';
const USER_PASS  = process.env.TEST_PASS  || 'Cliente123!';

// Datos de entrada del caso de prueba TC-019
const NUEVO_TELEFONO = process.env.NUEVO_TELEFONO || '987654321';
const NUEVO_CORREO   = process.env.NUEVO_CORREO   || 'josecorcuera21@gmail.com';

describe('TC-019 / HU-18 — Visualizar y actualizar "Mi Perfil" (Camino Feliz)', function () {
  this.timeout(60000);

  let driver;
  let perfil;

  before(async () => {
    driver = await buildDriver();
    perfil = new PerfilPage(driver, Number(process.env.TIMEOUT) || 15000);
    console.log(`🌐 Navegador iniciado. HEADLESS=${process.env.HEADLESS}`);
  });

  after(async () => {
    if (driver) {
      await driver.quit();
      console.log('🧹 Navegador cerrado');
    }
  });

  // ============================================================
  // Helper: Login del cliente
  // ============================================================
  async function loginComoCliente() {
    console.log('🔑 Iniciando sesión como cliente...');
    await driver.get(LOGIN_URL);

    // Campo email/correo
    const email = await driver.wait(
      until.elementLocated(
        By.css('input[type="email"], input[name="correo"], input[name="email"]')
      ),
      10000
    );
    await driver.wait(until.elementIsVisible(email), 10000);
    await email.clear();
    await email.sendKeys(USER_EMAIL);

    // Campo contraseña
    const pass = await driver.wait(
      until.elementLocated(By.css('input[type="password"], input[name="password"]')),
      10000
    );
    await pass.clear();
    await pass.sendKeys(USER_PASS);

    // Botón login
    const btnLogin = await driver.wait(
      until.elementLocated(
        By.xpath("//button[contains(., 'Ingresar') or contains(., 'Login') or contains(., 'Iniciar')]")
      ),
      10000
    );
    await btnLogin.click();

    // Esperar a que aparezca el menú "Mi Perfil" (indica sesión activa)
    await driver.wait(
      until.elementLocated(
        By.xpath("//*[contains(text(), 'Mi perfil') or contains(text(), 'Mi Perfil')]")
      ),
      15000
    );
    console.log('✅ Sesión iniciada');
  }

  // ============================================================
  // Caso de prueba principal
  // ============================================================
  it('Debe visualizar los datos personales y actualizar teléfono y correo correctamente', async () => {
    // ---------------------------------------------------------
    // PASO 1: Ingresar al sistema con el perfil de cliente
    // ---------------------------------------------------------
    await loginComoCliente();

    // ---------------------------------------------------------
    // PASO 2: Hacer clic en la opción "Mi Perfil"
    // ---------------------------------------------------------
    console.log('👉 Navegando a "Mi Perfil"...');
    await perfil.irAMiPerfil();

    // ---------------------------------------------------------
    // PASO 3: Verificar la correcta visualización de todos los campos
    // ---------------------------------------------------------
    const nombre   = await perfil.obtenerNombre();
    const apellido = await perfil.obtenerApellido();
    const dni      = await perfil.obtenerDni();
    const telefono = await perfil.obtenerTelefono();
    const correo   = await perfil.obtenerCorreo();

    console.log('📄 Datos actuales del perfil:');
    console.log({ nombre, apellido, dni, telefono, correo });

    expect(nombre,   'El nombre no debe estar vacío').to.not.be.empty;
    expect(apellido, 'El apellido no debe estar vacío').to.not.be.empty;
    expect(dni,      'El DNI no debe estar vacío').to.not.be.empty;
    expect(telefono, 'El teléfono no debe estar vacío').to.not.be.empty;
    expect(correo,   'El correo no debe estar vacío').to.not.be.empty;

    // Nombre, Apellido y DNI deben ser NO editables
    expect(await perfil.nombreEsReadonly(),   'Nombre debe ser no editable').to.be.true;
    expect(await perfil.apellidoEsReadonly(), 'Apellido debe ser no editable').to.be.true;
    expect(await perfil.dniEsReadonly(),      'DNI debe ser no editable').to.be.true;

    // Teléfono y Correo deben estar bloqueados antes de editar
    expect(await perfil.telefonoEsEditable(), 'Teléfono debe estar bloqueado inicialmente').to.be.false;
    expect(await perfil.correoEsEditable(),   'Correo debe estar bloqueado inicialmente').to.be.false;
    console.log('✅ Campos visualizados y validados correctamente');

    // ---------------------------------------------------------
    // PASO 4: Hacer clic en el botón "Editar perfil"
    // ---------------------------------------------------------
    console.log('✏️  Activando modo edición...');
    await perfil.clickEditar();

    // Solo los campos editables deben habilitarse
    expect(await perfil.nombreEsReadonly(),   'Nombre debe seguir bloqueado tras editar').to.be.true;
    expect(await perfil.apellidoEsReadonly(), 'Apellido debe seguir bloqueado tras editar').to.be.true;
    expect(await perfil.dniEsReadonly(),      'DNI debe seguir bloqueado tras editar').to.be.true;

    expect(await perfil.telefonoEsEditable(), 'Teléfono debe habilitarse al editar').to.be.true;
    expect(await perfil.correoEsEditable(),   'Correo debe habilitarse al editar').to.be.true;
    console.log('✅ Modo edición activado correctamente');

    // ---------------------------------------------------------
    // PASO 5: Modificar los campos editables
    // ---------------------------------------------------------
    console.log(`📝 Actualizando teléfono a: ${NUEVO_TELEFONO}`);
    await perfil.actualizarTelefono(NUEVO_TELEFONO);

    console.log(`📝 Actualizando correo a: ${NUEVO_CORREO}`);
    await perfil.actualizarCorreo(NUEVO_CORREO);

    // ---------------------------------------------------------
    // PASO 6: Guardar los cambios realizados
    // ---------------------------------------------------------
    console.log('💾 Guardando cambios...');
    await perfil.clickGuardar();

    // Verificar mensaje de éxito
    const textoExito = await perfil.esperarAlertaExito();
    console.log('✅ Alerta mostrada:', textoExito);
    expect(textoExito.toLowerCase()).to.contain('perfil actualizado');

    // Validar persistencia: los valores deben quedar actualizados
    const telefonoFinal = await perfil.obtenerTelefono();
    const correoFinal   = await perfil.obtenerCorreo();

    console.log('📄 Datos después de guardar:');
    console.log({ telefonoFinal, correoFinal });

    expect(telefonoFinal, 'El teléfono debe persistir con el nuevo valor').to.equal(NUEVO_TELEFONO);
    expect(correoFinal,   'El correo debe persistir con el nuevo valor').to.equal(NUEVO_CORREO);

    // Y el modo edición debe haberse cerrado (inputs bloqueados de nuevo)
    expect(await perfil.telefonoEsEditable(), 'Teléfono debe volver a bloquearse').to.be.false;
    expect(await perfil.correoEsEditable(),   'Correo debe volver a bloquearse').to.be.false;

    console.log('🎉 TC-019 completado exitosamente');
  });
});