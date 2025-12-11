// server.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();

// The main function to fetch Game Passes from the public Roblox Inventory API
// This handles pagination to get ALL created Game Passes.
async function fetchCreatedGamePasses(userId) {
    
    // The official inventory API endpoint for Assets. Game Passes are Asset Type ID 34.
    // NOTE: Some users report this endpoint can be unreliable for Game Passes,
    // but we combine it with filtering by creator ID to find created/owned assets.
    // The "accessFilter=2" is sometimes needed to filter for public assets in general.
    const INVENTORY_URL = `https://inventory.roblox.com/v2/users/${userId}/inventory?assetTypes=34&limit=100&sortOrder=Asc`;

    let allPasses = [];
    let nextCursor = '';
    let done = false;
    
    // Loop to handle pagination (getting results that span multiple pages)
    while (!done) {
        let url = INVENTORY_URL;
        if (nextCursor) {
            url += `&cursor=${nextCursor}`;
        }
        
        try {
            // 1. Make the request to the official Roblox API (which works from this external server)
            const response = await fetch(url);
            
            // Check for non-200 status codes (like 404, 403)
            if (!response.ok) {
                console.error(`Roblox API returned status: ${response.status}`);
                break; 
            }
            
            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // 2. Filter the items to only include those created by the player
                for (const item of data.data) {
                    // Check if the item's creator ID matches the requested user ID
                    if (item.creatorId === userId) {
                        allPasses.push({
                            assetId: item.assetId,
                            creatorId: item.creatorId
                        });
                    }
                }
            }

            // 3. Check for the next page token
            nextCursor = data.nextPageCursor;
            if (!nextCursor) {
                done = true;
            }

        } catch (error) {
            console.error(`Error during API fetching for user ${userId}:`, error);
            // Stop the loop on any unhandled error
            done = true;
        }
    }
    
    // Return the clean list of Game Pass IDs
    return allPasses;
}


// Define the API endpoint that your Roblox game will call (e.g., /gamepasses/123456)
app.get('/gamepasses/:userId', async (req, res) => {
    // Parse the userId from the URL parameter
    const userId = parseInt(req.params.userId); 
    
    if (isNaN(userId)) {
        // Return an error if the ID is not a number
        return res.status(400).send({ success: false, error: 'Invalid User ID provided.' });
    }
    
    console.log(`Request received for User ID: ${userId}`);
    
    // Fetch the raw list of Game Pass IDs
    const rawPasses = await fetchCreatedGamePasses(userId);
    
    // Respond with the clean list of IDs, filtering out the extra creator info
    res.json({ 
        success: true,
        gamePassIds: rawPasses.map(p => p.assetId)
    });
});

// Use the port provided by the hosting environment (Render/Heroku/etc.)
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
