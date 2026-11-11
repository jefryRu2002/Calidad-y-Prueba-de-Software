const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

const BASE_URL   = 'http://localhost:4200';
const USUARIO    = 'juan@coltech.com'; // Asegúrate de que este usuario exista en tu BD
const CONTRASENA = 'Juan@123';         // y que la contraseña sea correcta
const TIMEOUT    = 15000;

(async () => {
  const options = new chrome.Options();
  options.addArguments('--start-maximized'); 
  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  
  let resultado = "FALLÓ";

  try {
    console.log('════════ INICIANDO PRUEBA DE LOGIN TÉCNICO ════════\n');

    // 1) Ir al login
    console.log("1. Ingresando a la página de login...");
    await driver.get(`${BASE_URL}/login`);
    
    // 2) Esperar a que cargue el formulario
    await driver.wait(until.elementLocated(By.css('.login-box .titulo')), TIMEOUT);
    console.log("2. Formulario cargado.");

    // 3) Llenar credenciales
    console.log("3. Ingresando usuario y contraseña...");
    await driver.findElement(By.css('input[name="usuario"]')).sendKeys(USUARIO);
    await driver.findElement(By.css('input[name="contrasena"]')).sendKeys(CONTRASENA);
    
    // 4) Hacer clic en Iniciar Sesión
    console.log("4. Haciendo clic en 'Iniciar sesión'...");
    await driver.findElement(By.css('button.btn-login')).click();

    // 5) Esperar a que cambie la URL (que salga del login)
    console.log("5. Esperando redirección al dashboard...");
    await driver.wait(async () => {
      const u = await driver.getCurrentUrl();
      return !u.endsWith('/login') && !u.endsWith('/login/');
    }, TIMEOUT, 'El sistema no redirigió (posible rechazo de credenciales).');

    // 6) Pausa para que Angular termine de pintar la vista
    await driver.sleep(2000);
    
    // 7) Verificar si hay un mensaje de error en pantalla
    const errs = await driver.findElements(By.css('.login-box .alerta-error'));
    let hayErrorVisible = false;
    
    if (errs.length > 0) {
      if (await errs[0].isDisplayed()) {
        hayErrorVisible = true;
        const txt = (await errs[0].getText()).trim();
        console.log(`\n⚠️ El sistema rechazó el login. Mensaje: "${txt}"`);
      }
    }

    if (!hayErrorVisible) {
      resultado = "PASÓ";
      console.log("\n✅ Login exitoso. El usuario entró al sistema.");
    }

  } catch (error) {
    console.error("\n❌ La prueba falló por un error:", error.message);
  } finally {
    // 8) Guardar Evidencia
    let estadoArchivo = resultado === "PASÓ" ? "PASO" : "FALLO";
    let nombreArchivo = path.join(__dirname, 'artifacts', `TC-Login-Tecnico_${estadoArchivo}.png`);
    
    // Asegurar que la carpeta artifacts existe
    if (!fs.existsSync(path.join(__dirname, 'artifacts'))) {
        fs.mkdirSync(path.join(__dirname, 'artifacts'));
    }

    let imagen = await driver.takeScreenshot();
    fs.writeFileSync(nombreArchivo, imagen, 'base64');
    console.log(`\n📸 Evidencia guardada en: ${nombreArchivo}`);
    
    await driver.quit();
    console.log(`\n============================================`);
    console.log(` RESULTADO FINAL – ${resultado} ${resultado === "PASÓ" ? "✅" : "❌"}`);
    console.log(`============================================`);
  }
})();