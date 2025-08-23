import Game from "../model/game.model.js";
import { formatToCustomDate } from "../utils/util.js";

export const addGames = async (req, res) => {
    try {
        // Validate input
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ message: "Invalid data format. Expected an array of games." });
        }

        const games = req.body;
        const results = {
            added: 0,
            duplicates: 0,
            errors: 0,
        };

        for (const game of games) {
            try {
                await Game.updateOne(
                    { link: game.link, platform: game.platform },
                    { $set: game },
                    { upsert: true }
                );
                results.added++;
            } catch (error) {
                if (error.code === 11000) {
                    console.warn(`Duplicate key error for game: ${game.title}`);
                    results.duplicates++;
                } else {
                    console.error(`Error adding game: ${game.title}`, error);
                    results.errors++;
                }
            }
        }

        // Return success response with details
        res.status(201).json({
            message: "Games processed successfully.",
            addedCount: results.added,
            duplicateCount: results.duplicates,
            errorCount: results.errors,
        });
    } catch (error) {
        console.error("Error processing games:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

export const getGames = async (req, res) => {
    try {
        console.log("Fetching games...");
        
        const { platform, tags, limit } = req.query;
        
        // Build filter object
        let filter = {};
        
        if (platform) {
            // Support multiple platforms: ?platform=Epic,Steam
            const platforms = platform.split(',');
            filter.platform = { $in: platforms };
        }
        
        if (tags) {
            // Support filtering by tags: ?tags=top-pick
            const tagList = tags.split(',');
            filter.tags = { $in: tagList };
        }
        
        // Build query
        let query = Game.find(filter).sort({ release_date: -1 });
        
        if (limit) {
            query = query.limit(parseInt(limit));
        }
        
        const games = await query;
        console.log("Games fetched successfully.");
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

export const getEpicGames = async (req, res) => {
    try {
        const games = await Game.find({ platform: "Epic" }).sort({ release_date: -1 });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

export const getSteamGames = async (req, res) => {
    try {
        const games = await Game.find({ platform: "Steam" }).sort({ release_date: -1 });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

export const getPrimeGames = async (req, res) => {
    try {
        const games = await Game.find({ platform: "Prime Gaming" });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

export const getGOGGames = async (req, res) => {
    try {
        const games = await Game.find({ platform: "GOG" });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

export const getTopPicks = async (req, res) => {
    try {
        const games = await Game.find({ tags: "top-pick" });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

export const getSeachedGames = async (req, res) => {
    try {
        const { search } = req.query;
        const games = await Game.find({ title: { $regex: search, $options: "i" } }).sort({ release_date: -1 });
        res.status(200).json(games);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
}

export const deleteAllGames = async (platform) => {
    try {
        await Game.deleteMany({ platform }); // Delete games based on platform
        console.log(`${platform} games deleted successfully.`);
    } catch (error) {
        console.error("Error deleting games:", error);
    }
};

export const deleteTopPicksPlatform = async (platform) => {
    try {
        await Game.deleteMany({ platform, tag: "top-pick" });
        console.log(`Top picks for ${platform} deleted successfully.`);
    } catch (error) {
        console.error(`Error deleting top picks for ${platform}:`, error);
    }
};

export const deleteExpiredGames = async () => {
    try {
        const currentDate = formatToCustomDate(new Date());
        await Game.deleteMany({ available_until: { $lt: currentDate } });
        console.log("Expired games deleted successfully.");
    } catch (error) {
        console.error("Error deleting expired games:", error);
    }
}