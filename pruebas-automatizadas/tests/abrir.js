
const { Builder, Browser, By, until } = require("selenium-webdriver");

async function main() {
    let driver;

    try {
        driver = await new Builder()
            .forBrowser(Browser.CHROME)
            .build();

        console.log("Iniciando prueba...");

        await driver.get("http://localhost:4200");

        // Esperar a que Angular cargue
        await driver.wait(
            until.elementLocated(By.css("body")),
            10000
        );

        // Obtener información
        const titulo = await driver.getTitle();
        const url = await driver.getCurrentUrl();

        console.log("Título:", titulo);
        console.log("URL:", url);

        // Validar que la página cargó
        if (url.includes("localhost:4200")) {
            console.log("PRUEBA APROBADA: Angular está accesible");
        } else {
            throw new Error("La aplicación no cargó correctamente");
        }

    } catch (error) {
        console.error("PRUEBA FALLIDA:", error.message);

    } finally {
        if (driver) {
            await driver.quit();
        }
    }
}

main();
