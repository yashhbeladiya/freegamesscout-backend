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


export const convertCountdownToDate = async(countdown) => {
    // Get the current date/time
    const currentDateTime = new Date();

    // Parse the countdown string (e.g., "16 : 43 : 52 left")
    const [hours, minutes, seconds] = countdown.split(':').map(part => parseInt(part.trim(), 10));

    // Clone the current date/time
    const targetDateTime = new Date(currentDateTime);

    // Add the countdown time to the current time
    targetDateTime.setHours(targetDateTime.getHours() + hours);
    targetDateTime.setMinutes(targetDateTime.getMinutes() + minutes);
    targetDateTime.setSeconds(targetDateTime.getSeconds() + seconds);

    // Return the target date/time MM/DD/YYYY HH:MM:SS format
    return targetDateTime.toLocaleString(); 
}