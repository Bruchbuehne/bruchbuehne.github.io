
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import yaml from 'yaml';

const KV_KEY = 'shows';

// Helper: Get KV namespace ID
function getKVNamespaceId() {
    try {
        const toml = readFileSync('./wrangler.toml', 'utf-8');
        const match = toml.match(/id\s*=\s*["']([^"']+)["']/);
        if (!match) {
            console.error('❌ Could not find KV namespace ID in wrangler.toml');
            process.exit(1);
        }
        return match[1];
    } catch (error) {
        console.error('❌ Error reading wrangler.toml:', error.message);
        process.exit(1);
    }
}

// Helper: Execute KV Put
function kvPut(shows, useRemote = false) {
    const namespaceId = getKVNamespaceId();
    const json = JSON.stringify(shows, null, 2);
    const tmpFile = '/tmp/shows-sync.json';

    writeFileSync(tmpFile, json);

    const remoteFlag = useRemote ? '--remote' : '';

    try {
        execSync(
            `wrangler kv key put "${KV_KEY}" --path="${tmpFile}" --namespace-id="${namespaceId}" ${remoteFlag}`,
            { encoding: 'utf-8', stdio: 'inherit' }
        );
        unlinkSync(tmpFile);
    } catch (error) {
        unlinkSync(tmpFile);
        throw error;
    }
}

// Helper: Format Date
function formatGermanDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Helper: Generate ID
function generateShowId(dateString) {
    // 2025-07-07 19:00:00 -> 2025-07-07-19:00
    return dateString.split(' ').join('-').substring(0, 16);
}

// Main Sync Function
function syncShows() {
    // Check for --remote flag
    const useRemote = process.argv.includes('--remote');
    const target = useRemote ? 'REMOTE (Production)' : 'LOCAL (Development)';

    console.log(`🔄 Syncing shows from shows.yaml to Cloudflare KV [${target}]...`);

    try {
        const file = readFileSync('./shows.yaml', 'utf8');
        const parsed = yaml.parse(file);

        if (!parsed || !parsed.shows) {
            console.error('❌ Invalid shows.yaml format');
            process.exit(1);
        }

        const kvShows = [];

        parsed.shows.forEach(showGroup => {
            showGroup.dates.forEach(showDate => {
                const id = generateShowId(showDate.date);
                kvShows.push({
                    id: id,
                    title: showGroup.title,
                    date: showDate.date,
                    dateFormatted: formatGermanDate(showDate.date),
                    location: 'Bruchbühne Tübingen', // Default or add to yaml if needed
                    capacity: showDate.capacity,
                    reserved: 0 // Warning: This resets reservations! Logic needs to preserve existing.
                });
            });
        });

        // FETCH EXISTING RESERVATIONS TO PRESERVE THEM
        // This is critical - we don't want to wipe 'reserved' counts on every sync.
        const namespaceId = getKVNamespaceId();
        const remoteFlag = useRemote ? '--remote' : '';
        let existingShows = [];
        try {
            const result = execSync(
                `wrangler kv key get "${KV_KEY}" --namespace-id="${namespaceId}" ${remoteFlag}`,
                { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
            );
            existingShows = JSON.parse(result);
        } catch (e) {
            // No existing shows, ignore
        }

        // Merge logic: Update capacity/title/date, but keep 'reserved' count if ID matches
        const finalShows = kvShows.map(newShow => {
            const existing = existingShows.find(s => s.id === newShow.id);
            if (existing) {
                newShow.reserved = existing.reserved || 0;
            }
            return newShow;
        });

        finalShows.sort((a, b) => new Date(a.date) - new Date(b.date));

        kvPut(finalShows, useRemote);
        console.log(`✅ Successfully synced ${finalShows.length} shows to ${target}!`);

    } catch (error) {
        console.error('❌ Error syncing shows:', error);
        process.exit(1);
    }
}

syncShows();
