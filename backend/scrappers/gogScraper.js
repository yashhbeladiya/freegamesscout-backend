import { By, until } from "selenium-webdriver";
import { createDriver, convertCountdownToDate } from "../utils/util.js"; // Custom driver function
import {
  addGames,
  deleteAllGames,
  deleteTopPicksPlatform,
} from "../controller/game.controller.js";
import e from "express";

export const scrapeGOGGiveaway = async () => {
  // Set up the WebDriver options
  const driver = await createDriver();

  try {
    const url = "https://www.gog.com/en/";
    await driver.get(url);

    const gameData = [];

    // Wait for the game elements to be loaded
    const giveawayHeader = await driver.wait(
      until.elementLocated(By.css(".giveaway__content-header")),
      30000
    );

    // Extract the game name
    const gameName = (await giveawayHeader.getText()).split(":")[1].trim();

    // Extract the game link
    const gameLink = await driver
      .findElement(By.css("a.giveaway__overlay-link"))
      .getAttribute("href");

    // Extract the availability
    const availability = await driver
      .findElement(By.css(".giveaway__countdown"))
      .getText();
    const availableUntil = await convertCountdownToDate(availability);

    // Extract the image link from <source> inside <picture>
    const imageSources = await driver.findElements(
      By.css("picture.giveaway__image source")
    );
    let imageLink = null;

    for (const source of imageSources) {
      const srcset = await source.getAttribute("srcset");
      if (srcset) {
        imageLink = srcset.split(",")[0].trim(); // Take the first image link from srcset
        break;
      }
    }

    // Store the game data
    gameData.push({
      title: gameName,
      release_date: new Date().toLocaleDateString(),
      available_until: availableUntil,
      price: "Free",
      image: imageLink,
      link: gameLink,
      platform: "GOG",
      tags: ["top-pick"],
    });

    console.log("Got game data:", gameData);

    await deleteTopPicksPlatform("GOG");
    await deleteAllGames("GOG");

    // Add the game data to the database
    if (gameData.length > 0) {
      await addGames(
        { body: gameData },
        {
          status: (code) => ({
            json: (message) => console.log(`Status ${code}:`, message),
          }),
        }
      );
      console.log("GOG Giveaway scraped successfully.");
    }

    return gameData;
  } catch (error) {
    console.error("Error scraping GOG Giveaway:", error);
  } finally {
    // Close the driver
    await driver.quit();
  }
};

export const scrapeGOGFreeGames = async () => {
  const driver = await createDriver();

  try {
    const url = "https://www.gog.com/en/games?priceRange=0,0";
    await driver.get(url);

    const gameData = [];
    let hasNextPage = true;

    while (hasNextPage) {
      // Wait for the game elements to load
      await driver.wait(until.elementsLocated(By.css("a.product-tile")), 30000);
      const freeGames = await driver.findElements(By.css("a.product-tile"));

      // Scrape games on the current page
      for (const game of freeGames) {
        try {
          const title = await game
            .findElement(By.css('[selenium-id="productTileGameTitle"]'))
            .getText();
          const price = "Free";
          const link = await game.getAttribute("href");
          const imageElement = await game
            .findElement(By.css("picture img"))
            .catch(() => null);
          let image = null;

          if (imageElement) {
            image = await imageElement.getAttribute("src").catch(() => null);
          }

          // If still null, try alternative selectors or set a default value
          if (!image) {
            try {
              image = await game
                .findElement(By.css(".product-tile__image-wrapper img"))
                .getAttribute("src");
            } catch {
              image = "default_image_url_here"; // Set a default fallback image URL
            }
          }

          if (!/demo/i.test(title)) {
            gameData.push({
              title,
              price,
              image,
              link,
              platform: "GOG",
            });
          }
        } catch (error) {
          console.error(`Error processing a game card: ${error.message}`);
          break; // Stop processing the current page
        }
      }

      // Check if the "Next" button is enabled
      const nextButton = await driver.findElement(
        By.css('[selenium-id="paginationNext"]')
      );
      const nextButtonClass = await nextButton.getAttribute("class");


      if (nextButtonClass && !nextButtonClass.includes("disabled")) {
        // Scroll the entire page down to bring the button into view
        await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
        await driver.sleep(1000); // Wait for the scroll to complete

        await driver.executeScript("arguments[0].click();", nextButton);
        await driver.sleep(2000); // Wait for the page to load
      } else {
        hasNextPage = false; // Stop if there are no more pages
      }
    }

    // Save the game data to the database
    if (gameData.length > 0) {
        await deleteAllGames("GOG");
        await addGames(
            { body: gameData },
            {
            status: (code) => ({
                json: (message) => console.log(`Status ${code}:`, message),
            }),
            }
        );
        console.log("GOG Free Games scraped successfully.");
    } else {
        console.warn("No games found.");
    }
    
  } catch (error) {
    console.error(`Error during pagination scraping: ${error}`);
  } finally {
    await driver.quit();
  }
};
