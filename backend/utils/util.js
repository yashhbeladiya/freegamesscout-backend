import { Builder } from "selenium-webdriver";
import { Options } from "selenium-webdriver/chrome.js";


export const createDriver = async () => {
    const options = new Options();
    options.addArguments('--headless'); // Run in headless mode
    options.addArguments('--disable-gpu=false');
    options.addArguments('--no-sandbox'); // For environments like Docker
    options.addArguments('--disable-dev-shm-usage'); // Overcome resource limitations on Linux
    options.addArguments('--window-size=1920,1080'); // Set a default resolution (optional)
    options.addArguments(
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    ); // Set a custom user agent (optional)
    options.addArguments('--disable-blink-features=AutomationControlled');

    return new Builder().forBrowser('chrome').setChromeOptions(options).build();
};