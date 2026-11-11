const { Builder, By, until, Key } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

(async function testRegistroUsuario() {
    let driver = await new Builder().forBrowser('chrome').build();
    let resultado = "FALLÓ";
    
    try {
        console.log("✓ Chrome lanzado");
        
        await driver.get('http://localhost:4200/login');
        
        // 1. Abrir modal
        let btnCrearCuentaInicio = await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Crear cuenta nueva')]")), 5000);
        await btnCrearCuentaInicio.click();
        console.log("✓ Modal abierto.");
        await driver.sleep(2000); 

        // 2. DNI y Lupa
        let inputDni = await driver.wait(until.elementLocated(By.css('input[placeholder="Ingrese DNI"]')), 5000);
        await inputDni.sendKeys('76653082');
        let btnLupa = await driver.findElement(By.xpath("//input[@placeholder='Ingrese DNI']/parent::*//button"));
        await btnLupa.click();
        console.log("✓ DNI ingresado y buscando en RENIEC...");
        await driver.sleep(5000); 

        // 3. Correo y Teléfono
        await driver.findElement(By.css('input[placeholder="ejemplo@correo.com"]')).sendKeys('andre@gmail.com');
        await driver.findElement(By.css('input[placeholder="987654321"]')).sendKeys('963850472');
        console.log("✓ Correo y Teléfono ingresados.");
        
        // 4. Fecha
        let inputFecha = await driver.findElement(By.css('input[type="date"]'));
        await driver.executeScript(`
            let element = arguments[0];
            element.value = '2004-02-10';
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        `, inputFecha);
        console.log("✓ Fecha ingresada.");

        // 5. Contraseñas (Buscando por el texto exacto de tu imagen)
        console.log("Llenando contraseñas...");
        
        // Campo 1: Buscamos el input que dice "Cree una contraseña"
        let inputPass1 = await driver.findElement(By.css('input[placeholder="Cree una contraseña"]'));
        await inputPass1.click();
        await driver.sleep(500);
        await inputPass1.sendKeys('Andr3@');
        await driver.sleep(1000); 

        // Campo 2: Buscamos el input que dice "Repita la contraseña"
        let inputPass2 = await driver.findElement(By.css('input[placeholder="Repita la contraseña"]'));
        await inputPass2.click();
        await driver.sleep(500);
        await inputPass2.sendKeys('Andr3@');
        await driver.sleep(1000); 
        console.log("✓ Contraseñas ingresadas correctamente.");

        // 6. Clic en el botón final
        console.log("Haciendo clic en 'Crear Cuenta'...");
        let btnRegistrar = await driver.findElement(By.xpath("//button[contains(., 'Crear Cuenta')]"));
        
        await driver.executeScript("arguments[0].scrollIntoView(true);", btnRegistrar);
        await driver.sleep(1000);
        
        await btnRegistrar.click();
        await driver.sleep(4000);

        // 7. Verificación
        try {
            let mensajeExito = await driver.findElement(By.xpath("//*[contains(text(), 'exitosamente') or contains(text(), 'éxito') or contains(text(), 'creada')]"));
            if (await mensajeExito.isDisplayed()) {
                resultado = "PASÓ";
                console.log("✅ TC-001 PASÓ: Registro exitoso verificado.");
            }
        } catch (e) {
            console.log("❌ TC-001 FALLÓ: No apareció el mensaje de éxito en pantalla.");
        }

    } catch (error) {
        console.error("❌ TC-001 FALLÓ (Error en el script):", error.message);
    } finally {
        let estado = resultado === "PASÓ" ? "PASO" : "FALLO";
        let nombreArchivo = path.join(__dirname, 'artifacts', `TC-001_evidencia_registro_${estado}.png`);
        
        let imagen = await driver.takeScreenshot();
        fs.writeFileSync(nombreArchivo, imagen, 'base64');
        console.log(`📸 Evidencia guardada en: ${nombreArchivo}`);
        
        await driver.quit();
        console.log(`\n============================================`);
        console.log(` TC-001 – ${resultado} ${resultado === "PASÓ" ? "✅" : "❌"}`);
        console.log(`============================================`);
    }
})();