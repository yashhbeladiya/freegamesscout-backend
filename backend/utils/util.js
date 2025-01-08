import { Builder } from "selenium-webdriver";
import { Options, ServiceBuilder } from "selenium-webdriver/chrome.js";

export const createDriver = async () => {
    const options = new Options();
    options.addArguments('--headless=false'); // Run in headless mode
    options.addArguments('--disable-gpu=false');
    options.addArguments('--no-sandbox'); // For environments like Docker
    options.addArguments('--disable-dev-shm-usage'); // Overcome resource limitations on Linux
    options.addArguments('--window-size=1920,1080'); // Set a default resolution (optional)
    options.addArguments(
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    ); // Set a custom user agent (optional)
    options.addArguments('--disable-blink-features=AutomationControlled');

    // return new Builder().forBrowser('chrome').setChromeOptions(options).build();

    try { console.log("Creating the Selenium WebDriver..."); 
        const service = new ServiceBuilder('C:/Users/scout/OneDrive/freegamescout-backend/freegamesscout-backend/chromedriver.exe');
        const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).setChromeService(service).build(); 
        console.log("Driver is created successfully"); return driver; 
    } catch (error) { console.error("Error creating the Selenium WebDriver:", error.message); 
        throw error; 
    }
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
    const dateString = await targetDateTime.toLocaleString();

    // Parse the date string into a Date object
    const date = new Date(dateString);

    // Format the date to the desired string format
    const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true };
    const formattedDate = date.toLocaleString('en-US', options);

    // Remove the year from the formatted date
    const formattedDateWithoutYear = formattedDate.replace(/, \d{4}/, '');

    return formattedDateWithoutYear;
}

export const formatToCustomDate = (isoString) => {
    // Create a Date object from the ISO string
    const date = new Date(isoString);

    // Use `toLocaleString` to format the date into the desired format
    const formattedDate = date.toLocaleString('en-US', {
        month: 'short',  // Abbreviated month (e.g., "Dec")
        day: '2-digit',  // 2-digit day (e.g., "22")
        hour: '2-digit', // 2-digit hour (e.g., "09")
        minute: '2-digit', // 2-digit minute (e.g., "00")
        hour12: true, // 12-hour format
    }).replace(",","");  // Remove the comma between the month and day

    return formattedDate;
}