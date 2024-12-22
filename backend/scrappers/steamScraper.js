import { By, until } from "selenium-webdriver";
import { createDriver } from "../utils/util.js";
import { addGames, deleteAllGames } from "../controller/game.controller.js";

export const scrapeSteamGames = async () => {
    const driver = await createDriver();
    const url = 'https://store.steampowered.com/search/?sort_by=Price_ASC&supportedlang=english';
    const gameData = [];

    try {
        // Open the Steam search page
        await driver.get(url);

        // Allow time for the page to load
        await driver.sleep(5000); // Adjust as needed for Steam's loading time

        while (true) {
            const freeGamesDiv = await driver.findElement(By.className("search_results"));
            const freeGames = await freeGamesDiv.findElements(By.className("search_result_row"));

            for (let i = 0; i < freeGames.length; i++) {
                try {
                    // Re-locate elements to avoid stale element reference
                    const freeGamesDiv = await driver.findElement(By.className("search_results"));
                    const freeGames = await freeGamesDiv.findElements(By.className("search_result_row"));
                    const game = freeGames[i];

                    // Scroll into view
                    await driver.executeScript("arguments[0].scrollIntoView();", game);

                    // Extract game details
                    const title = await game.findElement(By.className("title")).getText();
                    const releaseDate = await game.findElement(By.className("search_released")).getText();

                    // Price (free games often don't show price explicitly)
                    const priceElement = await game.findElement(By.xpath("//*[contains(@class, 'price')]"));
                    const price = priceElement ? (await priceElement.getText()).trim() : "Free";

                    // Game link
                    const link = await game.getAttribute("href");

                    // Navigate to the game page to fetch the image
                    await driver.get(link);
                    await driver.sleep(3000); // Allow the game page to load

                    let gameImage = "Image not found";
                    try {
                        const gameImageElement = await driver.findElement(By.id("gameHeaderImageCtn"))
                            .findElement(By.tagName("img"));
                        gameImage = await gameImageElement.getAttribute("src");
                    } catch (error) {
                        console.error(`Could not retrieve game image: ${error}`);
                    }

                    // Return back to the original search page
                    await driver.navigate().back();
                    await driver.sleep(3000); // Allow time for the search page to reload

                    // Add the game data
                    const rowData = {
                        title,
                        releaseDate,
                        availableUntil: "", // Steam doesn't list this
                        price,
                        image: gameImage,
                        link,
                        platform: "Steam",
                        tag: [""],
                    };
                    if (price === "$0.00") {
                        rowData.tag = ["top-pick"];
                    }

                    // Example: push data to your desired storage (gameData list)
                    gameData.push(rowData);

                } catch (staleElementError) {
                    console.error(`Stale element error for game ${i}, retrying...: ${staleElementError}`);
                    await driver.sleep(2000);
                }
            }

            // Scroll down to load more games
            const lastHeight = await driver.executeScript("return document.body.scrollHeight");
            await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
            await driver.sleep(3000);
            const newHeight = await driver.executeScript("return document.body.scrollHeight");

            // Break the loop if no new games are loaded
            if (newHeight === lastHeight) {
                break;
            }
        }
    } catch (error) {
        console.error(`Error scraping Steam games: ${error}`);
    } finally {
        await driver.quit(); // Close the driver
    }
    // console.log("Scraped Steam Games Data:", gameData);

    if (gameData.length > 0) {
        // Before saving delete all the previous data
        await deleteAllGames("Steam");

        await addGames({ body: gameData }, { 
            status: (code) => ({ json: (message) => console.log(code, message) })
        }); // Simulate the request/response interface
    }

    return gameData; // Return the scraped data
};

export default scrapeSteamGames;
