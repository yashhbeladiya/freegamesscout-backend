import { By, until } from "selenium-webdriver";
import { createDriver } from "../utils/util.js";
import { addGames, deleteAllGames } from "../controller/game.controller.js";

export const primeScraper = async () => {
    const driver = await createDriver();

    try {
        const url = "https://gaming.amazon.com/home";

        // Open the Prime Gaming website
        await driver.get(url);

        await driver.sleep(10000);

        // Wait for the game cards to load
        const gameCards = await driver.wait(
            until.elementsLocated(By.className("item-card__action")),
            30000
        );

        const gameData = [];

        for (const card of gameCards) {
            try {
                // Extract game title
                const titleElement = await card.findElement(By.css("h3"));
                const title = await titleElement.getText();

                // Check for "Free Game" label
                let isFree = false;
                try {
                    const freeLabel = await card.findElement(By.xpath(".//p[@title='free game']"));
                    if (freeLabel) {
                        isFree = true;
                    }
                } catch {
                    isFree = false;
                }

                if (isFree) {

                    // Scroll the card into view
                    await driver.executeScript("arguments[0].scrollIntoView();", card);
                    await driver.sleep(2000);

                    // Extract game image
                    let imgUrl = "";
                    try {
                        const imgContainer = await card.findElement(
                            By.xpath(".//figure[contains(@class, 'tw-aspect')]//img")
                        );
                        imgUrl = await imgContainer.getAttribute("src");
                    } catch (imgError) {
                        console.log(`Error in extracting image for ${title}:`, imgError.message);
                    }

                    // Extract link to the game
                    let gameLink = "";
                    try {
                        const linkElement = await card.findElement(By.tagName("a"));
                        gameLink = await linkElement.getAttribute("href");
                    } catch (linkError) {
                        console.log(`Error in extracting link for ${title}:`, linkError.message);
                    }

                    // Save game data
                    const gameRow = {
                        title,
                        price: "Free",
                        image: imgUrl,
                        link: gameLink,
                        platform: "Prime Gaming",
                    };

                    gameData.push(gameRow);
                }
            } catch (error) {
                console.error(`Error processing a game card: ${error.message}`);
            }
        }

        if (gameData.length > 0) {
            // Before saving delete all the previous data
            await deleteAllGames("Prime Gaming");

            await addGames({ body: gameData }, { 
                status: (code) => ({ json: (message) => console.log(code, message) })
            }); // Simulate the request/response interface
        }

        return gameData;
    } catch (error) {
        console.error("Error scraping Prime Gaming:", error.message);
    } finally {
        // Quit the driver
        await driver.quit();
    }
};

export default primeScraper;
