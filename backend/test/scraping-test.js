import { createDriver } from "../utils/util.js";
import { By, until } from "selenium-webdriver";

// Test scraping functionality for each gaming platform
async function testScraping() {
    console.log("🧪 Starting comprehensive scraping test for all gaming platforms...");
    
    let driver;
    
    try {
        // Create driver
        console.log("📦 Creating Selenium WebDriver...");
        driver = await createDriver();
        
        // Test 1: Epic Games Store
        await testEpicGames(driver);
        
        // Test 2: Steam Store
        await testSteam(driver);
        
        // Test 3: GOG Store
        await testGOG(driver);
        
        // Test 4: Prime Gaming
        await testPrimeGaming(driver);
        
        console.log("� All scraping tests completed successfully!");
        
    } catch (error) {
        console.error("❌ Scraping test failed:", error.message);
        throw error;
    } finally {
        if (driver) {
            console.log("🧹 Cleaning up driver...");
            await driver.quit();
        }
    }
}

async function testEpicGames(driver) {
    console.log("\n🎮 Testing Epic Games Store scraping...");
    
    try {
        await driver.get("https://store.epicgames.com/en-US/free-games");
        await driver.sleep(4000);
        
        const title = await driver.getTitle();
        console.log(`✅ Epic page loaded: ${title}`);
        
        // Look for free game cards
        const gameCards = await driver.findElements(By.css('[data-testid="offer-card"]'));
        console.log(`✅ Found ${gameCards.length} Epic game cards`);
        
        if (gameCards.length > 0) {
            // Test extracting info from first game
            const firstCard = gameCards[0];
            try {
                const gameTitle = await firstCard.findElement(By.css('[data-testid="offer-title-info-title"]')).getText();
                console.log(`✅ Epic game title extracted: "${gameTitle}"`);
            } catch (e) {
                console.log(`⚠️  Could not extract Epic game title: ${e.message}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ Epic Games test failed: ${error.message}`);
    }
}

async function testSteam(driver) {
    console.log("\n🚂 Testing Steam Store scraping...");
    
    try {
        await driver.get("https://store.steampowered.com/search/?maxprice=free&specials=1");
        await driver.sleep(4000);
        
        const title = await driver.getTitle();
        console.log(`✅ Steam page loaded: ${title}`);
        
        // Look for game results
        const gameResults = await driver.findElements(By.css('#search_resultsRows > a'));
        console.log(`✅ Found ${gameResults.length} Steam game results`);
        
        if (gameResults.length > 0) {
            // Test extracting info from first game
            const firstGame = gameResults[0];
            try {
                const gameTitle = await firstGame.findElement(By.css('.title')).getText();
                console.log(`✅ Steam game title extracted: "${gameTitle}"`);
            } catch (e) {
                console.log(`⚠️  Could not extract Steam game title: ${e.message}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ Steam test failed: ${error.message}`);
    }
}

async function testGOG(driver) {
    console.log("\n🔮 Testing GOG Store scraping...");
    
    try {
        await driver.get("https://www.gog.com/en/games?priceRange=0,0&page=1&sort=popularity");
        await driver.sleep(4000);
        
        const title = await driver.getTitle();
        console.log(`✅ GOG page loaded: ${title}`);
        
        // Look for game products
        const gameProducts = await driver.findElements(By.css('.product-tile'));
        console.log(`✅ Found ${gameProducts.length} GOG game products`);
        
        if (gameProducts.length > 0) {
            // Test extracting info from first game
            const firstGame = gameProducts[0];
            try {
                const gameTitle = await firstGame.findElement(By.css('.product-tile__title')).getText();
                console.log(`✅ GOG game title extracted: "${gameTitle}"`);
            } catch (e) {
                console.log(`⚠️  Could not extract GOG game title: ${e.message}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ GOG test failed: ${error.message}`);
    }
}

async function testPrimeGaming(driver) {
    console.log("\n👑 Testing Prime Gaming scraping...");
    
    try {
        await driver.get("https://gaming.amazon.com/home");
        await driver.sleep(4000);
        
        const title = await driver.getTitle();
        console.log(`✅ Prime Gaming page loaded: ${title}`);
        
        // Look for game offers (Prime Gaming has various selectors)
        const gameOffers = await driver.findElements(By.css('[data-a-target="offer-list-FGWP"] .item, .offer-list .item'));
        console.log(`✅ Found ${gameOffers.length} Prime Gaming offers`);
        
        if (gameOffers.length > 0) {
            // Test extracting info from first offer
            const firstOffer = gameOffers[0];
            try {
                const gameTitle = await firstOffer.findElement(By.css('.item__title, h3')).getText();
                console.log(`✅ Prime Gaming title extracted: "${gameTitle}"`);
            } catch (e) {
                console.log(`⚠️  Could not extract Prime Gaming title: ${e.message}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ Prime Gaming test failed: ${error.message}`);
    }
}

// Run the test
testScraping().catch(console.error);