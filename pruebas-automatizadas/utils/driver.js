const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function iniciarNavegador() {
    const opciones = new chrome.Options();

    opciones.addArguments('--start-maximized');

    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(opciones)
        .build();

    return driver;
}

module.exports = { iniciarNavegador };