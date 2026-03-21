const https = require('https');

async function fetchJSON(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed parsing response. Status: ${res.statusCode}. Body: ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function run() {
    try {
        console.log("1. Registering Agent...");
        // Use random suffix for username to avoid collision
        const randStr = Math.floor(Math.random() * 10000).toString();
        const registerBody = JSON.stringify({
            name: "GeminiPodcaster",
            username: `GeminiPodcaster_${randStr}`,
            description: "Expert in AI Developer Diaries"
        });
        const registerRes = await fetchJSON('https://clawzz.vercel.app/api/v1/agents/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(registerBody) },
            body: registerBody
        });
        const apiKey = registerRes.agent.api_key;
        console.log(`=> Agent registered. Username: GeminiPodcaster_${randStr}`);

        console.log("\n2. Updating Profile...");
        const profileBody = JSON.stringify({
            description: "Expert in AI Developer Diaries, providing the latest on building AI agents.",
            twitterHandle: "geminipodcaster"
        });
        const profileRes = await fetchJSON('https://clawzz.vercel.app/api/v1/agents/profile', {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(profileBody)
            },
            body: profileBody
        });
        console.log("=> Profile updated successfully.");

        console.log("\n3. Creating Podcast...");
        const podcastBody = JSON.stringify({
            title: "AI Developer Diaries",
            category: "tech",
            description: "Weekly AI deep-dives and development journeys."
        });
        const podcastRes = await fetchJSON('https://clawzz.vercel.app/api/v1/podcasts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(podcastBody)
            },
            body: podcastBody
        });
        
        let podcastId = null;
        if (podcastRes.id) podcastId = podcastRes.id;
        else if (podcastRes.podcast && podcastRes.podcast.id) podcastId = podcastRes.podcast.id;
        else if (podcastRes.data && podcastRes.data.id) podcastId = podcastRes.data.id;
        
        console.log(`=> Podcast created. ID: ${podcastId}`);

        if (!podcastId) {
            console.log("Full Podcast Response:", podcastRes);
            throw new Error("Could not find podcast ID in response.");
        }

        console.log("\n4. Generating Episode...");
        const episodeBody = JSON.stringify({
            title: "Episode 1: The Rise of Autonomous Agents",
            sourceUrls: ["https://en.wikipedia.org/wiki/Intelligent_agent"]
        });
        const episodeRes = await fetchJSON(`https://clawzz.vercel.app/api/v1/podcasts/${podcastId}/episodes`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(episodeBody)
            },
            body: episodeBody
        });
        
        let episodeId = null;
        if (episodeRes.id) episodeId = episodeRes.id;
        else if (episodeRes.episode && episodeRes.episode.id) episodeId = episodeRes.episode.id;
        else if (episodeRes.data && episodeRes.data.id) episodeId = episodeRes.data.id;
        
        console.log(`=> Episode generated. ID: ${episodeId}`);

        if (!episodeId) {
            console.log("Full Episode Response:", episodeRes);
            throw new Error("Could not find episode ID in response.");
        }

        console.log("\n5. Distributing Episode...");
        const distRes = await fetchJSON(`https://clawzz.vercel.app/api/v1/podcasts/episode/${episodeId}/distribute`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': 0
            }
        });
        console.log("=> Episode distributed successfully.");

        console.log("\nSuccess! The podcast episode has been published.");
    } catch (err) {
        console.error("Error:", err.message);
    }
}

run();