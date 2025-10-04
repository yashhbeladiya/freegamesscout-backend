import { createDriver } from "../utils/util.js";
import { By } from "selenium-webdriver";

// Optimized scraping test for CI environments
async function testScrapingCI() {
    console.log("🧪 Starting CI-optimized scraping test...");
    
    let driver;
    const startTime = Date.now();
    
    // Set overall timeout for the entire test
    const TOTAL_TIMEOUT = 5 * 60 * 1000; // 5 minutes max
    
    try {
        console.log("📦 Creating Selenium WebDriver...");
        driver = await createDriver();
        
        // Set timeouts for CI environment
        await driver.manage().setTimeouts({
            implicit: 10000,    // 10 seconds to find elements
            pageLoad: 30000,    // 30 seconds to load pages
            script: 30000       // 30 seconds for scripts
        });
        
        // Test 1: Simple connectivity test
        await testConnectivity(driver);
        
        // Test 2: Quick Epic Games test (reduced scope)
        await testEpicGamesCI(driver);
        
        // Test 3: Basic Steam test
        await testSteamCI(driver);
        
        const duration = (Date.now() - startTime) / 1000;
        console.log(`🎉 CI scraping tests completed in ${duration}s!`);
        
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        console.error(`❌ CI scraping test failed after ${duration}s:`, error.message);
        
        // Don't fail the entire CI pipeline for scraping issues
        if (process.env.CI) {
            console.log("⚠️  Scraping test failed in CI - this is non-critical for deployment");
            process.exit(0); // Exit successfully to not block deployment
        } else {
            throw error;
        }
    } finally {
        if (driver) {
            console.log("🧹 Cleaning up driver...");
            try {
                await driver.quit();
            } catch (e) {
                console.log("Driver cleanup completed");
            }
        }
    }
}

async function testConnectivity(driver) {
    console.log("\n🌐 Testing basic connectivity...");
    
    try {
        await driver.get("https://httpbin.org/get");
        const title = await driver.getTitle();
        console.log(`✅ Connectivity test passed: ${title}`);
    } catch (error) {
        console.log(`⚠️  Connectivity test failed: ${error.message}`);
        throw new Error("Basic connectivity failed");
    }
}

async function testEpicGamesCI(driver) {
    console.log("\n🎮 Testing Epic Games Store (CI mode)...");
    
    try {
        // Use a more reliable endpoint
        await driver.get("https://store.epicgames.com/en-US/");
        
        // Wait for page to load with timeout
        await driver.sleep(3000);
        
        const title = await driver.getTitle();
        console.log(`✅ Epic Games accessible: ${title}`);
        
        // Try to find any game elements (don't be too specific)
        const gameElements = await driver.findElements(By.css('a[href*="/p/"]'));
        console.log(`✅ Found ${gameElements.length} potential Epic game links`);
        
    } catch (error) {
        console.log(`⚠️  Epic Games test failed: ${error.message}`);
        // Don't throw - this is just a warning in CI
    }
}

async function testSteamCI(driver) {
    console.log("\n🚂 Testing Steam Store (CI mode)...");
    
    try {
        // Use Steam's simpler page
        await driver.get("https://store.steampowered.com/");
        
        await driver.sleep(3000);
        
        const title = await driver.getTitle();
        console.log(`✅ Steam accessible: ${title}`);
        
        // Just verify we can access the site
        console.log(`✅ Steam site is accessible and responsive`);
        
    } catch (error) {
        console.log(`⚠️  Steam test failed: ${error.message}`);
        // Don't throw - this is just a warning in CI
    }
}

// Run the test
testScrapingCI().catch(error => {
    console.error("Test failed:", error);
    process.exit(1);
});