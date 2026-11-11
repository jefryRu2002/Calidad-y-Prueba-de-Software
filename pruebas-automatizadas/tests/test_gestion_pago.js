const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

(async function testGestionPago() {
    let driver = await new Builder().forBrowser('chrome').build();
    let resultado = "FALLÓ";
    
    // Datos de acceso del Administrador (los que creaste en MySQL)
    const ADMIN_CORREO = 'admin@coltech.com'; 
    const ADMIN_PASS = '@dm1n123';

    try {
        console.log("✓ Chrome lanzado");
        
        // 1. Iniciar sesión como administrador
        await driver.get('http://localhost:4200/login');
        await driver.sleep(2000);

        // Llenar credenciales (Ajusta los selectores si tu HTML usa otros)
        let inputUser = await driver.wait(until.elementLocated(By.css('input[name="usuario"]')), 5000);
        await inputUser.sendKeys(ADMIN_CORREO);
        
        let inputPass = await driver.findElement(By.css('input[name="contrasena"]'));
        await inputPass.sendKeys(ADMIN_PASS);
        
        let btnLogin = await driver.findElement(By.css('button.btn-login'));
        await btnLogin.click();
        console.log("✓ Login enviado. Esperando redirección...");
        
        // Esperar a que cargue el dashboard del administrador
        await driver.sleep(4000); 

        // 2. Ingresar al módulo de órdenes de trabajo
        // ⚠️ AQUÍ DEBES INSPECCIONAR TU PÁGINA: Busca el botón o enlace que dice "Órdenes de Trabajo" y ajusta el texto.
        console.log("Buscando el menú de 'Órdenes de Trabajo'...");
        let btnOrdenes = await driver.findElement(By.xpath("//*[contains(text(), 'Órdenes de Trabajo') or contains(text(), 'Ordenes') or contains(text(), 'Gestión')]"));
        await btnOrdenes.click();
        await driver.sleep(3000);
        console.log("✓ Ingresando al módulo de órdenes.");

        // 3 y 4. Consultar las órdenes culminadas y verificar el estado de pago
        // Buscamos en la tabla de la página si existen las palabras "Pagada" o "Pendiente"
        console.log("Buscando estados de pago en la tabla...");
        
        try {
            // Esperamos a que la tabla cargue algún texto de estado
            await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Pagada') or contains(text(), 'Pendiente') or contains(text(), 'Pagado') or contains(text(), 'pendiente')]")), 8000);
            
            // Si lo encontró, buscamos los elementos para ver qué dice exactamente
            let estadosPagada = await driver.findElements(By.xpath("//*[contains(text(), 'Pagada') or contains(text(), 'Pagado')]"));
            let estadosPendiente = await driver.findElements(By.xpath("//*[contains(text(), 'Pendiente') or contains(text(), 'pendiente')]"));

            if (estadosPagada.length > 0 || estadosPendiente.length > 0) {
                resultado = "PASÓ";
                console.log(`✅ TC-008 PASÓ: El sistema muestra los estados de pago.`);
                console.log(`   - Órdenes con estado "Pagada": ${estadosPagada.length} encontradas.`);
                console.log(`   - Órdenes con estado "Pendiente": ${estadosPendiente.length} encontradas.`);
            } else {
                console.log("❌ TC-008 FALLÓ: No se encontraron los textos de estado en la pantalla.");
            }
        } catch (e) {
            console.log("❌ TC-008 FALLÓ: No se encontró la columna de estado de pago o la tabla está vacía.");
        }

    } catch (error) {
        console.error("❌ TC-008 FALLÓ (Error en el script):", error.message);
    } finally {
        let estado = resultado === "PASÓ" ? "PASO" : "FALLO";
        let nombreArchivo = path.join(__dirname, 'artifacts', `TC-008_evidencia_gestion_pago_${estado}.png`);
        
        if (!fs.existsSync(path.join(__dirname, 'artifacts'))) {
            fs.mkdirSync(path.join(__dirname, 'artifacts'));
        }

        let imagen = await driver.takeScreenshot();
        fs.writeFileSync(nombreArchivo, imagen, 'base64');
        console.log(`📸 Evidencia guardada en: ${nombreArchivo}`);
        
        await driver.quit();
        console.log(`\n============================================`);
        console.log(` TC-008 – ${resultado} ${resultado === "PASÓ" ? "✅" : "❌"}`);
        console.log(`============================================`);
    }
})();