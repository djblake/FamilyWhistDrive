/**
 * Tournament Data Processing Engine v42
 * Handles CSV scorecard data and derives tournament structure
 * 
 * Version 42 Features:
 * - Official Seed Ranking System (Tennis-style weighted points)
 * - Trump suit performance tracking
 * - Partnership performance rankings
 * - Family statistics grouping
 */
class TournamentEngine {
    constructor() {
        this.sheetId = null;
        this.tournaments = new Map();
        this.players = new Map();
        this.partnerships = new Map();
        this.missingPlayerLog = new Set();
        this.rawScorecards = [];
        this.playersLookup = new Map(); // Maps player ID to player info
        this.dataIssues = []; // Track data validation issues
        this.lastReportedDataIssues = [];
        this.tournamentMetadata = new Map();
        this.tieBreakers = new Map();

        // Cache (site-wide static JSON files under assets/cache/)
        this.cacheInfo = {
            rootUrl: this.getSiteRootUrl(),
            rawUrl: null,
            statsUrl: null,
            apiManifestUrl: null,
            apiRawUrl: null,
            apiStatsUrl: null
        };
        if (this.cacheInfo.rootUrl) {
            this.cacheInfo.rawUrl = `${this.cacheInfo.rootUrl}assets/cache/raw-data.json`;
            this.cacheInfo.statsUrl = `${this.cacheInfo.rootUrl}assets/cache/stats.json`;
            this.cacheInfo.apiManifestUrl = `${this.cacheInfo.rootUrl}api/cache/manifest`;
            this.cacheInfo.apiRawUrl = `${this.cacheInfo.rootUrl}api/cache/raw`;
            this.cacheInfo.apiStatsUrl = `${this.cacheInfo.rootUrl}api/cache/stats`;
        }
        this.loadedFromCache = false;
        this.loadedCacheSummary = null;
        
        // Trump suit rotation
        this.trumpSuits = ['Hearts', 'Diamonds', 'Spades', 'Clubs'];
        
        // Official 20-player tournament schedule (from devenezia.com)
        this.officialSchedule = this.generateOfficialSchedule();

        // Add "Update data" link into footer across the site
        try {
            if (typeof document !== 'undefined') {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => this.injectUpdateDataFooterLink(), { once: true });
                } else {
                    this.injectUpdateDataFooterLink();
                }
            }
        } catch (error) {
            // ignore
        }
    }

    static get RAW_CACHE_SCHEMA_VERSION() { return 1; }
    static get STATS_CACHE_SCHEMA_VERSION() { return 1; }
    static get STATS_ALGORITHM_VERSION() { return 1; }

    resetState() {
        this.tournaments = new Map();
        this.players = new Map();
        this.partnerships = new Map();
        this.missingPlayerLog = new Set();
        this.rawScorecards = [];
        this.playersLookup = new Map();
        this.dataIssues = [];
        this.lastReportedDataIssues = [];
        this.tournamentMetadata = new Map();
        this.tieBreakers = new Map();
        this.loadedFromCache = false;
        this.loadedCacheSummary = null;
    }

    isDeveloperModeEnabled() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
            return false;
        }
        try {
            return localStorage.getItem('whist_developer_mode') === 'true';
        } catch (error) {
            return false;
        }
    }

    getSiteRootUrl() {
        // Determine site root from this script URL so this works on static hosts with a base path (e.g. GitHub Pages).
        try {
            if (typeof document === 'undefined') {
                return '';
            }
            const scripts = Array.from(document.getElementsByTagName('script') || []);
            const engineScript = scripts.find(s => s && s.src && s.src.includes('/assets/js/tournament-engine.js'));
            if (!engineScript || !engineScript.src) {
                return '';
            }
            const parts = engineScript.src.split('/assets/js/');
            if (!parts[0]) {
                return '';
            }
            return `${parts[0]}/`;
        } catch (error) {
            return '';
        }
    }

    async tryFetchJson(url, options = {}) {
        if (!url) {
            return null;
        }
        try {
            const fetchOptions = {};
            if (options.noStore === true) {
                fetchOptions.cache = 'no-store';
            }
            const response = await fetch(url, fetchOptions);
            if (!response.ok) {
                return null;
            }
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    async loadFromCache() {
        // Returns true if cache was loaded successfully.
        if (!this.cacheInfo) {
            return false;
        }

        // 1) Prefer Cloudflare KV API (site-wide mutable cache)
        if (this.cacheInfo.apiManifestUrl && this.cacheInfo.apiRawUrl && this.cacheInfo.apiStatsUrl) {
            const manifest = await this.tryFetchJson(this.cacheInfo.apiManifestUrl, { noStore: true });
            const rawHash = manifest && manifest.rawHash ? String(manifest.rawHash) : null;
            const alg = manifest && manifest.statsAlgorithmVersion ? String(manifest.statsAlgorithmVersion) : String(TournamentEngine.STATS_ALGORITHM_VERSION);

            if (rawHash) {
                const rawUrl = `${this.cacheInfo.apiRawUrl}?rawHash=${encodeURIComponent(rawHash)}`;
                const statsUrl = `${this.cacheInfo.apiStatsUrl}?rawHash=${encodeURIComponent(rawHash)}&alg=${encodeURIComponent(alg)}`;

                const statsCache = await this.tryFetchJson(statsUrl);
                if (statsCache &&
                    statsCache.schemaVersion === TournamentEngine.STATS_CACHE_SCHEMA_VERSION &&
                    statsCache.statsAlgorithmVersion === TournamentEngine.STATS_ALGORITHM_VERSION &&
                    statsCache.rawHash === rawHash) {
                    this.importStatsCache(statsCache);
                    this.loadedFromCache = true;
                    this.loadedCacheSummary = { source: 'kv:stats', rawHash };
                    return true;
                }

                const rawCache = await this.tryFetchJson(rawUrl);
                if (rawCache && rawCache.schemaVersion === TournamentEngine.RAW_CACHE_SCHEMA_VERSION) {
                    this.importRawCache(rawCache);
                    this.processRawScorecards();
                    this.loadedFromCache = true;
                    this.loadedCacheSummary = { source: 'kv:raw', rawHash: rawCache.rawHash || rawHash };
                    return true;
                }
            }
        }

        // 2) Fallback to static assets cache (site-wide but redeploy-based)
        if (this.cacheInfo.rawUrl) {
            const rawCache = await this.tryFetchJson(this.cacheInfo.rawUrl);
            if (!rawCache || rawCache.schemaVersion !== TournamentEngine.RAW_CACHE_SCHEMA_VERSION) {
                return false;
            }

            this.importRawCache(rawCache);

            const statsCache = await this.tryFetchJson(this.cacheInfo.statsUrl);
            if (statsCache &&
                statsCache.schemaVersion === TournamentEngine.STATS_CACHE_SCHEMA_VERSION &&
                statsCache.statsAlgorithmVersion === TournamentEngine.STATS_ALGORITHM_VERSION &&
                statsCache.rawHash &&
                rawCache.rawHash &&
                statsCache.rawHash === rawCache.rawHash) {
                this.importStatsCache(statsCache);
                this.loadedCacheSummary = { source: 'asset:raw+stats', rawHash: rawCache.rawHash };
            } else {
                this.processRawScorecards();
                this.loadedCacheSummary = { source: 'asset:raw-only', rawHash: rawCache.rawHash };
            }

            this.loadedFromCache = true;
            return true;
        }

        return false;
    }

    exportRawCache() {
        const playersLookupEntries = Array.from(this.playersLookup.entries());
        const tournamentMetadataEntries = Array.from(this.tournamentMetadata.entries());
        const tieBreakersEntries = Array.from(this.tieBreakers.entries());

        const payload = {
            schemaVersion: TournamentEngine.RAW_CACHE_SCHEMA_VERSION,
            generatedAt: new Date().toISOString(),
            source: { sheetId: this.sheetId || null },
            playersLookupEntries,
            tournamentMetadataEntries,
            tieBreakersEntries,
            rawScorecards: Array.isArray(this.rawScorecards) ? this.rawScorecards : [],
            dataIssues: Array.isArray(this.dataIssues) ? this.dataIssues : []
        };

        const rawHash = this.hashString(this.stableStringify({
            playersLookupEntries,
            tournamentMetadataEntries,
            tieBreakersEntries,
            rawScorecards: payload.rawScorecards
        }));
        payload.rawHash = rawHash;

        return payload;
    }

    importRawCache(rawCache) {
        this.resetState();
        this.sheetId = rawCache?.source?.sheetId || null;

        const playersLookupEntries = Array.isArray(rawCache.playersLookupEntries) ? rawCache.playersLookupEntries : [];
        const tournamentMetadataEntries = Array.isArray(rawCache.tournamentMetadataEntries) ? rawCache.tournamentMetadataEntries : [];
        const tieBreakersEntries = Array.isArray(rawCache.tieBreakersEntries) ? rawCache.tieBreakersEntries : [];

        this.playersLookup = new Map(playersLookupEntries);
        this.tournamentMetadata = new Map(tournamentMetadataEntries);
        this.tieBreakers = new Map(tieBreakersEntries);
        this.rawScorecards = Array.isArray(rawCache.rawScorecards) ? rawCache.rawScorecards : [];
        this.dataIssues = Array.isArray(rawCache.dataIssues) ? rawCache.dataIssues : [];
    }

    exportStatsCache(rawHash) {
        return {
            schemaVersion: TournamentEngine.STATS_CACHE_SCHEMA_VERSION,
            statsAlgorithmVersion: TournamentEngine.STATS_ALGORITHM_VERSION,
            generatedAt: new Date().toISOString(),
            rawHash: rawHash || null,
            tournamentsEntries: Array.from(this.tournaments.entries()),
            playersEntries: Array.from(this.players.entries()),
            partnershipsEntries: Array.from(this.partnerships.entries()),
            // include lookup/metadata so name rendering works even if only stats.json is loaded elsewhere
            playersLookupEntries: Array.from(this.playersLookup.entries()),
            tournamentMetadataEntries: Array.from(this.tournamentMetadata.entries()),
            tieBreakersEntries: Array.from(this.tieBreakers.entries()),
            dataIssues: Array.isArray(this.dataIssues) ? this.dataIssues : []
        };
    }

    importStatsCache(statsCache) {
        this.tournaments = new Map(Array.isArray(statsCache.tournamentsEntries) ? statsCache.tournamentsEntries : []);
        this.players = new Map(Array.isArray(statsCache.playersEntries) ? statsCache.playersEntries : []);
        this.partnerships = new Map(Array.isArray(statsCache.partnershipsEntries) ? statsCache.partnershipsEntries : []);

        if (Array.isArray(statsCache.playersLookupEntries)) {
            this.playersLookup = new Map(statsCache.playersLookupEntries);
        }
        if (Array.isArray(statsCache.tournamentMetadataEntries)) {
            this.tournamentMetadata = new Map(statsCache.tournamentMetadataEntries);
        }
        if (Array.isArray(statsCache.tieBreakersEntries)) {
            this.tieBreakers = new Map(statsCache.tieBreakersEntries);
        }
        if (Array.isArray(statsCache.dataIssues)) {
            this.dataIssues = statsCache.dataIssues;
        }
    }

    stableStringify(value) {
        const seen = new WeakSet();
        const normalize = (val) => {
            if (val === null || typeof val === 'undefined') return null;
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
            if (Array.isArray(val)) return val.map(normalize);
            if (typeof val === 'object') {
                if (seen.has(val)) return null;
                seen.add(val);
                const out = {};
                Object.keys(val).sort().forEach((k) => { out[k] = normalize(val[k]); });
                return out;
            }
            return String(val);
        };
        return JSON.stringify(normalize(value));
    }

    hashString(input) {
        // FNV-1a 32-bit
        let hash = 0x811c9dc5;
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = (hash * 0x01000193) >>> 0;
        }
        return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
    }

    injectUpdateDataFooterLink() {
        // Adds an "Update data" link into the footer on any page that has a footer.
        try {
            if (typeof document === 'undefined') {
                return;
            }
            const footerBottom = document.querySelector('.footer-bottom');
            if (!footerBottom) {
                return;
            }
            if (footerBottom.querySelector('[data-update-data-link]')) {
                return;
            }
            const rootUrl = this.cacheInfo && this.cacheInfo.rootUrl ? this.cacheInfo.rootUrl : '';
            if (!rootUrl) {
                return;
            }
            const link = document.createElement('a');
            link.href = `${rootUrl}update-data.html`;
            link.textContent = 'Update data';
            link.setAttribute('data-update-data-link', 'true');

            const p = footerBottom.querySelector('p');
            if (p) {
                p.appendChild(document.createTextNode(' | '));
                p.appendChild(link);
            } else {
                footerBottom.appendChild(link);
            }
        } catch (error) {
            // ignore
        }
    }

    /**
     * Parse a CSV line properly handling quoted fields that may contain commas
     * @param {string} line - The CSV line to parse
     * @returns {Array<string>} Array of field values
     */
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add the last value
        values.push(current.trim());
        
        // Remove any surrounding quotes from values
        return values.map(value => {
            if (value.startsWith('"') && value.endsWith('"')) {
                return value.slice(1, -1);
            }
            return value;
        });
    }

    /**
     * Parse full CSV text into rows, correctly handling:
     * - quoted commas
     * - quoted newlines
     * - escaped quotes ("")
     * This avoids bugs where splitting on "\n" corrupts fields like Inconsistency.
     * @param {string} csvText
     * @returns {Array<Array<string>>}
     */
    parseCSVRows(csvText) {
        if (typeof csvText !== 'string') {
            return [];
        }

        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];

            if (inQuotes) {
                if (char === '"') {
                    // Escaped quote
                    if (csvText[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field += char;
                }
                continue;
            }

            if (char === '"') {
                inQuotes = true;
                continue;
            }

            if (char === ',') {
                row.push(field.trim());
                field = '';
                continue;
            }

            if (char === '\r') {
                continue;
            }

            if (char === '\n') {
                row.push(field.trim());
                field = '';
                // Skip completely empty trailing rows
                if (!(row.length === 1 && row[0] === '')) {
                    rows.push(row);
                }
                row = [];
                continue;
            }

            field += char;
        }

        // Flush last field/row
        row.push(field.trim());
        if (!(row.length === 1 && row[0] === '')) {
            rows.push(row);
        }

        return rows;
    }

    normalizeHeaderName(header) {
        if (typeof header !== 'string') {
            return '';
        }
        return header
            .replace(/\ufeff/g, '') // strip BOM if present
            .replace(/^"|"$/g, '') // remove surrounding quotes
            .trim();
    }

    /**
     * Safely convert incoming values to integers
     */
    parseNumericValue(value) {
        if (value === null || typeof value === 'undefined') {
            return null;
        }
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    /**
     * Generate the official 20-player tournament schedule
     * Based on devenezia.com Whist algorithm
     */
    generateOfficialSchedule() {
        const schedule = [];
        
        // Round 1-19 schedule (simplified representation)
        // This would contain the exact partnership combinations from the screenshot
        const rounds = [
            // Round 1
            {
                round: 1,
                tables: [
                    { table: 1, pairs: [[20, 1], [13, 18]], opponents: [[2, 19], [7, 15]] },
                    { table: 2, pairs: [[2, 19], [7, 15]], opponents: [[20, 1], [13, 18]] },
                    { table: 3, pairs: [[3, 16], [5, 6]], opponents: [[4, 11], [10, 14]] },
                    { table: 4, pairs: [[4, 11], [10, 14]], opponents: [[3, 16], [5, 6]] },
                    { table: 5, pairs: [[8, 17], [9, 12]], opponents: [[8, 17], [9, 12]] }
                ]
            }
            // Additional rounds would follow the same pattern
        ];
        
        // For now, generate a simplified schedule structure
        for (let round = 1; round <= 20; round++) {
            const trumpSuit = this.trumpSuits[(round - 1) % 4];
            const isRepeatRound = round === 20;
            const baseRound = isRepeatRound ? 1 : round;
            
            schedule.push({
                round: round,
                trump_suit: trumpSuit,
                is_repeat: isRepeatRound,
                base_round: baseRound,
                tables: this.generateRoundPartnerships(baseRound)
            });
        }
        
        return schedule;
    }

    /**
     * Generate partnership combinations for a specific round
     * This is a simplified version - in production would use the exact devenezia.com schedule
     */
    generateRoundPartnerships(round) {
        const tables = [];
        
        // Simplified partnership rotation algorithm
        // In production, this would match the exact devenezia.com output
        for (let table = 1; table <= 5; table++) {
            const baseOffset = (round - 1) * 2 + (table - 1) * 4;
            
            const pair1 = [
                ((baseOffset) % 20) + 1,
                ((baseOffset + 10) % 20) + 1
            ];
            
            const pair2 = [
                ((baseOffset + 1) % 20) + 1,
                ((baseOffset + 11) % 20) + 1
            ];
            
            tables.push({
                table: table,
                partnerships: [
                    { players: pair1, opponents: pair2 },
                    { players: pair2, opponents: pair1 }
                ]
            });
        }
        
        return tables;
    }

    /**
     * Read the Index sheet to get list of sheet names to process
     * @param {string} sheetId - The Google Sheets ID
     * @returns {Array<string>} Array of sheet names from column A
     */
    async readIndexSheet(sheetId) {
        try {
            const indexUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Index&range=A:A`;
            console.log(`📖 Reading Index sheet from: ${indexUrl}`);
            
            const response = await fetch(indexUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch Index sheet: ${response.status}`);
            }
            
            const csvData = await response.text();
            const lines = csvData.split('\n');
            const sheetNames = [];
            
            for (const line of lines) {
                const sheetName = line.replace(/^"|"$/g, '').trim(); // Remove quotes and trim
                if (sheetName && sheetName !== '') {
                    sheetNames.push(sheetName);
                }
            }

            return sheetNames;
        } catch (error) {
            console.error('❌ Error reading Index sheet:', error);
            throw error;
        }
    }

    /**
     * Load complete tournament data from Google Sheets
     * @param {string} sheetId - The Google Sheets ID
     */
    async loadFromGoogleSheets(sheetId) {
        try {
            const options = (arguments.length > 1 && arguments[1]) ? arguments[1] : {};
            const developerMode = this.isDeveloperModeEnabled();
            const bypassCache = options.bypassCache === true || developerMode;
            const preferCache = (options.preferCache !== false) && !developerMode;

            this.sheetId = sheetId;
            console.log(`📊 Loading complete tournament data: ${sheetId}`);
            this.resetState();
            this.sheetId = sheetId;

            if (preferCache && !bypassCache) {
                const loaded = await this.loadFromCache();
                if (loaded) {
                    this.reportDataIssues();
                    return this.rawScorecards.length;
                }
            }
            
            // Read the Index sheet to get list of sheets to process
            const indexSheetNames = await this.readIndexSheet(sheetId);
            console.log(`📋 Index sheet contains ${indexSheetNames.length} sheets:`, indexSheetNames);

            // Using Index tab only (no auto-discovery)
            const mergedSheetNames = indexSheetNames.filter(name => name && name !== 'Index');
            
            // Categorize sheets based on their names (no need to fetch metadata)
            let playersSheet = null;
            let tournamentsSheet = null;
            const tournamentSheets = [];
            const scorecardsSheets = [];
            
            for (const sheetName of mergedSheetNames) {
                // Create sheet object with name (GID will be resolved when needed)
                const sheet = { name: sheetName };
                
                if (sheetName === 'Players') {
                    playersSheet = sheet;
                } else if (sheetName === 'Tournaments') {
                    tournamentsSheet = sheet;
                } else if (sheetName.startsWith('WhistGame_')) {
                    tournamentSheets.push(sheet);
                } else if (sheetName.startsWith('Scorecards_')) {
                    scorecardsSheets.push(sheet);
                } else {
                    console.warn(`⚠️  Unknown sheet type for: ${sheetName}`);
                }
            }

            
            // Load tournament metadata first (always attempt Tournaments sheet by name)
            if (!tournamentsSheet) {
                console.warn('⚠️  No "Tournaments" sheet listed in Index. Attempting direct load by name.');
                tournamentsSheet = { name: 'Tournaments' };
            }
            try {
                console.log('📅 Loading Tournaments metadata sheet...');
                await this.loadTournamentMetadata(sheetId, tournamentsSheet);
            } catch (metadataError) {
                console.error('❌ Failed to load Tournaments metadata sheet:', metadataError);
                console.warn('⚠️  Title/year/comments will rely on scorecard data until metadata loads correctly.');
            }
            
            // Load players data if available
            if (playersSheet) {
                console.log('👥 Players sheet found, loading player data...');
                await this.loadPlayersData(sheetId, playersSheet);
            } else {
                console.log('⚠️  No Players sheet found. Will use player names directly from tournament data.');
                this.playersLookup = new Map(); // Initialize empty lookup
            }
            
            console.log(`🏆 Found ${tournamentSheets.length} tournament sheets and ${scorecardsSheets.length} individual scorecards sheets`);
            
            let totalScorecards = 0;
            
            // Load regular tournament sheets
            for (const sheet of tournamentSheets) {
                const count = await this.loadTournamentSheet(sheetId, sheet, sheet.name);
                totalScorecards += count;
            }
            
            // Load and process individual scorecards sheets
            for (const sheet of scorecardsSheets) {
                const count = await this.loadScorecardsSheet(sheetId, sheet, sheet.name);
                totalScorecards += count;
            }

            
            console.log(`✅ Successfully loaded ${totalScorecards} scorecards from ${tournamentSheets.length} tournaments and ${scorecardsSheets.length} individual scorecards sheets`);
            
            // Debug: Check for duplicate scorecards
            const duplicateCheck = new Map();
            let duplicates = 0;
            for (const scorecard of this.rawScorecards) {
                const key = `${scorecard.Tournament}_${scorecard.Year}_${scorecard.Round}_${scorecard.Player1}_${scorecard.Player2}`;
                if (duplicateCheck.has(key)) {
                    duplicates++;
                    if (duplicates <= 3) {
                        console.warn(`🔍 Duplicate scorecard detected:`, key);
                    }
                } else {
                    duplicateCheck.set(key, true);
                }
            }
            if (duplicates > 0) {
                console.warn(`⚠️  Found ${duplicates} duplicate scorecards in raw data`);
            }
            
            // Process all the loaded data
            this.processRawScorecards();
            
            // Report any data issues found
            this.reportDataIssues();
            
            return totalScorecards;
        } catch (error) {
            console.error('❌ Error loading from Google Sheets:', error);
            throw error;
        }
    }

    /**
     * Get list of all sheets in the Google Sheets document
     */
    async getSheetsList(sheetId) {
        // Try multiple methods to get the sheet list
        
        // Method 1: Google Sheets API feed
        try {
            const feedUrl = `https://spreadsheets.google.com/feeds/worksheets/${sheetId}/public/basic?alt=json`;
            const response = await fetch(feedUrl);
            
            if (response.ok) {
                const data = await response.json();
                const sheets = data.feed.entry.map(entry => {
                    const id = entry.id.$t;
                    const gid = id.substring(id.lastIndexOf('/') + 1);
                    return {
                        name: entry.title.$t,
                        gid: gid
                    };
                });
                
                console.log(`✅ Successfully retrieved ${sheets.length} sheets via API feed`);
                return sheets;
            }
        } catch (error) {
            console.warn('Method 1 (API feed) failed:', error.message);
        }
        
        // Method 2: Try to access GID 0 to see if sheet is accessible, then scan more intelligently
        try {
            const testUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
            const testResponse = await fetch(testUrl);
            
            if (testResponse.ok) {
                console.log('✅ Sheet is accessible, using smart GID detection');
                return await this.detectSheetsSmartly(sheetId);
            }
        } catch (error) {
            console.warn('Method 2 (GID test) failed:', error.message);
        }
        
        // Method 3: Fallback to manual detection
        console.warn('All methods failed, using fallback detection');
        return await this.detectSheetsManually(sheetId);
    }

    /**
     * Smart sheet detection - try common patterns first
     */
    async detectSheetsSmartly(sheetId) {
        const sheets = [];
        
        console.log('🎯 Using smart detection strategy...');
        
        // First, try common sheet names that might work
        // Generate WhistGame_ names for years 1985-2025 to dynamically include any new games
        const whistGameNames = [];
        for (let year = 1985; year <= 2025; year++) {
            whistGameNames.push(`WhistGame_${year}`);
        }
        
        // Generate Scorecards_ names for years 1986-2028 for individual scorecard data
        const scorecardsNames = [];
        for (let year = 1986; year <= 2028; year++) {
            scorecardsNames.push(`Scorecards_${year}`);
        }
        
        const commonNames = ['Players', ...whistGameNames, ...scorecardsNames];
        const seenContent = new Set(); // Track content to detect Google Sheets fallback behavior
        
        for (const name of commonNames) {
            try {
                const encodedName = encodeURIComponent(name);
                const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
                const response = await fetch(csvUrl);
                
                if (response.ok) {
                    const csvData = await response.text();
                    console.log(`🔍 DEBUG: Response for ${name}:`, {
                        status: response.status,
                        contentLength: csvData.length,
                        firstLine: csvData.split('\n')[0],
                        totalLines: csvData.split('\n').length
                    });
                    
                    if (csvData && csvData.trim().length > 0 && !csvData.includes('<!DOCTYPE html>')) {
                        // Check for "not found" indicator in the first sheet fallback
                        const firstLine = csvData.split('\n')[0].toLowerCase();
                        if (firstLine.includes('not found') || firstLine.includes('notfound') || 
                            firstLine.includes('invalid') || firstLine.includes('sheet not found')) {
                            console.log(`⚠️  Sheet ${name} returned "not found" indicator - sheet doesn't exist`);
                            continue; // Skip this non-existent sheet
                        }
                        
                        // Create a content signature to detect other fallback patterns
                        const contentSignature = csvData.substring(0, 200); // First 200 chars
                        
                        if (seenContent.has(contentSignature)) {
                            console.log(`⚠️  Sheet ${name} returns same content as previous sheet - likely Google Sheets fallback behavior`);
                            continue; // Skip this duplicate/fallback content
                        }
                        
                        seenContent.add(contentSignature);
                        console.log(`✅ Found unique sheet by name: ${name}`);
                        sheets.push({ name: name, gid: `name:${name}` });
                    } else {
                        console.log(`❌ Invalid content for ${name}: likely doesn't exist`);
                    }
                } else {
                    console.log(`❌ Failed to fetch ${name}: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                // Continue to next name
            }
        }
        
        // If we found sheets by name, return them
        if (sheets.length > 0) {
            console.log(`📋 Smart detection found ${sheets.length} sheets by name`);
            return sheets;
        }
        
        // If no names worked, fall back to GID scanning
        console.log('📋 No sheets found by name, falling back to GID scanning');
        return await this.detectSheetsManually(sheetId);
    }

    /**
     * Detect the type of a sheet by examining its name and content
     * @param {string} sheetId - The Google Sheets ID
     * @param {object} sheet - Sheet information with name and gid
     * @returns {string} - 'players', 'tournament', or 'unknown'
     */
    async detectSheetType(sheetId, sheet) {
        try {
            // First, try name-based detection for efficiency
            if (sheet.name) {
                if (sheet.name.toLowerCase().includes('players') && !sheet.name.startsWith('WhistGame_')) {
                    console.log(`👥 Sheet "${sheet.name}" detected as players (name pattern)`);
                    return 'players';
                }
                // WhistGame_ sheets are assumed to be tournament data by default
                if (sheet.name.startsWith('WhistGame_')) {
                    console.log(`🏆 Sheet "${sheet.name}" assumed as tournament (WhistGame_ prefix)`);
                    // Still examine content to confirm, but default to tournament
                    const contentType = await this.examineSheetContent(sheetId, sheet);
                    return contentType === 'players' ? 'players' : 'tournament';
                }
                
                // Scorecards_ sheets contain individual player scorecards that need reverse-engineering
                if (sheet.name.startsWith('Scorecards_')) {
                    console.log(`📋 Sheet "${sheet.name}" detected as individual scorecards (Scorecards_ prefix)`);
                    return 'scorecards';
                }
            }
            
            // Fallback to content analysis if name doesn't match patterns
            return await this.examineSheetContent(sheetId, sheet);
        } catch (error) {
            console.error(`Error detecting sheet type for "${sheet.name}":`, error);
            return 'unknown';
        }
    }

    /**
     * Examine the content of a sheet to determine its type
     * @param {string} sheetId - The Google Sheets ID
     * @param {object} sheet - Sheet information with name and gid
     * @returns {string} - 'players', 'tournament', or 'unknown'
     */
    async examineSheetContent(sheetId, sheet) {
        try {
            let csvUrl;
            
            // Try accessing by sheet name first
            if (sheet.name) {
                const encodedName = encodeURIComponent(sheet.name);
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
            } else if (sheet.gid) {
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheet.gid}`;
            } else {
                return 'unknown';
            }
            
            const response = await fetch(csvUrl);
            if (!response.ok) {
                console.warn(`Could not access sheet "${sheet.name}" for type detection`);
                return 'unknown';
            }
            
            const csvData = await response.text();
            if (!csvData || csvData.trim().length === 0) {
                return 'unknown';
            }
            
            // Parse just the header row to check columns
            const lines = csvData.split('\n');
            if (lines.length < 1) {
                return 'unknown';
            }
            
            // Clean and parse the header row
            let headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
            
            console.log(`🔍 DEBUG: Sheet "${sheet.name}" content analysis:`, {
                totalLines: lines.length,
                headers: headers,
                firstDataRow: lines.length > 1 ? lines[1] : 'No data rows'
            });
            
            // Check for players sheet characteristics
            const hasPlayerRosterColumns = (
                (headers.includes('id') || headers.includes('player_id')) &&
                (headers.includes('firstname') || headers.includes('lastname') || 
                 headers.includes('player name') || headers.includes('playername'))
            );
            
            // Check for tournament scorecard characteristics
            const hasTournamentColumns = headers.some(h => 
                h.includes('tricks') || h.includes('round') || h.includes('table') || 
                h.includes('trump') || h.includes('tournament')
            );
            
            // If it has player roster columns but NO tournament columns, it's a player roster
            if (hasPlayerRosterColumns && !hasTournamentColumns) {
                console.log(`👥 Sheet "${sheet.name}" detected as players (roster analysis)`);
                return 'players';
            }
            
            // Check for tournament sheet characteristics
            if (headers.includes('tricks_won') || headers.includes('tricksWon') || 
                headers.includes('round') || headers.includes('table') ||
                headers.includes('trump') || headers.includes('partnership') ||
                headers.includes('player_1') || headers.includes('player_2') ||
                headers.includes('player1') || headers.includes('player2') ||
                headers.includes('opponent1') || headers.includes('opponent2') ||
                headers.includes('tournament')) {
                console.log(`🏆 Sheet "${sheet.name}" detected as tournament (scorecard analysis)`);
                return 'tournament';
            }
            
            // If we have player columns and trick data, it's likely a tournament sheet
            const hasPlayerColumns = headers.some(h => 
                h.includes('player') || h.includes('partnership')
            );
            const hasTrickData = headers.some(h => 
                h.includes('trick') || h.includes('score')
            );
            
            if (hasPlayerColumns && hasTrickData) {
                console.log(`🏆 Sheet "${sheet.name}" detected as tournament (pattern analysis)`);
                return 'tournament';
            }
            
            console.log(`⚠️  Could not determine type for sheet "${sheet.name}" with headers:`, headers);
            return 'unknown';
            
        } catch (error) {
            console.warn(`Error detecting type for sheet "${sheet.name}":`, error);
            return 'unknown';
        }
    }

    /**
     * Fallback method to detect sheets manually
     */
    async detectSheetsManually(sheetId) {
        const sheets = [];
        
        console.log('🔍 Trying GID-based discovery for all sheets...');
        
        // Try a reasonable range of GIDs with early termination
        const maxGid = 50; // Upper limit for safety
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 5; // Stop after 5 consecutive failures
        
        for (let gid = 0; gid <= maxGid; gid++) {
            try {
                const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
                const response = await fetch(csvUrl);
                
                if (response.ok) {
                    const csvData = await response.text();
                    
                    // Check if this is actual sheet content (not an error page)
                    if (csvData && csvData.trim().length > 0 && !csvData.includes('<!DOCTYPE html>')) {
                        const lines = csvData.trim().split('\n');
                        if (lines.length > 0) {
                            // Reset consecutive failures counter on success
                            consecutiveFailures = 0;
                            
                            // Try to determine a meaningful name from the content
                            const headers = lines[0].toLowerCase();
                            let sheetName = `Sheet_${gid}`;
                            
                            // Look for clues about the sheet type in headers
                            if (headers.includes('firstname') || headers.includes('lastname') || 
                                headers.includes('player_id') || headers.includes('player name')) {
                                sheetName = `Players_${gid}`;
                            } else if (headers.includes('tricks') || headers.includes('round') || 
                                     headers.includes('table') || headers.includes('trump') ||
                                     headers.includes('partnership')) {
                                // Try to extract year from data if possible
                                if (lines.length > 1) {
                                    const firstDataRow = lines[1];
                                    // Look for 4-digit years in the data
                                    const yearMatch = firstDataRow.match(/20\d{2}/);
                                    if (yearMatch) {
                                        sheetName = `WhistGame_${yearMatch[0]}`;
                                    } else {
                                        sheetName = `WhistGame_${gid}`;
                                    }
                                } else {
                                    sheetName = `WhistGame_${gid}`;
                                }
                            }
                            
                            console.log(`✅ Found sheet at GID ${gid} (named: ${sheetName})`);
                            sheets.push({
                                name: sheetName,
                                gid: gid
                            });
                        } else {
                            consecutiveFailures++;
                        }
                    } else {
                        consecutiveFailures++;
                    }
                } else {
                    // 400/404 errors indicate non-existent sheets
                    consecutiveFailures++;
                    if (response.status === 400 || response.status === 404) {
                        // Don't log every 400/404 error to avoid spam
                        if (gid <= 10) {
                            console.log(`⚠️  GID ${gid} not found (${response.status})`);
                        }
                    }
                }
                
                // Early termination if we hit too many consecutive failures
                if (consecutiveFailures >= maxConsecutiveFailures) {
                    console.log(`🛑 Stopping discovery after ${maxConsecutiveFailures} consecutive failures at GID ${gid}`);
                    break;
                }
                
            } catch (error) {
                consecutiveFailures++;
                // Only log errors for the first few GIDs to avoid spam
                if (gid <= 10) {
                    console.log(`❌ Error accessing GID ${gid}:`, error.message);
                }
                
                // Early termination on consecutive errors
                if (consecutiveFailures >= maxConsecutiveFailures) {
                    console.log(`🛑 Stopping discovery after ${maxConsecutiveFailures} consecutive errors at GID ${gid}`);
                    break;
                }
            }
        }
        
        console.log(`📋 Manual discovery found ${sheets.length} sheets`);
        return sheets;
    }

    /**
     * Load players data from Players sheet
     */
    async loadPlayersData(sheetId, sheetInfo) {
        try {
            // Construct appropriate URL based on how sheet was found
            let csvUrl;
            if (sheetInfo.url) {
                csvUrl = sheetInfo.url;
            } else if (sheetInfo.name && !sheetInfo.gid) {
                // Sheet from index with just name - use name-based URL
                const encodedName = encodeURIComponent(sheetInfo.name);
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
            } else if (sheetInfo.gid && sheetInfo.gid.startsWith('name:')) {
                // Sheet found by name - use name-based URL
                const actualSheetName = sheetInfo.gid.substring(5); // Remove 'name:' prefix
                const encodedName = encodeURIComponent(actualSheetName);
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
            } else {
                // Sheet found by GID - use GID-based URL
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetInfo.gid || sheetInfo}`;
            }
            
            console.log(`👥 Loading players data from: ${sheetInfo.name || sheetInfo.gid || sheetInfo}`);
            
            const response = await fetch(csvUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch players data: ${response.statusText}`);
            }
            
            const csvData = await response.text();
            const lines = csvData.trim().split('\n');
            const headers = this.parseCSVLine(lines[0]);
            
            console.log(`📋 Players sheet headers: ${headers.join(', ')}`);
            
            // Clear existing players data
            this.playersLookup = new Map();
            
            // Debug: Show first few lines of raw CSV data
            console.log('🔍 First few lines of Players CSV:');
            lines.slice(0, Math.min(5, lines.length)).forEach((line, index) => {
                console.log(`  Line ${index}: "${line}"`);
            });
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = this.parseCSVLine(line);
                if (values.length < 3 || !values[0]) continue;
                
                // Debug logging for SteveBlake specifically
                if (values[0] === 'SteveBlake' || line.includes('Steve') || line.includes('Stephen')) {
                    console.log(`🔍 Processing player line: "${line}"`);
                    console.log(`  Parsed values: [${values.map(v => `"${v}"`).join(', ')}]`);
                    console.log(`  values[0] (ID): "${values[0]}"`);
                    console.log(`  values[1] (displayName): "${values[1]}"`);
                    console.log(`  values[2] (firstName): "${values[2]}"`);
                    console.log(`  values[3] (lastName): "${values[3]}"`);
                    console.log(`  values[4] (nickname): "${values[4]}"`);
                }
                
                const player = {
                    id: values[0],
                    displayName: values[1] || values[0], // DisplayName is column 1, fallback to ID
                    firstName: values[2] || '', // FirstName is column 2
                    lastName: values[3] || '', // LastName is column 3
                    nickname: values[4] || '', // Nickname field is column 4
                    fullName: `${values[2] || ''} ${values[3] || ''}`.trim() // firstName + lastName
                };
                
                
                this.playersLookup.set(player.id, player);
            }
            
            console.log(`✅ Loaded ${this.playersLookup.size} players`);
            
            
        } catch (error) {
            console.error('❌ Error loading players data:', error);
            throw error;
        }
    }

    /**
     * Load tournament metadata (title, year, date, comments) from Tournaments sheet
     */
    async loadTournamentMetadata(sheetId, sheetInfo) {
        try {
            // Construct URL similar to other loaders
            let csvUrl;
            if (sheetInfo.url) {
                csvUrl = sheetInfo.url;
            } else if (sheetInfo.name && !sheetInfo.gid) {
                const encodedName = encodeURIComponent(sheetInfo.name);
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
            } else if (sheetInfo.gid && sheetInfo.gid.startsWith('name:')) {
                const actualSheetName = sheetInfo.gid.substring(5);
                const encodedName = encodeURIComponent(actualSheetName);
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
            } else {
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetInfo.gid || sheetInfo}`;
            }
            
            console.log(`📅 Loading tournament metadata from ${sheetInfo.name || sheetInfo.gid || sheetInfo}`);
            
            const response = await fetch(csvUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch tournament metadata: ${response.statusText}`);
            }
            
            const csvData = await response.text();
            const lines = csvData.trim().split('\n');
            if (lines.length <= 1) {
                console.warn('⚠️  Tournaments sheet contains no data rows.');
                return 0;
            }
            
            const headers = this.parseCSVLine(lines[0]).map(h => this.normalizeHeaderName(h));
            let recordsLoaded = 0;
            const metadataIdsDebug = [];
            
            for (let i = 1; i < lines.length; i++) {
                const row = this.parseCSVLine(lines[i]);
                if (!row || row.length === 0) continue;
                
                const record = {};
                headers.forEach((header, index) => {
                    const key = this.normalizeHeaderName(header);
                    if (!key) return;
                    record[key] = row[index] ? row[index].trim() : '';
                });
                
                const rawId = (record.Id || record.ID || '').trim();
                if (!rawId) continue;
                
                metadataIdsDebug.push(`${rawId} (len=${rawId.length})`);
                
                const key = rawId;
                const title = (record.Title || '').trim();
                const date = (record.Date || '').trim();
                const yearValue = (record.Year || '').trim();
                const comments = (record.Comments || '').trim();
                
                let year = yearValue ? parseInt(yearValue, 10) : null;
                if (!year || isNaN(year)) {
                    year = this.extractYearFromId(rawId);
                }
                
                const metadata = {
                    id: rawId,
                    key,
                    title: title || rawId,
                    year,
                    date,
                    comments
                };
                
                console.log('🗂️ Tournaments row parsed:', metadata);
                this.tournamentMetadata.set(key, metadata);
                recordsLoaded++;
            }
            
            console.log('📄 Tournament metadata entries snapshot:',
                Array.from(this.tournamentMetadata.values()).map(entry => ({
                    id: entry.id,
                    title: entry.title,
                    year: entry.year,
                    date: entry.date,
                    comments: entry.comments
                }))
            );
            console.log('🆔 Tournaments Id column values:', metadataIdsDebug);
            console.log(`✅ Loaded metadata for ${recordsLoaded} tournaments`);
            return recordsLoaded;
        } catch (error) {
            console.error('❌ Error loading tournament metadata:', error);
            throw error;
        }
    }

    /**
     * Load a specific tournament sheet
     */
    async loadTournamentSheet(sheetId, sheetInfo, sheetName) {
        try {
            // Construct appropriate URL based on how sheet was found
            let csvUrl;
            if (sheetInfo.url) {
                csvUrl = sheetInfo.url;
            } else if (sheetInfo.name && !sheetInfo.gid) {
                // Sheet from index with just name - use name-based URL
                const encodedName = encodeURIComponent(sheetInfo.name);
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
            } else if (sheetInfo.gid && sheetInfo.gid.startsWith('name:')) {
                // Sheet found by name - use name-based URL
                const actualSheetName = sheetInfo.gid.substring(5); // Remove 'name:' prefix
                const encodedName = encodeURIComponent(actualSheetName);
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
            } else {
                // Sheet found by GID - use GID-based URL
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetInfo.gid || sheetInfo}`;
            }
            
            console.log(`🏆 Loading tournament data from ${sheetName} (${sheetInfo.name || sheetInfo.gid || sheetInfo})`);
            
            const response = await fetch(csvUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch tournament data: ${response.statusText}`);
            }
            
            const csvData = await response.text();
            return await this.processTournamentCSV(csvData, sheetName);
        } catch (error) {
            console.error(`❌ Error loading tournament sheet ${sheetName}:`, error);
            throw error;
        }
    }

    /**
     * Process tournament CSV data with new structure
     */
    async processTournamentCSV(csvData, sheetName) {
        const rows = this.parseCSVRows(csvData);
        if (rows.length <= 1) {
            return 0;
        }

        const headers = rows[0].map(h => this.normalizeHeaderName(h));
        
        let validScorecards = 0;
        let errors = [];
        let emptyRows = 0;
        
        for (let i = 1; i < rows.length; i++) {
            const parsedValues = rows[i];
            const scorecard = { SourceSheet: sheetName };
            
            headers.forEach((header, index) => {
                const headerName = this.normalizeHeaderName(header);
                if (!headerName) {
                    return;
                }
                scorecard[headerName] = parsedValues[index] !== undefined ? parsedValues[index] : '';
            });
            
            // Skip empty rows (now that quotes are removed)
            if (!scorecard.Id) {
                emptyRows++;
                continue;
            }
            
            try {
                if (!this.applyTournamentMetadata(scorecard, sheetName, i + 1)) {
                    continue;
                }
                
                // Handle date parsing - if blank, use Jan 2 of following year
                if (!scorecard.Date) {
                    const year = parseInt(scorecard.Year) || new Date().getFullYear();
                    scorecard.Date = `${year + 1}-01-02`;
                    scorecard.DateKnown = false;
                } else {
                    scorecard.DateKnown = true;
                }
                
                // Process shared hands and convert player IDs to names
                scorecard.Player1Names = this.parseSharedPlayers(scorecard.Player1);
                scorecard.Player2Names = this.parseSharedPlayers(scorecard.Player2);
                scorecard.Opponent1Names = this.parseSharedPlayers(scorecard.Opponent1);
                scorecard.Opponent2Names = this.parseSharedPlayers(scorecard.Opponent2);
                
                // Create display names - preserve hand sharing format when applicable
                scorecard.Player1Name = scorecard.Player1Names.isShared ? 
                    scorecard.Player1Names.names.join(' + ') : scorecard.Player1Names.names[0];
                scorecard.Player2Name = scorecard.Player2Names.isShared ? 
                    scorecard.Player2Names.names.join(' + ') : scorecard.Player2Names.names[0];
                scorecard.Opponent1Name = scorecard.Opponent1Names.isShared ? 
                    scorecard.Opponent1Names.names.join(' + ') : scorecard.Opponent1Names.names[0];
                scorecard.Opponent2Name = scorecard.Opponent2Names.isShared ? 
                    scorecard.Opponent2Names.names.join(' + ') : scorecard.Opponent2Names.names[0];
                
                // Validate scorecard data
                if (this.validateTournamentScorecard(scorecard, i + 1, sheetName)) {
                    this.rawScorecards.push(scorecard);
                    validScorecards++;
                }
            } catch (error) {
                errors.push(`Row ${i + 1}: ${error.message}`);
            }
        }
        
        if (errors.length > 0) {
            console.warn(`⚠️  Validation errors in ${sheetName}:`, errors);
        }
        
        return validScorecards;
    }

    /**
     * Load and process individual scorecards sheet (Scorecards_ prefix)
     * Reverse-engineers partnerships and opponents from individual player records
     */
    async loadScorecardsSheet(sheetId, sheetInfo, sheetName) {
        try {
            // Construct appropriate URL based on how sheet was found
            let csvUrl;
            if (sheetInfo.url) {
                csvUrl = sheetInfo.url;
            } else if (sheetInfo.name && !sheetInfo.gid) {
                // Sheet from index with just name - use name-based URL
                const encodedName = encodeURIComponent(sheetInfo.name);
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
            } else if (sheetInfo.gid && sheetInfo.gid.startsWith('name:')) {
                const actualSheetName = sheetInfo.gid.substring(5);
                const encodedName = encodeURIComponent(actualSheetName);
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedName}`;
            } else {
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetInfo.gid || sheetInfo}`;
            }
            
            console.log(`📋 Loading individual scorecards from ${sheetName} (${sheetInfo.name || sheetInfo.gid || sheetInfo})`);
            
            const response = await fetch(csvUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch scorecards data: ${response.statusText}`);
            }
            
            const csvData = await response.text();
            return await this.processScorecardsCSV(csvData, sheetName);
        } catch (error) {
            console.error(`❌ Error loading scorecards sheet ${sheetName}:`, error);
            throw error;
        }
    }

    /**
     * Process individual scorecards CSV and reverse-engineer partnerships
     * Expected headers: Id, Date, Tournament, Year, Round, Trump_Suit, Table, Player, Tricks_Won
     */
    async processScorecardsCSV(csvData, sheetName) {
        const rows = this.parseCSVRows(csvData);
        if (rows.length <= 1) {
            return 0;
        }

        const headers = rows[0].map(h => this.normalizeHeaderName(h));
        
        const requiredHeaders = ['Id', 'Round', 'Trump_Suit', 'Table', 'Player', 'Tricks_Won'];
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        
        if (missingHeaders.length > 0) {
            throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
        }
        
        // Parse individual scorecards
        const individualScores = [];
        const scorecardIdsDebug = new Set();
        let validRows = 0;
        let emptyRows = 0;
        const errors = [];
        
        for (let i = 1; i < rows.length; i++) {
            const parsedValues = rows[i];
            const hasAnyValue = Array.isArray(parsedValues) && parsedValues.some(v => (v || '').toString().trim() !== '');
            if (!hasAnyValue) {
                emptyRows++;
                continue;
            }
            
            try {
                if (parsedValues.length < headers.length) {
                    errors.push(`Row ${i + 1}: Expected at least ${headers.length} values, got ${parsedValues.length}`);
                    continue;
                }
                
                const scorecard = { SourceSheet: sheetName };
                headers.forEach((header, index) => {
                    const key = this.normalizeHeaderName(header);
                    if (!key) return;
                    scorecard[key] = parsedValues[index] !== undefined ? parsedValues[index] : '';
                });


                if (scorecard.Tie_Break !== undefined && scorecard.Tie_Break !== '') {
                    const tieBreakValue = parseFloat(scorecard.Tie_Break);
                    if (!isNaN(tieBreakValue)) {
                        scorecard.Tie_Break = tieBreakValue;
                        const tieKey = this.getCombinationKeyFromPlayerName(scorecard.Player);
                        if (tieKey) {
                            const existing = this.tieBreakers.get(tieKey);
                            if (existing === undefined || tieBreakValue < existing) {
                                this.tieBreakers.set(tieKey, tieBreakValue);
                            }
                        }
                    } else {
                        delete scorecard.Tie_Break;
                    }
                }
                
                if (scorecard.Id) {
                    scorecardIdsDebug.add(`${scorecard.Id} (len=${scorecard.Id.length})`);
                }
                
                if (!scorecard.Round || !scorecard.Table || !scorecard.Player || !scorecard.Tricks_Won) {
                    errors.push(`Row ${i + 1}: Missing required data`);
                    continue;
                }
                
                if (!this.applyTournamentMetadata(scorecard, sheetName, i + 1)) {
                    continue;
                }
                
                // Convert numeric fields
                scorecard.Year = parseInt(scorecard.Year);
                scorecard.Round = parseInt(scorecard.Round);
                scorecard.Table = parseInt(scorecard.Table);
                scorecard.Tricks_Won = parseInt(scorecard.Tricks_Won);
                
                if (isNaN(scorecard.Round) || isNaN(scorecard.Table) || isNaN(scorecard.Tricks_Won)) {
                    errors.push(`Row ${i + 1}: Invalid numeric values`);
                    continue;
                }
                
                // Tie-break numeric if present
                if (scorecard.Tie_Break !== undefined && scorecard.Tie_Break !== '') {
                    const tieBreakValue = parseFloat(scorecard.Tie_Break);
                    if (!isNaN(tieBreakValue)) {
                        scorecard.Tie_Break = tieBreakValue;
                    } else {
                        scorecard.Tie_Break = null;
                    }
                } else {
                    scorecard.Tie_Break = null;
                }

                // Track inconsistencies
                if (scorecard.Inconsistency && scorecard.Inconsistency.trim() !== '') {
                    const issueMessage = `Inconsistency flagged: ${scorecard.Inconsistency.trim()}`;
                    console.warn(`⚠️ ${issueMessage} [${sheetName} Row ${i + 1}]`);
                    this.dataIssues.push({
                        type: 'scorecard_inconsistency',
                        severity: 'warning',
                        sheet: sheetName,
                        row: i + 1,
                        message: issueMessage,
                        playerId: scorecard.Player,
                        gameId: scorecard.Id
                    });
                }
                
                individualScores.push(scorecard);
                validRows++;
                
            } catch (error) {
                errors.push(`Row ${i + 1}: ${error.message}`);
            }
        }

        
        console.log(`🆔 Scorecard Id values for ${sheetName}:`, Array.from(scorecardIdsDebug));
        console.log(`📊 Parsed ${validRows} individual scorecard records from ${sheetName}`);
        
        if (errors.length > 0) {
            console.warn(`⚠️  Parsing errors in ${sheetName}:`, errors.slice(0, 10)); // Show first 10 errors
            errors.forEach(message => {
                this.dataIssues.push({
                    type: 'scorecard_parse_error',
                    severity: 'error',
                    sheet: sheetName,
                    message
                });
            });
        }
        
        // Now reverse-engineer partnerships and convert to tournament format
        const engineeredScorecards = this.processIndividualScorecards(individualScores);
        
        // Add to raw scorecards
        for (const scorecard of engineeredScorecards) {
            this.rawScorecards.push(scorecard);
        }
        
        console.log(`✅ Reverse-engineered ${engineeredScorecards.length} tournament scorecards from ${sheetName}`);

        return engineeredScorecards.length;
    }

    /**
     * Reverse-engineer partnerships from individual player scorecards
     */
    reverseEngineerPartnerships(individualScores, sheetName) {
        const engineeredScorecards = [];
        const validationIssues = [];
        
        // Group by tournament, round, and table
        const groupedScores = new Map();
        
        for (const score of individualScores) {
            const key = `${score.Tournament}_${score.Year}_${score.Round}_${score.Table}`;
            if (!groupedScores.has(key)) {
                groupedScores.set(key, []);
            }
            groupedScores.get(key).push(score);
        }
        
        console.log(`🔧 Reverse-engineering partnerships for ${groupedScores.size} table instances...`);
        
        for (const [key, tableScores] of groupedScores) {
            try {
                // Each table should have exactly 4 players
                if (tableScores.length !== 4) {
                    validationIssues.push(`${key}: Expected 4 players, got ${tableScores.length}`);
                    continue;
                }
                
                // Sort players by name for consistent partnership assignment
                const sortedPlayers = tableScores.sort((a, b) => a.Player.localeCompare(b.Player));
                
                // Create partnerships: first two players vs last two players  
                const partnership1 = [sortedPlayers[0], sortedPlayers[1]];
                const partnership2 = [sortedPlayers[2], sortedPlayers[3]];
                
                // Calculate partnership tricks
                const p1Tricks = partnership1[0].Tricks_Won + partnership1[1].Tricks_Won;
                const p2Tricks = partnership2[0].Tricks_Won + partnership2[1].Tricks_Won;
                
                // Verify tricks sum to 13
                if (p1Tricks + p2Tricks !== 13) {
                    validationIssues.push(`${key}: Tricks sum to ${p1Tricks + p2Tricks}, expected 13`);
                }
                
                // Create scorecard entries for each partnership
                const [tournamentName, year, round, table] = key.split('_');
                const baseScore = tableScores[0]; // Use first player's data as template
                
                // Partnership 1 scorecard
                const scorecard1 = {
                    Tournament: baseScore.Tournament,
                    Year: baseScore.Year,
                    Round: baseScore.Round,
                    Trump_Suit: baseScore.Trump_Suit,
                    Player1: partnership1[0].Player,
                    Player2: partnership1[1].Player,
                    Tricks_Won: p1Tricks,
                    Opponent1: partnership2[0].Player,
                    Opponent2: partnership2[1].Player,
                    Opponent_Tricks: p2Tricks,
                    Source: 'reverse-engineered',
                    Table: baseScore.Table,
                    Date: baseScore.Date
                };
                
                // Partnership 2 scorecard
                const scorecard2 = {
                    Tournament: baseScore.Tournament,
                    Year: baseScore.Year,
                    Round: baseScore.Round,
                    Trump_Suit: baseScore.Trump_Suit,
                    Player1: partnership2[0].Player,
                    Player2: partnership2[1].Player,
                    Tricks_Won: p2Tricks,
                    Opponent1: partnership1[0].Player,
                    Opponent2: partnership1[1].Player,
                    Opponent_Tricks: p1Tricks,
                    Source: 'reverse-engineered',
                    Table: baseScore.Table,
                    Date: baseScore.Date
                };
                
                engineeredScorecards.push(scorecard1, scorecard2);
                
            } catch (error) {
                validationIssues.push(`${key}: ${error.message}`);
            }
        }
        
        if (validationIssues.length > 0) {
            console.warn(`⚠️  Partnership reverse-engineering issues in ${sheetName}:`, validationIssues.slice(0, 10));
        }
        
        console.log(`🔧 Successfully reverse-engineered ${engineeredScorecards.length} scorecards from ${individualScores.length} individual records`);
        
        // Debug: Log a few sample engineered scorecards
        if (engineeredScorecards.length > 0) {
            console.log(`🔍 Sample reverse-engineered scorecard:`, engineeredScorecards[0]);
        }
        
        return engineeredScorecards;
    }

    /**
     * Get trump suit for a given round (1-20)
     */
    getTrumpSuit(round) {
        const trumpSuits = ['Hearts', 'Diamonds', 'Spades', 'Clubs'];
        return trumpSuits[(round - 1) % 4];
    }

    /**
     * Parse CSV data into tournament format
     */
    parseCSVData(csvData) {
        const lines = csvData.trim().split('\n');
        const scorecards = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
            
            if (values.length >= 10) {
                scorecards.push({
                    Tournament: values[0],
                    Year: values[1],
                    Round: values[2],
                    Trump_Suit: values[3],
                    Player1: values[4],
                    Player2: values[5],
                    Tricks_Won: parseInt(values[6]),
                    Opponent1: values[7],
                    Opponent2: values[8],
                    Opponent_Tricks: parseInt(values[9]),
                    Source: 'csv'
                });
            }
        }
        
        return scorecards;
    }

    /**
     * Get canonical player ID from Players sheet lookup
     * This handles cases where tournament data might have "Stephen Blake" but Players sheet has "SteveBlake" ID
     */
    getCanonicalPlayerId(playerName) {
        if (!playerName) return playerName;
        
        const trimmedName = playerName.trim();
        
        // Debug logging for SteveBlake specifically
        if (trimmedName === 'SteveBlake') {
            console.log(`🔍 getCanonicalPlayerId("${trimmedName}") - EXACT STEVEBLAKE MATCH TEST`);
            console.log(`  Players lookup has SteveBlake: ${this.playersLookup.has('SteveBlake')}`);
            console.log(`  Players lookup has Steve: ${this.playersLookup.has('Steve')}`);
        }
        
        // First, try exact match with the Players sheet
        if (this.playersLookup.has(trimmedName)) {
            if (trimmedName === 'SteveBlake') {
                console.log(`🔍 getCanonicalPlayerId("${trimmedName}") -> EXACT MATCH FOUND: "${trimmedName}"`);
            }
            return trimmedName;
        }
        
        // If no exact match, try to find by full name match
        // Look for a player where the full name matches the input
        for (const [playerId, player] of this.playersLookup) {
            if (player.fullName === trimmedName) {
                return playerId;
            }
        }
        
        // Special handling for known problematic mappings
        // This ensures that "Stephen Blake", "Stephen", and "Steve Blake" all map to the correct player ID
        if (trimmedName === 'Stephen Blake' || trimmedName === 'Stephen' || trimmedName === 'Steve Blake') {
            // Look for SteveBlake player ID first
            if (this.playersLookup.has('SteveBlake')) {
                return 'SteveBlake';
            }
            // Look for a player with displayName "Steve Blake"
            for (const [playerId, player] of this.playersLookup) {
                if (player.displayName === 'Steve Blake') {
                    return playerId;
                }
            }
            // Look for a player with fullName "Stephen Blake"
            for (const [playerId, player] of this.playersLookup) {
                if (player.fullName === 'Stephen Blake') {
                    return playerId;
                }
            }
        }
        
        // If no full name match, try to find by first name (but be more careful)
        // ONLY do firstName matching for single word inputs, not full names
        const firstName = trimmedName.split(/\s+/)[0];
        const isFullName = trimmedName.includes(' ');
        
        // Only do firstName matching if the input is a single name, not a full name
        if (!isFullName) {
            // Look for a player where firstName matches
            let firstNameMatch = null;
            for (const [playerId, player] of this.playersLookup) {
                if (player.firstName === firstName) {
                    firstNameMatch = playerId;
                    break; // Prefer firstName matches over playerId matches
                }
            }
            
            if (firstNameMatch) {
                return firstNameMatch;
            }
        }
        
        // Finally, check if the playerId itself matches the firstName
        // But only if we haven't found a better match above
        for (const [playerId, player] of this.playersLookup) {
            if (playerId === firstName) {
                return playerId;
            }
        }
        
        const isSharedHand = /[\/+&]/.test(trimmedName);
        
        // If still no match and this isn't a shared hand, record the issue once
        if (!isSharedHand && this.playersLookup && this.playersLookup.size > 0) {
            if (!this.missingPlayerLog.has(trimmedName.toLowerCase())) {
                const issue = {
                    type: 'missing_player_id',
                    severity: 'error',
                    message: `Player ID "${trimmedName}" not found in Players sheet.`,
                    playerId: trimmedName,
                    sheet: 'Players'
                };
                console.warn(`⚠️ ${issue.message}`);
                this.dataIssues.push(issue);
                if (typeof window !== 'undefined') {
                    window.lastDataIssues = window.lastDataIssues || [];
                    window.lastDataIssues.push(issue);
                }
                this.missingPlayerLog.add(trimmedName.toLowerCase());
            }
        }

        if (trimmedName === 'SteveBlake') {
            console.log(`🔍 getCanonicalPlayerId("${trimmedName}") -> FINAL RESULT: "${trimmedName}"`);
        }
        return trimmedName;
    }

    /**
     * Get display name for a player or partnership
     * Uses DisplayName column from Players sheet for consistent display
     * @param {string} playerNameOrId - Player name, ID, or partnership string
     * @returns {string} Display name to show on the website
     */
    getDisplayName(playerNameOrId) {
        if (!playerNameOrId) return playerNameOrId;
        
        // Debug logging for Steve Blake issues
        if (playerNameOrId === 'SteveBlake' || playerNameOrId.includes('Steve')) {
            console.log(`🔍 getDisplayName("${playerNameOrId}")`);
        }
        
        // Handle shared hand partnerships (contains delimiters)
        const delimiters = ['+', '/', '&'];
        for (const delimiter of delimiters) {
            if (playerNameOrId.includes(delimiter)) {
                const players = playerNameOrId.split(delimiter).map(name => name.trim());
                const displayNames = players.map(player => this.getDisplayName(player));
                return displayNames.join('/');
            }
        }
        
        // Individual player lookup
        const canonicalId = this.getCanonicalPlayerId(playerNameOrId);
        let playerData = this.playersLookup.get(canonicalId);
        
        // Debug logging for Steve Blake lookup issue
        if (playerNameOrId.includes('Steve') || canonicalId.includes('Steve')) {
            console.log(`  canonicalId: "${canonicalId}"`);
            console.log(`  playerData found:`, playerData);
            if (playerData) {
                console.log(`  playerData.displayName: "${playerData.displayName}"`);
            }
        }
        
        // If no player data found with canonical ID, try alternative lookups
        if (!playerData) {
            // Try exact match with input
            playerData = this.playersLookup.get(playerNameOrId.trim());
            
            // If still no match, try finding by full name or firstName
            if (!playerData) {
                for (const [playerId, player] of this.playersLookup) {
                    if (player.fullName === playerNameOrId.trim() || 
                        player.firstName === playerNameOrId.trim()) {
                        playerData = player;
                        break;
                    }
                }
            }
            
            // Special case for Stephen/Steve Blake mapping
            if (!playerData && (playerNameOrId === 'Stephen' || playerNameOrId === 'Stephen Blake')) {
                for (const [playerId, player] of this.playersLookup) {
                    if (playerId === 'SteveBlake' || player.fullName === 'Stephen Blake') {
                        playerData = player;
                        break;
                    }
                }
            }
        }
        
        if (playerData && playerData.displayName) {
            if (playerNameOrId === 'SteveBlake' || playerNameOrId.includes('Steve')) {
                console.log(`  ✅ Found playerData, returning displayName: "${playerData.displayName}"`);
            }
            return playerData.displayName;
        }
        
        // Fallback to canonical ID if no display name found
        if (playerNameOrId === 'SteveBlake' || playerNameOrId.includes('Steve')) {
            console.log(`  ⚠️ No playerData found, returning canonicalId: "${canonicalId}"`);
        }
        return canonicalId;
    }

    /**
     * Get player's full display name for profile pages
     * Includes nickname if present: George "Grandad" Ruston
     */
    getPlayerFullName(playerId) {
        if (!playerId) return playerId;
        
        const playerData = this.playersLookup.get(playerId);
        if (playerData) {
            const firstName = playerData.firstName || '';
            const lastName = playerData.lastName || '';
            const nickname = playerData.nickname || '';
            
            if (nickname) {
                // Format: FirstName "Nickname" LastName
                return `${firstName} "${nickname}" ${lastName}`.trim();
            } else if (firstName || lastName) {
                // Format: FirstName LastName
                return `${firstName} ${lastName}`.trim();
            }
        }
        
        // Fallback to ID if no player data found
        return playerId;
    }

    /**
     * Get structured player name parts (first, last, nickname)
     */
    getPlayerNameParts(playerId) {
        if (!playerId) return null;
        const canonicalId = this.getCanonicalPlayerId ? this.getCanonicalPlayerId(playerId) : playerId;
        const playerData = this.playersLookup ? this.playersLookup.get(canonicalId) : null;
        if (!playerData) {
            return null;
        }
        return {
            firstName: playerData.firstName || '',
            lastName: playerData.lastName || '',
            nickname: playerData.nickname || '',
            displayName: playerData.displayName || '',
            canonicalId
        };
    }

    /**
     * Process individual scorecard data and create tournament structure
     */
    processIndividualScorecards(individualScores) {
        // Create sorting key: round_table_tricks_player
        const sortedScores = individualScores.map(score => ({
            ...score,
            sortKey: `${score.Round}_${score.Table}_${score.Tricks_Won}_${score.Player}`
        })).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
        
        const engineeredScorecards = [];
        
        // Debug: Log first few sorted entries to understand the data structure
        if (sortedScores.length > 0) {
            console.log(`🔍 First 8 sorted individual scores:`, sortedScores.slice(0, 8).map(s => 
                `R${s.Round}T${s.Table} ${s.Player}: ${s.Tricks_Won} tricks`
            ));
        }
        
        // Process in groups of 4 (each table)
        for (let i = 0; i < sortedScores.length; i += 4) {
            const tableGroup = sortedScores.slice(i, i + 4);
            const firstEntry = tableGroup[0];
            const sourceSheet = firstEntry?.SourceSheet || 'Scorecards';
            const roundNum = firstEntry?.Round ?? '?';
            const tableNum = firstEntry?.Table ?? '?';
            
            if (tableGroup.length !== 4) {
                const message = `Round ${roundNum}, Table ${tableNum}: Expected 4 player records, got ${tableGroup.length}`;
                console.error(`❌ ${message}`);
                this.dataIssues.push({
                    type: 'table_player_count_mismatch',
                    severity: 'error',
                    sheet: sourceSheet,
                    round: roundNum,
                    table: tableNum,
                    message,
                    players: tableGroup.map(p => p?.Player).filter(Boolean)
                });
                continue;
            }
            
            // Verify all 4 players are from same round/table
            const roundTable = `${firstEntry.Round}_${firstEntry.Table}`;
            if (!tableGroup.every(p => `${p.Round}_${p.Table}` === roundTable)) {
                const message = `Mixed round/table grouping detected: ${tableGroup.map(p => `${p.Round}_${p.Table}`).join(', ')}`;
                console.error(`❌ ${message}`);
                this.dataIssues.push({
                    type: 'table_player_count_mismatch',
                    severity: 'error',
                    sheet: sourceSheet,
                    round: roundNum,
                    table: tableNum,
                    message,
                    players: tableGroup.map(p => p?.Player).filter(Boolean)
                });
                continue;
            }
            
            // First 2 = Partnership 1, Next 2 = Partnership 2
            const partnership1 = tableGroup.slice(0, 2);
            const partnership2 = tableGroup.slice(2, 4);
            const baseData = tableGroup[0];

            // Propagate approval flag from any of the 4 individual rows
            const tableImbalanceOK = tableGroup.some(r =>
                String(r?.Imbalance_OK ?? '').trim().toUpperCase() === 'YES'
            );

            // Capture inconsistency notes at two levels:
            // - per-player: show only to the player whose row contained the note (scorecard view)
            // - table-level: useful for validation/reporting
            const tableInconsistencyNotes = tableGroup
                .map(r => (r?.Inconsistency || r?.inconsistency || r?.INCONSISTENCY || '').toString().trim())
                .filter(Boolean);
            const tableInconsistency = Array.from(new Set(tableInconsistencyNotes)).join(' | ');

            const inconsistencyByPlayer = {};
            for (const row of tableGroup) {
                const note = (row?.Inconsistency || row?.inconsistency || row?.INCONSISTENCY || '').toString().trim();
                if (!note) {
                    continue;
                }

                const rawPlayer = (row?.Player || '').toString();
                const parts = rawPlayer.split(/[\/+&]/).map(p => p.trim()).filter(Boolean);
                const ids = (parts.length > 0 ? parts : [rawPlayer.trim()])
                    .map(p => this.getCanonicalPlayerId(p))
                    .filter(Boolean);

                for (const id of ids) {
                    if (!inconsistencyByPlayer[id]) {
                        inconsistencyByPlayer[id] = note;
                    } else if (!inconsistencyByPlayer[id].includes(note)) {
                        inconsistencyByPlayer[id] = `${inconsistencyByPlayer[id]} | ${note}`;
                    }
                }
            }
            
            const p1Tricks = partnership1[0].Tricks_Won;
            const p2Tricks = partnership2[0].Tricks_Won;
            
            // Validate tricks sum to 13 (warn but do not skip data)
            if (p1Tricks + p2Tricks !== 13) {
                const mismatchMessage = `Round ${baseData.Round}, Table ${baseData.Table}: Tricks sum to ${p1Tricks + p2Tricks}, expected 13 (P1: ${p1Tricks}, P2: ${p2Tricks})`;
                console.warn(`⚠️  ${mismatchMessage}`);
                this.dataIssues.push({
                    type: 'reverse_engineer_trick_mismatch',
                    severity: 'warning',
                    sheet: baseData.SourceSheet || 'Scorecards',
                    round: baseData.Round,
                    table: baseData.Table,
                    message: mismatchMessage,
                    gameId: baseData.Id || baseData.Tournament
                });
            }
            
            // Create WhistGame structure
            const scorecard = {
                Tournament: baseData.Tournament,
                Year: baseData.Year,
                Round: baseData.Round,
                Trump_Suit: baseData.Trump_Suit,
                Player1: this.getCanonicalPlayerId(partnership1[0].Player),
                Player2: this.getCanonicalPlayerId(partnership1[1].Player),
                Tricks_Won: p1Tricks,
                Opponent1: this.getCanonicalPlayerId(partnership2[0].Player),
                Opponent2: this.getCanonicalPlayerId(partnership2[1].Player),
                Opponent_Tricks: p2Tricks,
                Source: 'reverse-engineered',
                Table: baseData.Table,
                Date: baseData.Date,
                TournamentId: baseData.TournamentId,
                Id: baseData.TournamentId,
                TournamentKey: baseData.TournamentId,
                    SourceSheet: baseData.SourceSheet || baseData.Source || 'Scorecards',
                    Tie_Break: baseData.Tie_Break !== undefined ? baseData.Tie_Break : null,
                    Imbalance_OK: tableImbalanceOK ? 'YES' : (baseData.Imbalance_OK || ''),
                    Inconsistency: tableInconsistency,
                    InconsistencyByPlayer: inconsistencyByPlayer
            };
            
            // Debug: Log first few created scorecards
            if (engineeredScorecards.length < 3) {
                console.log(`🔍 Created scorecard: ${scorecard.Player1}+${scorecard.Player2} (${scorecard.Tricks_Won}) vs ${scorecard.Opponent1}+${scorecard.Opponent2} (${scorecard.Opponent_Tricks})`);
            }
            
            engineeredScorecards.push(scorecard);
        }
        
        return engineeredScorecards;
    }

    /**
     * Group tournaments by key for processing
     */
    groupTournaments() {
        const groups = new Map();
        
        for (const scorecard of this.rawScorecards) {
            const key = `${scorecard.Tournament}_${scorecard.Year}`;
            
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            
            groups.get(key).push(scorecard);
        }
        
        return groups;
    }

    /**
     * Get trump suit for a given round (helper method)
     */
    getTrumpSuit(round) {
        // Trump suit rotation: Hearts, Diamonds, Spades, Clubs (repeating)
        const suitIndex = (round - 1) % 4;
        return this.trumpSuits[suitIndex];
    }

    /**
     * Process CSV scorecard data (legacy method for backwards compatibility)
     */
    async processScorecardCSV(csvData) {
        const lines = csvData.trim().split('\n');
        const headers = lines[0].split(',');
        
        console.log(`📋 Processing CSV with headers: ${headers.join(', ')}`);
        
        this.rawScorecards = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const scorecard = {};
            
            headers.forEach((header, index) => {
                scorecard[header.trim()] = values[index]?.trim();
            });
            
            // Skip empty rows
            if (!scorecard.Tournament || !scorecard.Year) {
                continue;
            }
            
            // For legacy data, parse shared players from names directly
            scorecard.Player1Names = this.parseSharedPlayersLegacy(scorecard.Player1);
            scorecard.Player2Names = this.parseSharedPlayersLegacy(scorecard.Player2);
            scorecard.Opponent1Names = this.parseSharedPlayersLegacy(scorecard.Opponent1);
            scorecard.Opponent2Names = this.parseSharedPlayersLegacy(scorecard.Opponent2);
            
            // Preserve hand sharing format when applicable
            scorecard.Player1Name = scorecard.Player1Names.isShared ? 
                scorecard.Player1Names.names.join(' + ') : scorecard.Player1Names.names[0];
            scorecard.Player2Name = scorecard.Player2Names.isShared ? 
                scorecard.Player2Names.names.join(' + ') : scorecard.Player2Names.names[0];
            scorecard.Opponent1Name = scorecard.Opponent1Names.isShared ? 
                scorecard.Opponent1Names.names.join(' + ') : scorecard.Opponent1Names.names[0];
            scorecard.Opponent2Name = scorecard.Opponent2Names.isShared ? 
                scorecard.Opponent2Names.names.join(' + ') : scorecard.Opponent2Names.names[0];
            
            // Validate scorecard data
            if (this.validateScorecard(scorecard)) {
                this.rawScorecards.push(scorecard);
            }
        }
        
        console.log(`✅ Processed ${this.rawScorecards.length} valid scorecards`);
        
        // Process the scorecards into tournament structure
        this.processRawScorecards();
        
        return this.rawScorecards.length;
    }

    /**
     * Parse shared players from a field that may contain multiple player IDs
     * Supports "+", "/", and "&" delimiters
     */
    parseSharedPlayers(playerField) {
        if (!playerField) {
            return { names: [''], isShared: false, playerIds: [''] };
        }
        
        // Check for shared hand delimiters
        const delimiters = ['+', '/', '&'];
        let foundDelimiter = null;
        
        for (const delimiter of delimiters) {
            if (playerField.includes(delimiter)) {
                foundDelimiter = delimiter;
                break;
            }
        }
        
        if (foundDelimiter) {
            // Split by the found delimiter and trim whitespace
            const playerIds = playerField.split(foundDelimiter).map(id => id.trim()).filter(id => id);
            const names = playerIds.map(id => this.getPlayerName(id));
            
            return {
                names: names,
                isShared: true,
                playerIds: playerIds,
                delimiter: foundDelimiter
            };
        } else {
            // Single player - still trim whitespace
            const playerId = playerField.trim();
            return {
                names: [this.getPlayerName(playerId)],
                isShared: false,
                playerIds: [playerId]
            };
        }
    }

    /**
     * Parse shared players for legacy data (names instead of IDs)
     */
    parseSharedPlayersLegacy(playerField) {
        if (!playerField) {
            return { names: [''], isShared: false, playerIds: [''] };
        }
        
        // Check for shared hand delimiters
        const delimiters = ['+', '/', '&'];
        let foundDelimiter = null;
        
        for (const delimiter of delimiters) {
            if (playerField.includes(delimiter)) {
                foundDelimiter = delimiter;
                break;
            }
        }
        
        if (foundDelimiter) {
            // Split by the found delimiter and trim whitespace
            const names = playerField.split(foundDelimiter).map(name => name.trim()).filter(name => name);
            
            return {
                names: names,
                isShared: true,
                playerIds: names, // For legacy, names are the IDs
                delimiter: foundDelimiter
            };
        } else {
            // Single player - still trim whitespace
            const name = playerField.trim();
            return {
                names: [name],
                isShared: false,
                playerIds: [name]
            };
        }
    }

    getCombinationKeyFromIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return null;
        return ids
            .map(id => (id || '').trim().toLowerCase())
            .filter(Boolean)
            .sort()
            .join('|');
    }

    getCombinationKeyFromPlayerName(playerName) {
        if (!playerName) return null;
        const delimiters = ['+', '/', '&'];
        let parts = [playerName];
        for (const delimiter of delimiters) {
            if (playerName.includes(delimiter)) {
                parts = playerName.split(delimiter);
                break;
            }
        }
        const canonicalParts = parts
            .map(name => this.getCanonicalPlayerId(name.trim()))
            .filter(Boolean)
            .map(id => id.toLowerCase());
        if (canonicalParts.length === 0) {
            return null;
        }
        canonicalParts.sort();
        return canonicalParts.join('|');
    }

    /**
     * Get player name from ID using lookup table
     */
    getPlayerName(playerId) {
        if (!playerId) return '';
        
        const trimmedId = playerId.trim();
        
        // If we have a players lookup table, use it
        if (this.playersLookup && this.playersLookup.size > 0) {
            const player = this.playersLookup.get(trimmedId);
            if (player) {
                return player.fullName;
            }
            
            const issue = {
                type: 'missing_player_id',
                severity: 'error',
                message: `Player ID "${trimmedId}" not found in Players sheet.`,
                playerId: trimmedId,
                sheet: 'Players'
            };
            console.warn(`⚠️ ${issue.message}`);
            this.dataIssues.push(issue);
            if (typeof window !== 'undefined') {
                window.lastDataIssues = window.lastDataIssues || [];
                window.lastDataIssues.push(issue);
            }
        }
        
        // If no players lookup, treat the ID as the name directly
        return trimmedId;
    }

    /**
     * Validate tournament scorecard entry (new format)
     */
    validateTournamentScorecard(scorecard, rowNumber = null, sheetName = null) {
        const required = ['Id', 'Tournament', 'Year', 'Round', 'Trump_Suit', 'Table', 'Player1', 'Player2', 'Tricks_Won', 'Opponent1', 'Opponent2', 'Opponent_Tricks'];
        
        const rowInfo = rowNumber ? ` (Row ${rowNumber}${sheetName ? ` in ${sheetName}` : ''})` : '';
        
        // Check all required fields exist
        for (const field of required) {
            if (!scorecard[field]) {
                throw new Error(`Missing required field '${field}'${rowInfo}`);
            }
        }
        
        // Validate trick counts
        const tricks = parseInt(scorecard.Tricks_Won);
        const opponentTricks = parseInt(scorecard.Opponent_Tricks);
        
        if (isNaN(tricks) || isNaN(opponentTricks)) {
            throw new Error(`Invalid trick counts - Tricks_Won: '${scorecard.Tricks_Won}', Opponent_Tricks: '${scorecard.Opponent_Tricks}'${rowInfo}`);
        }
        
        if (tricks < 0 || tricks > 13 || opponentTricks < 0 || opponentTricks > 13) {
            throw new Error(`Trick counts out of range (0-13) - Tricks_Won: ${tricks}, Opponent_Tricks: ${opponentTricks}${rowInfo}`);
        }
        
        // HISTORICAL DATA VALIDATION: Warn about trick count issues but don't block
        // Skip validation if Imbalance_OK is set to "YES"
        const imbalanceOK = scorecard.Imbalance_OK && scorecard.Imbalance_OK.toString().toUpperCase() === 'YES';

        if (tricks + opponentTricks !== 13 && !imbalanceOK) {
            const issueMessage = `Tricks don't add to 13! Tricks_Won (${tricks}) + Opponent_Tricks (${opponentTricks}) = ${tricks + opponentTricks}${rowInfo}`;
            console.warn(`⚠️  HISTORICAL DATA ISSUE: ${issueMessage}. This is preserved for historical accuracy.`);

            // Track this issue
            this.dataIssues.push({
                type: 'trick_count_mismatch',
                severity: 'warning',
                message: issueMessage,
                row: rowNumber,
                sheet: sheetName,
                expected: 13,
                actual: tricks + opponentTricks,
                gameId: scorecard.Id,
                round: this.parseNumericValue(scorecard.Round),
                table: this.parseNumericValue(scorecard.Table),
                tournament: scorecard.Tournament || scorecard.TournamentId || null,
                tournamentId: scorecard.TournamentId || null,
                year: this.parseNumericValue(scorecard.Year)
            });

            // Mark this scorecard as having a data issue for tracking
            scorecard.hasDataIssue = true;
            scorecard.dataIssue = `Tricks total ${tricks + opponentTricks} instead of 13`;
        }
        
        // Validate trump suit
        if (!this.trumpSuits.includes(scorecard.Trump_Suit)) {
            throw new Error(`Invalid trump suit '${scorecard.Trump_Suit}'. Must be one of: ${this.trumpSuits.join(', ')}${rowInfo}`);
        }
        
        // Validate table number
        const tableNum = parseInt(scorecard.Table);
        if (isNaN(tableNum) || tableNum < 1) {
            throw new Error(`Invalid table number '${scorecard.Table}'. Must be a positive integer${rowInfo}`);
        }
        
        // Validate player IDs exist in lookup
        const hasPlayerLookup = this.playersLookup && this.playersLookup.size > 0;
        const playerFields = ['Player1', 'Player2', 'Opponent1', 'Opponent2'];
        for (const field of playerFields) {
            const playerInfo = scorecard[`${field}Names`];
            if (!playerInfo || !playerInfo.playerIds) continue;
            
                for (const playerId of playerInfo.playerIds) {
                const trimmedId = (playerId || '').trim();
                if (!trimmedId) continue;
                
                if (hasPlayerLookup && !this.playersLookup.has(trimmedId)) {
                    const issueMessage = `Player ID "${trimmedId}" not found in Players sheet${rowInfo}.`;
                    console.error(`❌ ${issueMessage}`);
                    
                    this.dataIssues.push({
                        type: 'missing_player_id',
                        severity: 'error',
                        sheet: sheetName,
                        row: rowNumber,
                        playerId: trimmedId,
                        column: field,
                        message: issueMessage,
                        gameId: scorecard.Id
                    });
                }
            }
        }
        
        return true;
    }

    /**
     * Validate individual scorecard entry (legacy format)
     */
    validateScorecard(scorecard) {
        const required = ['Tournament', 'Year', 'Round', 'Trump_Suit', 'Table', 'Player1', 'Player2', 'Tricks_Won', 'Opponent1', 'Opponent2', 'Opponent_Tricks'];
        
        // Check all required fields exist
        for (const field of required) {
            if (!scorecard[field]) {
                console.warn(`Missing field ${field} in scorecard:`, scorecard);
                return false;
            }
        }
        
        // Validate trick counts
        const tricks = parseInt(scorecard.Tricks_Won);
        const opponentTricks = parseInt(scorecard.Opponent_Tricks);
        
        if (isNaN(tricks) || isNaN(opponentTricks)) {
            console.warn(`Invalid trick counts - Tricks_Won: '${scorecard.Tricks_Won}', Opponent_Tricks: '${scorecard.Opponent_Tricks}'`, scorecard);
            return false;
        }
        
        if (tricks < 0 || tricks > 13 || opponentTricks < 0 || opponentTricks > 13) {
            console.warn(`Trick counts out of range (0-13) - Tricks_Won: ${tricks}, Opponent_Tricks: ${opponentTricks}`, scorecard);
            return false;
        }
        
        // HISTORICAL DATA VALIDATION: Warn about trick count issues but don't block
        // Skip validation if Imbalance_OK is set to "YES"
        const imbalanceOK = scorecard.Imbalance_OK && scorecard.Imbalance_OK.toString().toUpperCase() === 'YES';

        if (tricks + opponentTricks !== 13 && !imbalanceOK) {
            const issueMessage = `Tricks don't add to 13! Tricks_Won (${tricks}) + Opponent_Tricks (${opponentTricks}) = ${tricks + opponentTricks}`;
            console.warn(`⚠️  HISTORICAL DATA ISSUE: ${issueMessage}. This is preserved for historical accuracy.`, scorecard);

            // Track this issue (legacy data doesn't have row/sheet info)
            this.dataIssues.push({
                type: 'trick_count_mismatch',
                severity: 'warning',
                message: issueMessage,
                expected: 13,
                actual: tricks + opponentTricks,
                scorecard: scorecard,
                round: this.parseNumericValue(scorecard.Round),
                table: this.parseNumericValue(scorecard.Table),
                tournament: scorecard.Tournament || null,
                tournamentId: scorecard.TournamentId || null,
                year: this.parseNumericValue(scorecard.Year)
            });

            // Mark this scorecard as having a data issue for tracking
            scorecard.hasDataIssue = true;
            scorecard.dataIssue = `Tricks total ${tricks + opponentTricks} instead of 13`;
        }
        
        // Validate trump suit
        if (!this.trumpSuits.includes(scorecard.Trump_Suit)) {
            console.warn(`Invalid trump suit:`, scorecard.Trump_Suit);
            return false;
        }
        
        // Validate table number
        const tableNum = parseInt(scorecard.Table);
        if (isNaN(tableNum) || tableNum < 1) {
            console.warn(`Invalid table number:`, scorecard.Table);
            return false;
        }
        
        if (this.playersLookup && this.playersLookup.size > 0) {
            const playerFields = ['Player1', 'Player2', 'Opponent1', 'Opponent2'];
            for (const field of playerFields) {
                const playerInfo = scorecard[`${field}Names`];
                if (!playerInfo || !playerInfo.playerIds) continue;
                
                for (const playerId of playerInfo.playerIds) {
                    const trimmedId = (playerId || '').trim();
                    if (!trimmedId) continue;
                    
                    if (!this.playersLookup.has(trimmedId)) {
                        const issueMessage = `Player ID "${trimmedId}" not found in Players sheet while processing legacy scorecard.`;
                        console.error(`❌ ${issueMessage}`);
                        this.dataIssues.push({
                            type: 'missing_player_id',
                            severity: 'error',
                            message: issueMessage,
                            playerId: trimmedId,
                            column: field,
                            sheet: scorecard.SourceSheet || 'Legacy Scorecards',
                            gameId: scorecard.Id || scorecard.Tournament
                        });
                    }
                }
            }
        }
        
        return true;
    }

    /**
     * Report summary of data issues found during processing
     */
    reportDataIssues() {
        if (this.dataIssues.length === 0) {
            console.log('✅ No data validation issues found');
            this.lastReportedDataIssues = [];
            return;
        }

        console.log(`\n📊 DATA VALIDATION SUMMARY`);
        console.log(`Found ${this.dataIssues.length} data issue(s):\n`);

        // Group issues by type
        const issuesByType = {};
        this.dataIssues.forEach(issue => {
            if (!issuesByType[issue.type]) {
                issuesByType[issue.type] = [];
            }
            issuesByType[issue.type].push(issue);
        });

        // Report each type
        Object.entries(issuesByType).forEach(([type, issues]) => {
            console.log(`${type.toUpperCase().replace('_', ' ')} (${issues.length} instances):`);
            issues.forEach((issue, index) => {
                let location = '';
                if (issue.row && issue.sheet) {
                    location = ` [${issue.sheet} Row ${issue.row}]`;
                } else if (issue.gameId) {
                    location = ` [Game ID: ${issue.gameId}]`;
                }
                
                console.log(`  ${index + 1}. ${issue.message}${location}`);
            });
            console.log('');
        });

        console.log(`⚠️  Note: Historical data issues are preserved for accuracy but flagged for reference.\n`);
        this.lastReportedDataIssues = [...this.dataIssues];
    }

    /**
     * Get data issues summary for external use
     */
    getDataIssues() {
        return {
            total: this.dataIssues.length,
            issues: this.dataIssues,
            summary: this.dataIssues.reduce((acc, issue) => {
                acc[issue.type] = (acc[issue.type] || 0) + 1;
                return acc;
            }, {})
        };
    }

    /**
     * Summarise trick imbalance issues (Tricks_Won + Opponent_Tricks !== 13)
     * @param {Object} filter - Optional filters (year, tournamentId)
     */
    getTrickImbalanceSummary(filter = {}) {
        const trickIssues = this.dataIssues.filter(issue => issue.type === 'trick_count_mismatch');
        if (trickIssues.length === 0) {
            return {
                totalIssues: 0,
                totalTables: 0,
                totalRounds: 0,
                details: []
            };
        }

        const { year, tournamentId } = filter;
        const filtered = trickIssues.filter(issue => {
            if (tournamentId && issue.tournamentId && issue.tournamentId !== tournamentId) {
                return false;
            }
            if (year && issue.year && issue.year !== year) {
                return false;
            }
            return true;
        });

        const tableMap = new Map();
        const roundSet = new Set();
        filtered.forEach(issue => {
            const roundLabel = typeof issue.round === 'number' ? issue.round : 'Unknown';
            const tableLabel = typeof issue.table === 'number' ? issue.table : 'Unknown';
            const tournamentLabel = issue.tournament || issue.tournamentId || (issue.year ? `Year ${issue.year}` : 'Tournament');
            const roundKey = `${tournamentLabel}::${roundLabel}`;
            const tableKey = `${roundKey}::${tableLabel}`;

            roundSet.add(roundKey);
            if (!tableMap.has(tableKey)) {
                tableMap.set(tableKey, {
                    tournament: tournamentLabel,
                    round: roundLabel,
                    table: tableLabel,
                    total: issue.actual,
                    message: issue.message
                });
            }
        });

        return {
            totalIssues: filtered.length,
            totalTables: tableMap.size,
            totalRounds: roundSet.size,
            details: Array.from(tableMap.values())
        };
    }

    getTournamentMetadata(tournamentId) {
        if (!tournamentId) return null;
        return this.tournamentMetadata.get(tournamentId) || null;
    }

    extractYearFromId(identifier) {
        if (!identifier) return null;
        const match = identifier.match(/(19|20)\d{2}/);
        return match ? parseInt(match[0], 10) : null;
    }

    applyTournamentMetadata(scorecard, sheetName, rowNumber) {
        const rawId = (scorecard.Id || '').toString().trim();
        if (!rawId) {
            this.dataIssues.push({
                type: 'missing_tournament_id',
                severity: 'error',
                sheet: sheetName,
                row: rowNumber,
                message: 'Scorecard row missing tournament Id'
            });
            return false;
        }
        
        const metadata = this.getTournamentMetadata(rawId);
        if (!metadata) {
            this.dataIssues.push({
                type: 'missing_tournament_metadata',
                severity: 'error',
                sheet: sheetName,
                row: rowNumber,
                message: `Tournament metadata not found for Id "${rawId}"`
            });
            return false;
        }
        
        scorecard.TournamentId = metadata.id;
        scorecard.TournamentKey = metadata.id;
        scorecard.Tournament = metadata.title || scorecard.Tournament || metadata.id;
        let year = metadata.year;
        if (!year || isNaN(year)) {
            year = this.extractYearFromId(metadata.id);
        }
        if (!year || isNaN(year)) {
            year = scorecard.Year ? parseInt(scorecard.Year, 10) : null;
        }
        scorecard.Year = year ? parseInt(year, 10) : null;
        scorecard.Date = metadata.date || scorecard.Date || null;
        scorecard.TournamentComments = metadata.comments || '';
        
        if (!scorecard.Year || isNaN(scorecard.Year)) {
            this.dataIssues.push({
                type: 'missing_tournament_year',
                severity: 'error',
                sheet: sheetName,
                row: rowNumber,
                message: `Year missing for tournament "${metadata.id}"`
            });
            return false;
        }
        
        return true;
    }

    /**
     * Process raw scorecards into structured tournament data
     */
    processRawScorecards() {
        // Group scorecards by tournament
        const tournamentGroups = this.groupScorecardsByTournament();
        
        // Process each tournament
        for (const [tournamentKey, scorecards] of tournamentGroups) {
            this.processTournament(tournamentKey, scorecards);
        }
        
        // Calculate player statistics
        this.calculatePlayerStatistics();
        
        // Calculate partnership statistics
        this.calculatePartnershipStatistics();
    }

    /**
     * Group scorecards by tournament and year
     */
    groupScorecardsByTournament() {
        const groups = new Map();
        
        for (const scorecard of this.rawScorecards) {
            const tournamentId = scorecard.TournamentId;
            
            if (!tournamentId) {
                this.dataIssues.push({
                    type: 'missing_tournament_id',
                    severity: 'error',
                    sheet: scorecard.SourceSheet || scorecard.sheetName || 'Unknown',
                    gameId: scorecard.Tournament || scorecard.Id || null,
                    message: 'Scorecard missing canonical TournamentId during grouping'
                });
                continue;
            }
            
            if (!groups.has(tournamentId)) {
                groups.set(tournamentId, []);
            }
            
            groups.get(tournamentId).push(scorecard);
        }
        
        return groups;
    }

    /**
     * Process individual tournament
     */
    processTournament(tournamentId, scorecards) {
        const firstScorecard = scorecards[0];
        const metadata = this.getTournamentMetadata(tournamentId);
        const fallbackName = firstScorecard?.Tournament || tournamentId;
        let tournamentName = metadata?.title || fallbackName;
        let tournamentYear = metadata?.year || (firstScorecard ? parseInt(firstScorecard.Year, 10) : this.extractYearFromId(tournamentId));
        const tournamentDate = metadata?.date || firstScorecard?.Date || null;
        const tournamentComments = metadata?.comments || firstScorecard?.TournamentComments || '';
        const canonicalTournamentId = metadata?.id || firstScorecard?.TournamentId || tournamentId;
        const storageKey = canonicalTournamentId;
        
        if (!tournamentYear || isNaN(tournamentYear)) {
            tournamentYear = this.extractYearFromId(tournamentId) || null;
        }
        
        // Group by rounds
        const rounds = new Map();
        
        for (const scorecard of scorecards) {
            const roundNum = parseInt(scorecard.Round);
            
            if (!rounds.has(roundNum)) {
                rounds.set(roundNum, []);
            }
            
            rounds.get(roundNum).push(scorecard);
        }
        
        // Process each round
        const processedRounds = [];
        const playerScores = new Map();
        
        for (const [roundNum, roundScorecards] of rounds) {
            const roundData = this.processRound(roundNum, roundScorecards);
            processedRounds.push(roundData);
            
            // Track cumulative scores
            this.updatePlayerScores(playerScores, roundData);
        }
        
        // Calculate final standings
        const finalStandings = this.calculateFinalStandings(playerScores);
        
        
        // Store tournament data
        const tournament = {
            id: canonicalTournamentId,
            key: storageKey,
            name: tournamentName,
            title: tournamentName,
            year: tournamentYear ? parseInt(tournamentYear, 10) : null,
            date: tournamentDate,
            comments: tournamentComments,
            rounds: processedRounds.sort((a, b) => a.round - b.round),
            final_standings: finalStandings,
            total_players: finalStandings.length,
            winner: finalStandings[0]?.player,
            runner_up: finalStandings[1]?.player,
            total_rounds: processedRounds.length
        };
        
        this.tournaments.set(storageKey, tournament);
        if (storageKey !== tournamentId) {
            this.tournaments.set(tournamentId, tournament);
        }
    }

    /**
     * Process individual round
     */
    processRound(roundNum, scorecards) {
        const tables = new Map();
        
        // Group scorecards by table number (from Table field)
        for (const scorecard of scorecards) {
            const tableNum = parseInt(scorecard.Table);
            
            if (!tables.has(tableNum)) {
                tables.set(tableNum, []);
            }
            
            tables.get(tableNum).push(scorecard);
        }
        
        // Process each table
        const processedTables = [];
        
        // Sort tables by table number
        const sortedTables = Array.from(tables.entries()).sort((a, b) => a[0] - b[0]);
        
        for (const [tableNum, tableCards] of sortedTables) {
            const partnerships = [];
            
            // Each scorecard represents one game with two partnerships
            // We need to create both partnerships from each scorecard row
            for (const card of tableCards) {
                const player1 = card.Player1Name || card.Player1;
                const player2 = card.Player2Name || card.Player2;
                const opponent1 = card.Opponent1Name || card.Opponent1;
                const opponent2 = card.Opponent2Name || card.Opponent2;
                const tricksWon = parseInt(card.Tricks_Won);
                const opponentTricks = parseInt(card.Opponent_Tricks || (13 - tricksWon));
                const trumpSuit = card.Trump_Suit; // Preserve trump suit for this specific partnership

                // Parse shared hands and convert to PlayerEntity structure
                // A partnership has 2 POSITIONS, each position can have 1+ players (shared hand)
                const p1Parsed = this.parseSharedHand(player1);
                const p2Parsed = this.parseSharedHand(player2);
                const o1Parsed = this.parseSharedHand(opponent1);
                const o2Parsed = this.parseSharedHand(opponent2);

                // Convert each position to canonical IDs (sorted)
                const partnershipA_pos1 = p1Parsed.players.map(name => this.getCanonicalPlayerId(name)).sort();
                const partnershipA_pos2 = p2Parsed.players.map(name => this.getCanonicalPlayerId(name)).sort();
                const partnershipB_pos1 = o1Parsed.players.map(name => this.getCanonicalPlayerId(name)).sort();
                const partnershipB_pos2 = o2Parsed.players.map(name => this.getCanonicalPlayerId(name)).sort();

                const inconsistencyNote = (card.Inconsistency || card.inconsistency || '').toString().trim();
                const inconsistencyByPlayer = card.InconsistencyByPlayer || card.inconsistencyByPlayer || null;

                // Partnership A: 2 positions
                partnerships.push({
                    position1: partnershipA_pos1,  // Array of canonical IDs
                    position2: partnershipA_pos2,  // Array of canonical IDs
                    tricks: tricksWon,
                    trump_suit: trumpSuit,
                    inconsistency: inconsistencyNote,
                    inconsistencyByPlayer: inconsistencyByPlayer
                });

                // Partnership B: 2 positions
                partnerships.push({
                    position1: partnershipB_pos1,  // Array of canonical IDs
                    position2: partnershipB_pos2,  // Array of canonical IDs
                    tricks: opponentTricks,
                    trump_suit: trumpSuit,
                    inconsistency: inconsistencyNote,
                    inconsistencyByPlayer: inconsistencyByPlayer
                });
            }
            
            const tableData = {
                table: tableNum,
                partnerships: partnerships
            };
            
            processedTables.push(tableData);
        }
        
        // For round-level trump suit, use the most common one (backwards compatibility)
        const trumpCounts = {};
        scorecards.forEach(card => {
            trumpCounts[card.Trump_Suit] = (trumpCounts[card.Trump_Suit] || 0) + 1;
        });
        const roundTrumpSuit = Object.keys(trumpCounts).reduce((a, b) => trumpCounts[a] > trumpCounts[b] ? a : b);
        
        return {
            round: roundNum,
            trump_suit: roundTrumpSuit, // Most common trump for round display
            tables: processedTables
        };
    }

    /**
     * Parse shared hands from player names containing "+", "/", or "&"
     * Returns { players: [array], isShared: boolean, displayName: string }
     */
    parseSharedHand(playerName) {
        const delimiters = ['+', '/', '&'];
        let foundDelimiter = null;
        
        for (const delimiter of delimiters) {
            if (playerName.includes(delimiter)) {
                foundDelimiter = delimiter;
                break;
            }
        }
        
        if (foundDelimiter) {
            const players = playerName.split(foundDelimiter).map(name => name.trim());
            // Convert to display names for consistent website display
            const displayNames = players.map(p => {
                const displayName = this.getDisplayName(p);
                // Debug logging for Steve Blake shared hand issue
                if (p === 'SteveBlake' || p.includes('Steve') || displayName.includes('Steve')) {
                    console.log(`🔍 parseSharedHand: "${p}" -> display name: "${displayName}"`);
                }
                return displayName;
            });
            // Always display with "/" using display names
            const displayName = displayNames.join('/');
            
            // Debug logging for shared hand output
            if (playerName.includes('Steve')) {
                console.log(`🔍 parseSharedHand result: "${playerName}" -> "${displayName}"`);
            }
            
            return { players, isShared: true, displayName };
        }
        return { players: [playerName], isShared: false, displayName: playerName };
    }

    /**
     * Update cumulative player scores with partnership support
     * Creates both partnership entries and individual player tracking
     */
    updatePlayerScores(playerScores, roundData) {
        for (const table of roundData.tables) {
            for (const partnership of table.partnerships) {
                // partnership now has: position1 (array), position2 (array), tricks
                // Each position represents one PlayerEntity - process them separately

                for (const position of [partnership.position1, partnership.position2]) {
                    const isShared = position.length > 1;

                    if (isShared) {
                        // This position is a shared hand (multiple people sharing one position)
                        const displayNames = position.map(id => this.getDisplayName(id));
                        const displayKey = displayNames.join('/');

                        const combinationKey = this.getCombinationKeyFromIds(position);
                        if (!playerScores.has(displayKey)) {
                            playerScores.set(displayKey, {
                                total_tricks: 0,
                                rounds_played: 0,
                                individual_tricks: 0,
                                individual_rounds: 0,
                                shared_tricks: 0,
                                shared_rounds: 0,
                                is_partnership: true,
                                partnership_players: [...position].sort(), // Canonical IDs, sorted
                                combination_key: combinationKey
                            });
                        }

                        const partnershipData = playerScores.get(displayKey);
                        if (!partnershipData.combination_key && combinationKey) {
                            partnershipData.combination_key = combinationKey;
                        }
                        partnershipData.shared_tricks += partnership.tricks;
                        partnershipData.shared_rounds += 1;
                        partnershipData.rounds_played += 1;

                        // Track individual participation for each person in the shared hand
                        for (const canonicalId of position) {
                            const individualKey = `__individual_${canonicalId}`;
                            if (!playerScores.has(individualKey)) {
                                playerScores.set(individualKey, {
                                    total_tricks: 0,
                                    rounds_played: 0,
                                    individual_tricks: 0,
                                    individual_rounds: 0,
                                    shared_tricks: 0,
                                    shared_rounds: 0,
                                    is_individual_tracker: true,
                                    actual_player_name: canonicalId
                                });
                            }

                            const individualData = playerScores.get(individualKey);
                            const splitTricks = partnership.tricks / position.length;
                            individualData.shared_tricks += splitTricks;
                            individualData.shared_rounds += 1;
                            individualData.rounds_played += 1;
                        }
                    } else {
                        // Single player in this position
                        const canonicalPlayerId = position[0];

                        if (!playerScores.has(canonicalPlayerId)) {
                            playerScores.set(canonicalPlayerId, {
                                total_tricks: 0,
                                rounds_played: 0,
                                individual_tricks: 0,
                                individual_rounds: 0,
                                shared_tricks: 0,
                                shared_rounds: 0,
                                combination_key: canonicalPlayerId.toLowerCase()
                            });
                        }

                        const playerData = playerScores.get(canonicalPlayerId);
                        if (!playerData.combination_key) {
                            playerData.combination_key = canonicalPlayerId.toLowerCase();
                        }
                        playerData.individual_tricks += partnership.tricks;
                        playerData.individual_rounds += 1;
                        playerData.rounds_played += 1;
                    }
                }
            }
        }
    }

    /**
     * Calculate final tournament standings
     * Only includes actual tournament entries (partnerships and individuals), not individual trackers
     */
    calculateFinalStandings(playerScores) {
        const standings = [];
        
        for (const [player, data] of playerScores) {
            // Skip individual tracker entries (these are for personal scorecards only)
            if (data.is_individual_tracker) {
                continue;
            }
            
            // Use combined tricks for tournament standings (individual + split shared)
            const combinedTricks = data.individual_tricks + data.shared_tricks;
            
            
            // Debug logging for Steve Blake case in final standings
            if (player.includes('Stephen') || player.includes('Steve') || player.includes('Blake')) {
                console.log(`🔍 calculateFinalStandings: Adding player "${player}" to final standings`);
                console.log(`  Combined tricks: ${combinedTricks}, Rounds played: ${data.rounds_played}`);
                console.log(`  Data source - individual_tricks: ${data.individual_tricks}, shared_tricks: ${data.shared_tricks}`);
            }
            
            const combinationKey = data.combination_key || this.getCombinationKeyFromPlayerName(player);
            const tieBreakValue = combinationKey ? this.tieBreakers.get(combinationKey) : undefined;
            
            standings.push({
                player: player,
                total_tricks: combinedTricks, // Combined total for rankings
                rounds_played: data.rounds_played,
                average_tricks: (combinedTricks / data.rounds_played).toFixed(2), // Average using combined tricks
                individual_tricks: data.individual_tricks || 0,
                shared_tricks: data.shared_tricks || 0,
                individual_rounds: data.individual_rounds || 0,
                shared_rounds: data.shared_rounds || 0,
                is_partnership: data.is_partnership || false,
                partnership_players: data.partnership_players || [player],
                tie_break: typeof tieBreakValue === 'number' ? tieBreakValue : null
            });
        }
        
        // Sort by combined tricks (descending) with tie-break support
        standings.sort((a, b) => {
            if (b.total_tricks !== a.total_tricks) {
                return b.total_tricks - a.total_tricks;
            }
            const tieA = typeof a.tie_break === 'number' ? a.tie_break : Number.POSITIVE_INFINITY;
            const tieB = typeof b.tie_break === 'number' ? b.tie_break : Number.POSITIVE_INFINITY;
            if (tieA !== tieB) {
                return tieA - tieB; // Lower tie-break value wins
            }
            return a.player.localeCompare(b.player);
        });
        
        // Add positions
        standings.forEach((standing, index) => {
            standing.position = index + 1;
        });
        
        return standings;
    }

    /**
     * Calculate comprehensive player statistics with shared hand support
     */
    calculatePlayerStatistics() {
        // This will calculate career stats across all tournaments
        for (const [tournamentKey, tournament] of this.tournaments) {
            const standings = Array.isArray(tournament.final_standings) ? tournament.final_standings : [];
            if (standings.length === 0) {
                continue;
            }

            const totalEntrants = standings.length;
            const fallbackPosition = totalEntrants || 1;
            const worstPosition = standings.reduce((max, entry) => {
                const entryPos = Number.isFinite(entry.position) ? entry.position : fallbackPosition;
                return Math.max(max, entryPos);
            }, fallbackPosition);

            for (const standing of standings) {
                const player = standing.player;
                const entryPosition = Number.isFinite(standing.position) ? standing.position : fallbackPosition;
                const isBoobyPlacement = totalEntrants > 0 && entryPosition >= worstPosition;
                
                // Check if this is a shared hand entry that needs individual player processing
                const isSharedHandEntry = standing.is_partnership && standing.partnership_players;
                
                if (isSharedHandEntry) {
                    // Create individual records for each player in the partnership
                    for (const individualPlayer of standing.partnership_players) {
                        if (!this.players.has(individualPlayer)) {
                            this.players.set(individualPlayer, {
                                name: individualPlayer,
                                // Combined stats (default display)
                                tournaments_played: 0,
                                total_tricks: 0, // Combined individual + shared
                                total_rounds: 0,
                                rounds_won: 0, // NEW: Count of rounds where player scored 7+ tricks
                                tournament_wins: 0,
                                top_three_finishes: 0,
                                // Individual stats (solo play only)
                                individual: {
                                    tournaments_played: 0,
                                    total_tricks: 0,
                                    total_rounds: 0,
                                    rounds_won: 0, // NEW: Individual rounds won
                                    tournament_wins: 0,
                                    top_three_finishes: 0
                                },
                                // Shared hand tracking
                                shared_rounds: 0,
                                shared_tricks: 0,
                                tournament_history: [],
                                booby_prizes: 0,
                                booby_percentage: 0
                            });
                        }
                        
                        const individualPlayerData = this.players.get(individualPlayer);
                        
                        // Combined stats (always updated for shared hands) - split equally among partners
                        const numPartners = Array.isArray(standing.partnership_players) ? standing.partnership_players.length : 2;
                        const splitTricks = standing.total_tricks / numPartners;
                        const splitRounds = standing.rounds_played / numPartners;
                        individualPlayerData.tournaments_played++;
                        individualPlayerData.total_tricks += splitTricks;
                        individualPlayerData.total_rounds += splitRounds;
                        individualPlayerData.shared_rounds += standing.shared_rounds || 0;
                        individualPlayerData.shared_tricks += (standing.shared_tricks || 0) / numPartners;
                        
                        if (entryPosition === 1) {
                            individualPlayerData.tournament_wins++;
                        }
                        if (entryPosition <= 3) {
                            individualPlayerData.top_three_finishes++;
                        }
                        if (isBoobyPlacement) {
                            individualPlayerData.booby_prizes = (individualPlayerData.booby_prizes || 0) + 1;
                        }
                        
                        individualPlayerData.tournament_history.push({
                            tournament: tournament.name,
                            year: tournament.year,
                            position: entryPosition,
                            tricks: splitTricks,
                            individual_tricks: 0,
                            shared_tricks: (standing.shared_tricks || 0) / numPartners,
                            has_shared_rounds: true,
                            partnership_name: standing.player
                        });
                    }
                } else {
                    // Handle regular individual entries
                    if (!this.players.has(player)) {
                        this.players.set(player, {
                            name: player,
                            // Combined stats (default display)
                            tournaments_played: 0,
                            total_tricks: 0, // Combined individual + shared
                            total_rounds: 0,
                            rounds_won: 0, // NEW: Count of rounds where player scored 7+ tricks
                            tournament_wins: 0,
                            top_three_finishes: 0,
                            // Individual stats (solo play only)
                            individual: {
                                tournaments_played: 0,
                                total_tricks: 0,
                                total_rounds: 0,
                                rounds_won: 0, // NEW: Individual rounds won
                                tournament_wins: 0,
                                top_three_finishes: 0
                            },
                            // Shared hand tracking
                            shared_rounds: 0,
                            shared_tricks: 0,
                            tournament_history: [],
                            booby_prizes: 0,
                            booby_percentage: 0
                        });
                    }
                    
                    const playerData = this.players.get(player);
                    const hasSharedRounds = standing.shared_rounds > 0;
                    
                    // Combined stats (always updated)
                    playerData.tournaments_played++;
                    playerData.total_tricks += standing.total_tricks; // Combined total
                    playerData.total_rounds += standing.rounds_played;
                    playerData.shared_rounds += standing.shared_rounds || 0;
                    playerData.shared_tricks += standing.shared_tricks || 0;
                    
                    if (entryPosition === 1) {
                        playerData.tournament_wins++;
                    }
                    if (entryPosition <= 3) {
                        playerData.top_three_finishes++;
                    }
                    if (isBoobyPlacement) {
                        playerData.booby_prizes = (playerData.booby_prizes || 0) + 1;
                    }
                    
                    // Individual stats (only if no shared rounds in this tournament)
                    if (!hasSharedRounds) {
                        playerData.individual.tournaments_played++;
                        playerData.individual.total_tricks += standing.individual_tricks || standing.total_tricks;
                        playerData.individual.total_rounds += standing.individual_rounds || standing.rounds_played;
                        
                        if (entryPosition === 1) {
                            playerData.individual.tournament_wins++;
                        }
                        if (entryPosition <= 3) {
                            playerData.individual.top_three_finishes++;
                        }
                    }
                    
                    playerData.tournament_history.push({
                        tournament: tournament.name,
                        year: tournament.year,
                        position: entryPosition,
                        tricks: standing.total_tricks,
                        individual_tricks: standing.individual_tricks || 0,
                        shared_tricks: standing.shared_tricks || 0,
                        has_shared_rounds: hasSharedRounds
                    });
                }
            }
        }
        
        // Calculate averages and rounds won for both combined and individual stats
        for (const [player, data] of this.players) {
            data.average_tricks = data.total_rounds > 0 ? (data.total_tricks / data.total_rounds).toFixed(2) : 0;
            data.individual.average_tricks = data.individual.total_rounds > 0 ? 
                (data.individual.total_tricks / data.individual.total_rounds).toFixed(2) : 0;

            data.booby_prizes = data.booby_prizes || 0;
            const boobyPct = data.tournaments_played > 0 ? (data.booby_prizes / data.tournaments_played) * 100 : 0;
            data.booby_percentage = parseFloat(boobyPct.toFixed(1));
            
            // Calculate rounds won (where player scored 7+ tricks)
            data.rounds_won = 0;
            data.individual.rounds_won = 0;
            
            // Go through tournament history to count rounds won
            for (const tournamentHistory of data.tournament_history) {
                // Check all tournaments this player participated in
                const tournament = Array.from(this.tournaments.values())
                    .find(t => t.name === tournamentHistory.tournament && t.year === tournamentHistory.year);
                
                if (tournament) {
                    // Count rounds where this player scored 7+ tricks
                    for (const round of tournament.rounds) {
                        for (const table of round.tables) {
                            for (const partnership of table.partnerships) {
                                // partnership now has position1 and position2 arrays
                                const allPartnershipPlayers = [...partnership.position1, ...partnership.position2];
                                const pos1IsShared = partnership.position1.length > 1;
                                const pos2IsShared = partnership.position2.length > 1;
                                const hasSharedHand = pos1IsShared || pos2IsShared;

                                // Determine if this player participated and their share factor
                                let playerParticipated = false;
                                let playerShareFactor = 1;
                                let playerSharedPosition = false;

                                if (partnership.position1.some(id => id.toLowerCase() === player.toLowerCase())) {
                                    playerParticipated = true;
                                    playerShareFactor = partnership.position1.length || 1;
                                    playerSharedPosition = partnership.position1.length > 1;
                                } else if (partnership.position2.some(id => id.toLowerCase() === player.toLowerCase())) {
                                    playerParticipated = true;
                                    playerShareFactor = partnership.position2.length || 1;
                                    playerSharedPosition = partnership.position2.length > 1;
                                }

                                // If player participated and scored 7+ tricks, count as round won (fractionally for shared hands)
                                if (playerParticipated && partnership.tricks >= 7) {
                                    const roundCredit = 1 / playerShareFactor;
                                    data.rounds_won += roundCredit;

                                    // Count towards individual stats only if this player's position was not shared
                                    if (!playerSharedPosition) {
                                        data.individual.rounds_won++;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Get individual player data from a tournament (for personal scorecards)
     * This looks for both direct entries and partnership participation
     */
    getIndividualPlayerData(tournament, playerName) {
        // First check if they have a direct entry
        let playerStanding = tournament.final_standings.find(
            standing => standing.player.toLowerCase() === playerName.toLowerCase()
        );
        
        if (playerStanding) {
            return playerStanding;
        }
        
        // Check if they're part of a partnership
        for (const standing of tournament.final_standings) {
            if (standing.is_partnership && standing.partnership_players) {
                const partnershipMatch = standing.partnership_players.find(
                    partner => partner.toLowerCase() === playerName.toLowerCase()
                );
                if (partnershipMatch) {
                    // Create individual data based on partnership performance
                    return {
                        player: playerName,
                        total_tricks: standing.total_tricks, // Full partnership tricks for display
                        rounds_played: standing.rounds_played,
                        average_tricks: standing.average_tricks,
                        individual_tricks: 0,
                        shared_tricks: standing.shared_tricks,
                        individual_rounds: 0,
                        shared_rounds: standing.shared_rounds,
                        position: standing.position,
                        is_partnership_member: true,
                        partnership_name: standing.player,
                        partnership_players: standing.partnership_players
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Get player statistics with option for individual vs combined
     */
    getPlayerStats(playerName, includeSharedHands = true) {
        const player = this.players.get(playerName);
        if (!player) return null;
        
        if (includeSharedHands) {
            // Return combined stats (default)
            return {
                name: player.name,
                tournaments_played: player.tournaments_played,
                total_tricks: player.total_tricks,
                total_rounds: player.total_rounds,
                average_tricks: player.average_tricks,
                tournament_wins: player.tournament_wins,
                top_three_finishes: player.top_three_finishes,
                shared_rounds: player.shared_rounds,
                shared_tricks: player.shared_tricks,
                win_percentage: player.tournaments_played > 0 ? 
                    ((player.tournament_wins / player.tournaments_played) * 100).toFixed(1) : 0,
                booby_prizes: player.booby_prizes || 0,
                booby_percentage: typeof player.booby_percentage === 'number' ? player.booby_percentage : 0,
                stat_type: 'combined'
            };
        } else {
            // Return individual-only stats
            return {
                name: player.name,
                tournaments_played: player.individual.tournaments_played,
                total_tricks: player.individual.total_tricks,
                total_rounds: player.individual.total_rounds,
                average_tricks: player.individual.average_tricks,
                tournament_wins: player.individual.tournament_wins,
                top_three_finishes: player.individual.top_three_finishes,
                win_percentage: player.individual.tournaments_played > 0 ? 
                    ((player.individual.tournament_wins / player.individual.tournaments_played) * 100).toFixed(1) : 0,
                stat_type: 'individual'
            };
        }
    }

    /**
     * OFFICIAL SEED RANKING SYSTEM
     * 
     * Tennis-style weighted points system that emphasizes recent performance
     * while rewarding consistency and historical achievement.
     * 
     * ALGORITHM OVERVIEW:
     * ===================
     * 
     * 1. BASE TOURNAMENT POINTS:
     *    - 1st Place: 500 points    - 5th Place: 80 points     - 13th+ Place: 10 points
     *    - 2nd Place: 300 points    - 6th-8th: 50 points      - Participation: 5 points
     *    - 3rd Place: 200 points    - 9th-12th: 25 points
     *    - 4th Place: 120 points
     * 
     * 2. RECENCY WEIGHTING (Last 6 tournaments system):
     *    - Most recent tournament: 100% weight    - 5th most recent: 20% weight
     *    - 2nd most recent: 80% weight            - 6th most recent: 10% weight  
     *    - 3rd most recent: 60% weight            - 7+ tournaments ago: 5% weight
     *    - 4th most recent: 40% weight
     * 
     * 3. BONUS MULTIPLIERS:
     *    - Championship Bonus: +25% for 1st place finishes
     *    - Podium Bonus: +15% for top-3 finishes
     *    - Legacy Bonus: +10% if player has any historical wins (maintains relevance)
     * 
     * 4. CONSISTENCY FACTOR:
     *    - Minimum 3 of the last 6 tournaments for full ranking
     *    - Players with <3 tournaments get 50% penalty
     *    - Average performance bonus: +10% if avg finish is top-6
     * 
     * 5. FINAL CALCULATION:
     *    Total Points = Σ(Base Points × Recency Weight × Bonuses) + Consistency Adjustments
     * 
     * This system ensures:
     * - Recent performance carries most weight (like ATP rankings)
     * - Historical champions maintain some standing
     * - Consistent participation is rewarded
     * - True current form determines seedings
     */
    getOfficialSeedRankings(includeSharedHands = true) {
        const rankings = [];
        
        console.log('\n🏆 === OFFICIAL SEED RANKING CALCULATION ===');
        console.log(`📊 Total players in system: ${this.players.size}`);
        
        // Get all tournaments sorted by year (most recent first)
        const allTournaments = Array.from(this.tournaments.entries())
            .map(([key, tournament]) => ({ key, ...tournament }))
            .sort((a, b) => b.year - a.year);
        
        console.log(`🏟️ Tournament order (most recent first): ${allTournaments.map(t => `${t.name} (${t.year})`).join(', ')}`);
        
        // Base points for finishing positions
        const positionPoints = {
            1: 500, 2: 300, 3: 200, 4: 120, 5: 80,
            6: 50, 7: 50, 8: 50, 9: 25, 10: 25, 11: 25, 12: 25
        };
        
        // Recency weight factors (last 6 tournaments system)
        const getRecencyWeight = (tournamentPosition) => {
            if (tournamentPosition === 0) return 1.00;      // Most recent tournament
            if (tournamentPosition === 1) return 0.80;      // 2nd most recent
            if (tournamentPosition === 2) return 0.60;      // 3rd most recent
            if (tournamentPosition === 3) return 0.40;      // 4th most recent
            if (tournamentPosition === 4) return 0.20;      // 5th most recent
            if (tournamentPosition === 5) return 0.10;      // 6th most recent
            return 0.05;                                     // 7+ tournaments ago (minimal legacy weight)
        };
        
        // Helper function to check if a player name represents a shared hand
        const isSharedHandEntry = (playerName) => {
            return playerName.includes('/') || playerName.includes('&') || playerName.includes('+');
        };
        
        let processedCount = 0;
        
        for (const [playerName, playerData] of this.players) {
            // Skip shared hand entries from rankings (e.g., "Paul & Marci", "Paul/Marci")
            // Individual players get credit for shared hand performances via tournament data
            if (isSharedHandEntry(playerName)) {
                console.log(`⏭️ Skipping shared hand entry: "${playerName}"`);
                continue;
            }
            
            processedCount++;
            console.log(`\n👤 === PLAYER ${processedCount}: ${playerName} ===`);
            
            const stats = this.getPlayerStats(playerName, includeSharedHands);
            if (!stats) {
                console.log(`❌ No stats found for ${playerName}`);
                continue;
            }
            
            console.log(`📈 Basic Stats: ${stats.tournaments_played} tournaments, ${stats.total_tricks} tricks, ${stats.average_tricks} avg`);
            
            let totalPoints = 0;
            let tournamentsInPeriod = 0;
            let championshipCount = 0;
            let podiumCount = 0;
            let totalFinishSum = 0;
            let finishCount = 0;
            let hasHistoricalWin = false;
            
            console.log(`🔍 Checking tournament performance:`);
            
            // Calculate points from each tournament based on position in chronological order
            allTournaments.forEach((tournament, tournamentIndex) => {
                const recencyWeight = getRecencyWeight(tournamentIndex);
                
                // Get player's position in this tournament
                const playerTournamentData = this.getIndividualPlayerData(tournament, playerName);
                if (!playerTournamentData) {
                    console.log(`   ${tournament.year} ${tournament.name}: Not participated`);
                    return;
                }
                
                const position = playerTournamentData.position;
                const participantCount = tournament.final_standings ? tournament.final_standings.length : 20;
                
                // Base points for this tournament
                let basePoints = positionPoints[position] || 10; // Default 10 for positions 13+
                if (position > 12) basePoints = 10;
                if (!position) basePoints = 5; // Participation points if no position data
                
                // Apply recency weighting
                let tournamentPoints = basePoints * recencyWeight;
                
                // Track bonuses to apply
                let bonusesApplied = [];
                
                // Track statistics for bonuses
                if (tournamentIndex <= 5) tournamentsInPeriod++; // Count tournaments in last 6 tournaments
                if (position === 1) {
                    championshipCount++;
                    hasHistoricalWin = true;
                    tournamentPoints *= 1.25; // Championship bonus
                    bonusesApplied.push('Championship +25%');
                }
                if (position <= 3) {
                    podiumCount++;
                    tournamentPoints *= 1.15; // Podium bonus
                    bonusesApplied.push('Podium +15%');
                }
                if (position) {
                    totalFinishSum += position;
                    finishCount++;
                }
                
                console.log(`   ${tournament.year} ${tournament.name}: Pos ${position} → ${basePoints} base × ${recencyWeight} recency = ${(basePoints * recencyWeight).toFixed(1)} → ${bonusesApplied.length > 0 ? bonusesApplied.join(', ') + ' → ' : ''}${tournamentPoints.toFixed(1)} points ${playerTournamentData.is_partnership_member ? '(shared hand)' : ''}`);
                
                totalPoints += tournamentPoints;
            });
            
            console.log(`📊 Tournament Points Subtotal: ${totalPoints.toFixed(1)}`);
            console.log(`🎯 Tournaments in last 6: ${tournamentsInPeriod} (need 3+ for full ranking)`);
            
            // Apply consistency factor
            if (tournamentsInPeriod < 3) {
                console.log(`⚠️ Consistency Penalty: <3 tournaments in last 6 → ×0.5 penalty`);
                totalPoints *= 0.5; // Penalty for infrequent participation
            }
            
            // Average finish bonus (if avg finish is top 6)
            if (finishCount > 0) {
                const avgFinish = totalFinishSum / finishCount;
                console.log(`📊 Average Finish: ${avgFinish.toFixed(1)}`);
                if (avgFinish <= 6) {
                    console.log(`🎯 Consistency Bonus: Avg finish ≤6 → ×1.10 bonus`);
                    totalPoints *= 1.10; // Consistency bonus
                }
            }
            
            // Legacy bonus for historical winners
            if (hasHistoricalWin) {
                console.log(`👑 Legacy Bonus: Has championship(s) → ×1.10 bonus`);
                totalPoints *= 1.10; // Legacy bonus
            }
            
            console.log(`🏆 FINAL SEED POINTS: ${Math.round(totalPoints)}`);
            
            // Create ranking entry
            const ranking = {
                ...stats,
                seed_points: Math.round(totalPoints),
                tournaments_in_period: tournamentsInPeriod,
                championships: championshipCount,
                podium_finishes: podiumCount,
                avg_finish: finishCount > 0 ? (totalFinishSum / finishCount).toFixed(1) : 'N/A',
                has_legacy: hasHistoricalWin
            };
            
            rankings.push(ranking);
        }
        
        // Sort by seed points (highest first)
        rankings.sort((a, b) => b.seed_points - a.seed_points);
        
        // Add ranking positions
        rankings.forEach((player, index) => {
            player.seed_rank = index + 1;
        });
        
        return rankings;
    }

    /**
     * Get all players ranked by combined stats (Legacy method)
     */
    getPlayerRankings(includeSharedHands = true) {
        const rankings = [];
        
        for (const [playerName, playerData] of this.players) {
            const stats = this.getPlayerStats(playerName, includeSharedHands);
            if (stats) {
                rankings.push(stats);
            }
        }
        
        // Sort by tournament wins, then by total tricks
        rankings.sort((a, b) => {
            if (b.tournament_wins !== a.tournament_wins) {
                return b.tournament_wins - a.tournament_wins;
            }
            return b.total_tricks - a.total_tricks;
        });
        
        // Add ranking positions
        rankings.forEach((player, index) => {
            player.rank = index + 1;
        });
        
        return rankings;
    }

    /**
     * Check if a player has any shared hand history
     */
    playerHasSharedHands(playerName) {
        const player = this.players.get(playerName);
        return player ? player.shared_rounds > 0 : false;
    }

    /**
     * Calculate partnership statistics with shared hand awareness
     */
    calculatePartnershipStatistics() {
        // Analyze partnership combinations and success rates
        for (const [tournamentKey, tournament] of this.tournaments) {
            for (const round of tournament.rounds) {
                for (const table of round.tables) {
                    for (const partnership of table.partnerships) {
                        // Skip shared hand partnerships - only track normal 2-player partnerships
                        const pos1IsShared = partnership.position1.length > 1;
                        const pos2IsShared = partnership.position2.length > 1;
                        if (pos1IsShared || pos2IsShared) continue;

                        // Normal partnership: get the 2 player IDs
                        const players = [partnership.position1[0], partnership.position2[0]].sort();
                        const partnershipKey = players.join('_');

                        if (!this.partnerships.has(partnershipKey)) {
                            this.partnerships.set(partnershipKey, {
                                players: players,
                                times_partnered: 0,
                                total_tricks: 0,
                                rounds_played: 0
                            });
                        }

                        const partnershipData = this.partnerships.get(partnershipKey);
                        partnershipData.times_partnered++;
                        partnershipData.total_tricks += partnership.tricks;
                        partnershipData.rounds_played++;
                    }
                }
            }
        }
    }

    /**
     * Get tournament data by key
     */
    getTournament(tournamentKey) {
        if (!tournamentKey) return null;
        return this.tournaments.get(tournamentKey) || this.tournaments.get(tournamentKey.toLowerCase()) || null;
    }

    /**
     * Get all tournaments
     */
    getAllTournaments() {
        return Array.from(this.tournaments.values()).sort((a, b) => b.year - a.year);
    }

    /**
     * Get player data
     */
    getPlayer(playerName) {
        return this.players.get(playerName);
    }

    /**
     * Get all players sorted by performance
     */
    getAllPlayers(sortBy = 'total_tricks') {
        const players = Array.from(this.players.values());
        
        switch (sortBy) {
            case 'tournament_wins':
                return players.sort((a, b) => b.tournament_wins - a.tournament_wins);
            case 'win_percentage':
                return players.sort((a, b) => {
                    const aWinPct = (a.total_tricks / a.total_rounds) * 100;
                    const bWinPct = (b.total_tricks / b.total_rounds) * 100;
                    return bWinPct - aWinPct;
                });
            default:
                return players.sort((a, b) => b.total_tricks - a.total_tricks);
        }
    }

    /**
     * Get partnership analysis
     */
    getPartnershipAnalysis() {
        return Array.from(this.partnerships.values())
            .sort((a, b) => (b.total_tricks / b.rounds_played) - (a.total_tricks / a.rounds_played));
    }

    /**
     * Export processed data as JSON
     */
    exportToJSON() {
        return {
            tournaments: Object.fromEntries(this.tournaments),
            players: Object.fromEntries(this.players),
            partnerships: Object.fromEntries(this.partnerships),
            generated_at: new Date().toISOString()
        };
    }

    /**
     * Create sample CSV data with shared hands for testing
     */
    generateSampleSharedHandCSV() {
        const csvData = `Tournament,Year,Round,Trump_Suit,Player1,Player2,Tricks_Won,Opponent1,Opponent2,Opponent_Tricks
Christmas,2023,1,Hearts,James Ruston,Margaret Wilson,8,David Smith+Sarah Brown,Emma Jones,5
Christmas,2023,1,Hearts,David Smith+Sarah Brown,Emma Jones,5,James Ruston,Margaret Wilson,8
Christmas,2023,2,Diamonds,James Ruston,Emma Jones,7,Margaret Wilson,David Smith+Sarah Brown,6
Christmas,2023,2,Diamonds,Margaret Wilson,David Smith+Sarah Brown,6,James Ruston,Emma Jones,7`;
        
        return csvData;
    }

    /**
     * Test shared hand parsing with sample data
     */
    testSharedHands() {
        console.log('🧪 Testing Shared Hand System...');
        
        // Test the parsing function
        const testCases = [
            'James Ruston',
            'David Smith+Sarah Brown',
            'Tom Wilson + Jane Smith',
            'Player A+Player B+Player C'
        ];
        
        testCases.forEach(playerName => {
            const result = this.parseSharedHand(playerName);
            console.log(`Input: "${playerName}" -> Players: [${result.players.join(', ')}], Shared: ${result.isShared}`);
        });
        
        // Process sample data
        const sampleCSV = this.generateSampleSharedHandCSV();
        console.log('\n📄 Sample CSV with shared hands:');
        console.log(sampleCSV);
        
        // Process the sample data
        this.processScorecardCSV(sampleCSV).then(recordCount => {
            console.log(`\n✅ Processed ${recordCount} scorecard records`);
            
            // Show player stats
            console.log('\n👥 Player Statistics:');
            for (const [playerName, playerData] of this.players) {
                const combinedStats = this.getPlayerStats(playerName, true);
                const individualStats = this.getPlayerStats(playerName, false);
                const hasShared = this.playerHasSharedHands(playerName);
                
                console.log(`\n${playerName}:`);
                console.log(`  Combined: ${combinedStats.total_tricks} tricks, ${combinedStats.average_tricks} avg`);
                console.log(`  Individual: ${individualStats.total_tricks} tricks, ${individualStats.average_tricks} avg`);
                console.log(`  Has shared hands: ${hasShared}`);
                if (hasShared) {
                    console.log(`  Shared rounds: ${combinedStats.shared_rounds}, Shared tricks: ${combinedStats.shared_tricks}`);
                }
            }
        });
        
        return true;
    }

    // =========================
    // Player Statistics Methods (Designed for Caching)
    // =========================

    /**
     * Calculate total victories for a player
     * @param {string} playerName - Name of the player
     * @returns {number} Number of tournament victories
     */
    getPlayerVictoryCount(playerName) {
        return Array.from(this.tournaments.values())
            .filter(tournament => tournament.winner === playerName)
            .length;
    }

    /**
     * Calculate top 3 finishes for a player
     * @param {string} playerName - Name of the player
     * @returns {number} Number of top 3 finishes
     */
    getPlayerTop3Count(playerName) {
        return Array.from(this.tournaments.values())
            .filter(tournament => {
                // Check individual ranking
                const individualRank = tournament.final_standings.findIndex(s => s.player === playerName) + 1;
                if (individualRank > 0 && individualRank <= 3) {
                    return true;
                }
                // Check shared-hand partnership ranking
                const sharedRank = tournament.final_standings.findIndex(s => 
                    s.is_partnership &&
                    s.partnership_players &&
                    s.partnership_players.some(p => p === playerName)
                ) + 1;
                return sharedRank > 0 && sharedRank <= 3;
            })
            .length;
    }

    /**
     * Calculate win rate for a player
     * @param {string} playerName - Name of the player
     * @returns {number} Win rate as percentage
     */
    getPlayerWinRate(playerName) {
        const player = this.players.get(playerName);
        if (!player || player.tournaments_played === 0) return 0;
        
        const victories = this.getPlayerVictoryCount(playerName);
        return (victories / player.tournaments_played) * 100;
    }

    /**
     * Get player's total tricks in a specific tournament
     * @param {string} playerName - Name of the player
     * @param {Object} tournament - Tournament object
     * @returns {number} Total tricks scored in that tournament
     */
    getPlayerTricksInTournament(playerName, tournament) {
        // First check for individual standing
        const playerStanding = tournament.final_standings.find(s => s.player === playerName);
        if (playerStanding) {
            return playerStanding.total_tricks;
        }
        
        // If not found individually, check shared hand partnerships
        const sharedHandEntry = tournament.final_standings.find(s => 
            s.is_partnership && 
            s.partnership_players && 
            s.partnership_players.some(p => p === playerName)
        );
        
        if (sharedHandEntry) {
            // For shared hands, split equally among number of partners
            const numPartners = Array.isArray(sharedHandEntry.partnership_players) ? sharedHandEntry.partnership_players.length : 2;
            return sharedHandEntry.total_tricks / numPartners;
        }
        
        return 0;
    }

    /**
     * Get actual number of rounds played in a tournament
     * @param {Object} tournament - Tournament object
     * @returns {number} Number of rounds actually played
     */
    getTournamentRoundsCount(tournament) {
        // Check if tournament has round data
        if (tournament.rounds && tournament.rounds.length > 0) {
            return tournament.rounds.length;
        }
        
        // If we have detailed results, count unique round numbers
        if (tournament.detailed_results && tournament.detailed_results.length > 0) {
            const roundNumbers = new Set();
            tournament.detailed_results.forEach(result => {
                if (result.round) roundNumbers.add(result.round);
            });
            if (roundNumbers.size > 0) return roundNumbers.size;
        }
        
        // Default fallback (13 rounds is standard)
        return 13;
    }

    /**
     * Calculate average tricks per round for a player in a specific tournament
     * @param {string} playerName - Name of the player
     * @param {Object} tournament - Tournament object
     * @returns {number} Average tricks per round
     */
    getPlayerAverageTricksPerRound(playerName, tournament) {
        const totalTricks = this.getPlayerTricksInTournament(playerName, tournament);
        const rounds = this.getTournamentRoundsCount(tournament);
        
        return totalTricks > 0 ? totalTricks / rounds : 0;
    }

    /**
     * Calculate recent form scores for players based on the most recent tournaments
     * @param {number} recentCount - Number of most recent tournaments to consider
     * @returns {Map<string, number>} Map of playerId -> recent form score
     */
    calculateRecentFormScores(recentCount = 5) {
        const scores = new Map();
        const tournaments = Array.from(this.tournaments.values())
            .sort((a, b) => b.year - a.year)
            .slice(0, recentCount);

        if (tournaments.length === 0) {
            return scores;
        }

        tournaments.forEach((tournament, index) => {
            const weight = recentCount - index; // More recent tournaments carry more weight
            const participantCount = tournament.final_standings ? tournament.final_standings.length : 0;

            if (!participantCount || !tournament.final_standings) {
                return;
            }

            tournament.final_standings.forEach((standing, positionIndex) => {
                const baseScore = participantCount - positionIndex; // Winner gets highest base score
                const score = baseScore * weight;

                if (standing.is_partnership && standing.partnership_players) {
                    standing.partnership_players.forEach(playerId => {
                        const currentScore = scores.get(playerId) || 0;
                        scores.set(playerId, currentScore + score);
                    });
                } else {
                    const playerId = standing.player;
                    const currentScore = scores.get(playerId) || 0;
                    scores.set(playerId, currentScore + score);
                }
            });
        });

        return scores;
    }

    /**
     * Calculate average performance percentile per player across all tournaments
     * Percentile = (position / total_players) * 100 (lower is better)
     * @returns {Map<string, number>} Map of playerId -> average percentile
     */
    calculatePerformanceScores() {
        const performanceTotals = new Map();

        for (const tournament of this.tournaments.values()) {
            if (!tournament.final_standings || tournament.final_standings.length === 0) continue;
            const totalPlayers = tournament.final_standings.length;

            tournament.final_standings.forEach(standing => {
                const percentile = (standing.position / totalPlayers) * 100;
                const players = standing.is_partnership && standing.partnership_players
                    ? standing.partnership_players
                    : [standing.player];

                players.forEach(playerId => {
                    if (!performanceTotals.has(playerId)) {
                        performanceTotals.set(playerId, { sum: 0, count: 0 });
                    }
                    const stats = performanceTotals.get(playerId);
                    stats.sum += percentile;
                    stats.count += 1;
                });
            });
        }

        const averages = new Map();
        for (const [playerId, stats] of performanceTotals.entries()) {
            if (stats.count > 0) {
                averages.set(playerId, stats.sum / stats.count);
            }
        }

        return averages;
    }

    /**
     * Get performance stats for a player (seed rank, seed points, avg tricks, top percentile, podium rate)
     */
    getPlayerPerformanceStats(playerName) {
        const playerStats = this.getPlayerStats(playerName, true);
        if (!playerStats) return null;
        
        const seedRankings = this.getOfficialSeedRankings(true);
        const seedEntry = seedRankings.find(entry => entry.name === playerName);
        
        const percentileScores = this.calculatePerformanceScores();
        const avgPercentile = percentileScores.get(playerName);
        
        const tournaments = this.getAllTournaments();
        const topThreeCount = tournaments.filter(t => {
            const standing = t.final_standings.find(s => s.player === playerName);
            if (standing && standing.position <= 3) return true;
            const sharedEntry = t.final_standings.find(s => s.is_partnership && s.partnership_players && s.partnership_players.includes(playerName));
            return sharedEntry && sharedEntry.position <= 3;
        }).length;
        const topThreeRate = playerStats.tournaments_played > 0 ? (topThreeCount / playerStats.tournaments_played) * 100 : 0;
        
        return {
            seed_rank: seedEntry ? seedEntry.seed_rank : null,
            seed_points: seedEntry ? seedEntry.seed_points : null,
            average_tricks: playerStats.average_tricks,
            top_percentile: typeof avgPercentile === 'number' ? avgPercentile : null,
            top_three_rate: topThreeRate
        };
    }

    /**
     * Get position emoji for tournament ranking
     * @param {number} position - Player's position (1-based)
     * @param {number} totalPlayers - Total number of players
     * @returns {string} Appropriate emoji for the position
     */
    getPositionEmoji(position, totalPlayers) {
        if (position === 1) return '🥇';
        if (position === 2) return '🥈';
        if (position === 3) return '🥉';
        if (position === totalPlayers) return '🎭'; // Booby prize
        return '🎯';
    }

    /**
     * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
     * @param {number} num - The number
     * @returns {string} Ordinal suffix
     */
    getOrdinalSuffix(num) {
        const j = num % 10;
        const k = num % 100;
        if (j == 1 && k != 11) return "st";
        if (j == 2 && k != 12) return "nd";
        if (j == 3 && k != 13) return "rd";
        return "th";
    }

    /**
     * Calculate trump suit statistics for a player
     */
    getPlayerTrumpSuitStats(playerName) {
        const trumpStats = {
            'Hearts': { total_tricks: 0, rounds_played: 0, average: 0 },
            'Diamonds': { total_tricks: 0, rounds_played: 0, average: 0 },
            'Spades': { total_tricks: 0, rounds_played: 0, average: 0 },
            'Clubs': { total_tricks: 0, rounds_played: 0, average: 0 }
        };

        // Iterate through all tournaments and rounds
        for (const [tournamentKey, tournament] of this.tournaments) {
            for (const round of tournament.rounds) {
                const trumpSuit = round.trump_suit;
                
                for (const table of round.tables) {
                    for (const partnership of table.partnerships) {
                        // Determine if player participated and which position they were in
                        const inPos1 = partnership.position1.some(id => id.toLowerCase() === playerName.toLowerCase());
                        const inPos2 = !inPos1 && partnership.position2.some(id => id.toLowerCase() === playerName.toLowerCase());

                        if ((inPos1 || inPos2) && trumpStats[trumpSuit]) {
                            // Share count is the number of players sharing the player's position
                            const shareCount = inPos1 ? partnership.position1.length : partnership.position2.length;
                            const tricksShare = partnership.tricks / shareCount;
                            const roundsShare = 1 / shareCount;

                            trumpStats[trumpSuit].total_tricks += tricksShare;
                            trumpStats[trumpSuit].rounds_played += roundsShare;
                        }
                    }
                }
            }
        }

        // Calculate averages
        for (const suit of Object.keys(trumpStats)) {
            if (trumpStats[suit].rounds_played > 0) {
                trumpStats[suit].average = (trumpStats[suit].total_tricks / trumpStats[suit].rounds_played);
            }
        }

        return trumpStats;
    }

    /**
     * Get partnership performance rankings
     */
    getPartnershipPerformanceRankings() {
        const partnerships = new Map();

        // Iterate through all tournaments and rounds
        for (const [tournamentKey, tournament] of this.tournaments) {
            for (const round of tournament.rounds) {
                for (const table of round.tables) {
                    for (const partnership of table.partnerships) {
                        // Skip shared hand partnerships - only track normal 2-player partnerships
                        const pos1IsShared = partnership.position1.length > 1;
                        const pos2IsShared = partnership.position2.length > 1;
                        if (pos1IsShared || pos2IsShared) continue;

                        // Normal partnership: get the 2 player IDs
                        const sortedPlayers = [partnership.position1[0], partnership.position2[0]].sort();
                        const partnershipKey = sortedPlayers.join(' & ');

                        if (!partnerships.has(partnershipKey)) {
                            partnerships.set(partnershipKey, {
                                players: sortedPlayers,
                                total_tricks: 0,
                                total_rounds: 0,
                                partnerships_count: 0
                            });
                        }

                        const partnershipData = partnerships.get(partnershipKey);

                        // Normal partnership - full credit
                        let tricksToAdd = partnership.tricks;
                        let roundsToAdd = 1;

                        partnershipData.total_tricks += tricksToAdd;
                        partnershipData.total_rounds += roundsToAdd;
                        partnershipData.partnerships_count++;
                    }
                }
            }
        }

        // Convert to array and calculate averages
        const rankings = [];
        for (const [partnershipKey, data] of partnerships) {
            if (data.total_rounds > 0) {
                rankings.push({
                    partnership: partnershipKey,
                    players: data.players,
                    average_tricks: data.total_tricks / data.total_rounds,
                    total_tricks: data.total_tricks,
                    total_rounds: data.total_rounds,
                    partnerships_count: data.partnerships_count
                });
            }
        }

        // Sort by average tricks (descending)
        rankings.sort((a, b) => b.average_tricks - a.average_tricks);

        return rankings;
    }

    /**
     * Get family statistics grouped by last name
     */
    getFamilyStatistics() {
        const families = new Map();

        // Group players by last name
        for (const [playerName, playerData] of this.players) {
            // Extract last name (handle partnerships)
            let lastName = '';
            if (playerName.includes('/')) {
                // Partnership - get last names of both players
                const partners = playerName.split('/');
                const lastNames = partners.map(partner => partner.trim().split(' ').pop()).sort();
                lastName = lastNames.join('/');
            } else {
                // Individual player
                lastName = playerName.trim().split(' ').pop();
            }

            if (!families.has(lastName)) {
                families.set(lastName, {
                    family_name: lastName,
                    members: [],
                    total_players: 0,
                    total_tournaments: 0,
                    total_tricks: 0,
                    total_rounds: 0,
                    tournament_wins: 0,
                    top_three_finishes: 0
                });
            }

            const familyData = families.get(lastName);
            familyData.members.push({
                name: playerName,
                tournaments_played: playerData.tournaments_played,
                total_tricks: playerData.total_tricks,
                tournament_wins: playerData.tournament_wins,
                average_tricks: parseFloat(playerData.average_tricks)
            });
            
            familyData.total_players++;
            familyData.total_tournaments += playerData.tournaments_played;
            familyData.total_tricks += playerData.total_tricks;
            familyData.total_rounds += playerData.total_rounds;
            familyData.tournament_wins += playerData.tournament_wins;
            familyData.top_three_finishes += playerData.top_three_finishes;
        }

        // Convert to array and calculate family averages
        const familyStats = [];
        for (const [familyName, data] of families) {
            familyStats.push({
                family_name: data.family_name,
                members: data.members,
                total_players: data.total_players,
                average_tricks_per_player: data.total_rounds > 0 ? (data.total_tricks / data.total_rounds) : 0,
                total_tricks: data.total_tricks,
                total_tournaments: data.total_tournaments,
                tournament_wins: data.tournament_wins,
                top_three_finishes: data.top_three_finishes,
                win_rate: data.total_tournaments > 0 ? (data.tournament_wins / data.total_tournaments * 100) : 0
            });
        }

        // Sort by average tricks per player (descending)
        familyStats.sort((a, b) => b.average_tricks_per_player - a.average_tricks_per_player);

        return familyStats;
    }

    /**
     * Get all individual players, splitting partnerships into separate entries
     * For partnerships, each player gets:
     * - tricks = total_tricks / number_of_partners (rounded down)
     * - rounds = total_rounds / number_of_partners  
     * - average_tricks = total_tricks / total_rounds (not divided)
     * - career stats sum the individual contributions
     */
    getAllIndividualPlayers(sortBy = 'total_tricks') {
        const individualPlayers = new Map();
        
        // Process each tournament to build individual player statistics
        for (const [tournamentKey, tournament] of this.tournaments) {
            for (const standing of tournament.final_standings) {
                const parsedPlayer = this.parseSharedHand(standing.player);
                
                if (parsedPlayer.isShared) {
                    // Split partnership into individual players
                    const numPartners = parsedPlayer.players.length;
                    const tricksPerPlayer = standing.total_tricks / numPartners;
                    const roundsPerPlayer = standing.rounds_played / numPartners;
                    
                    for (const individualName of parsedPlayer.players) {
                        const canonicalId = this.getCanonicalPlayerId(individualName);
                        if (!individualPlayers.has(canonicalId)) {
                            individualPlayers.set(canonicalId, {
                                name: canonicalId,
                                tournaments_played: 0,
                                total_tricks: 0,
                                total_rounds: 0,
                                tournament_wins: 0,
                                top_three_finishes: 0,
                                tournament_history: []
                            });
                        }
                        
                        const playerData = individualPlayers.get(canonicalId);
                        playerData.tournaments_played++;
                        playerData.total_tricks += tricksPerPlayer;
                        playerData.total_rounds += roundsPerPlayer;
                        
                        // Tournament position logic for partnerships
                        if (standing.position === 1) {
                            playerData.tournament_wins++;
                        }
                        if (standing.position <= 3) {
                            playerData.top_three_finishes++;
                        }
                        
                        playerData.tournament_history.push({
                            tournament: tournamentKey,
                            year: tournament.year,
                            position: standing.position,
                            tricks: tricksPerPlayer,
                            rounds: roundsPerPlayer,
                            average_tricks: standing.total_tricks / standing.rounds_played, // Original average
                            was_partnership: true,
                            partnership_name: standing.player
                        });
                    }
                } else {
                    // Individual player
                    const playerName = this.getCanonicalPlayerId(standing.player);
                    
                    if (!individualPlayers.has(playerName)) {
                        individualPlayers.set(playerName, {
                            name: playerName,
                            tournaments_played: 0,
                            total_tricks: 0,
                            total_rounds: 0,
                            tournament_wins: 0,
                            top_three_finishes: 0,
                            tournament_history: []
                        });
                    }
                    
                    const playerData = individualPlayers.get(playerName);
                    playerData.tournaments_played++;
                    playerData.total_tricks += standing.total_tricks;
                    playerData.total_rounds += standing.rounds_played;
                    
                    if (standing.position === 1) {
                        playerData.tournament_wins++;
                    }
                    if (standing.position <= 3) {
                        playerData.top_three_finishes++;
                    }
                    
                    playerData.tournament_history.push({
                        tournament: tournamentKey,
                        year: tournament.year,
                        position: standing.position,
                        tricks: standing.total_tricks,
                        rounds: standing.rounds_played,
                        average_tricks: standing.total_tricks / standing.rounds_played,
                        was_partnership: false
                    });
                }
            }
        }
        
        // Calculate career averages for each player
        const players = Array.from(individualPlayers.values()).map(player => {
            player.average_tricks = player.total_rounds > 0 ? 
                (player.total_tricks / player.total_rounds).toFixed(2) : '0.00';
            return player;
        });
        
        // Sort the players
        switch (sortBy) {
            case 'tournament_wins':
                return players.sort((a, b) => b.tournament_wins - a.tournament_wins);
            case 'win_percentage':
                return players.sort((a, b) => {
                    const aWinPct = (a.total_tricks / a.total_rounds) * 100;
                    const bWinPct = (b.total_tricks / b.total_rounds) * 100;
                    return bWinPct - aWinPct;
                });
            default:
                return players.sort((a, b) => b.total_tricks - a.total_tricks);
        }
    }

    /**
     * Calculate player trend by comparing position before and after most recent tournament
     * @param {string} playerName - Name of the player
     * @param {string} rankingType - Type of ranking (overall, championships, career_stats, recent_form)
     * @returns {number} Position change (positive = improvement, negative = decline, 0 = same)
     */
    calculatePlayerTrend(playerName, rankingType) {
        try {
            // Get all tournaments sorted by year (most recent first)
            const allTournaments = Array.from(this.tournaments.entries())
                .map(([key, tournament]) => ({ key, ...tournament }))
                .sort((a, b) => b.year - a.year);

            if (allTournaments.length < 2) {
                return 0; // Need at least 2 tournaments to show trend
            }

            const mostRecentTournament = allTournaments[0];
            
            // Calculate rankings excluding the most recent tournament
            const previousRankings = this.calculateRankingsExcludingTournament(mostRecentTournament.key, rankingType);
            
            // Calculate current rankings (including all tournaments)
            const currentRankings = this.calculateRankingsForType(rankingType);
            
            // Find player positions in both rankings
            const previousPosition = previousRankings.findIndex(p => p.name === playerName) + 1;
            const currentPosition = currentRankings.findIndex(p => p.name === playerName) + 1;
            
            // If player wasn't in previous ranking, they're new
            if (previousPosition === 0) {
                return 0; // New player, no trend
            }
            
            if (currentPosition === 0) {
                return 0; // Player not in current ranking
            }
            
            // Calculate change (positive = improvement in ranking = lower position number)
            return previousPosition - currentPosition;
            
        } catch (error) {
            console.warn('Error calculating trend for', playerName, ':', error);
            return 0;
        }
    }

    /**
     * Calculate rankings excluding a specific tournament
     * @param {string} excludeTournamentKey - Tournament key to exclude
     * @param {string} rankingType - Type of ranking
     * @returns {Array} Rankings array
     */
    calculateRankingsExcludingTournament(excludeTournamentKey, rankingType) {
        // Temporarily remove the tournament
        const originalTournament = this.tournaments.get(excludeTournamentKey) || this.tournaments.get(excludeTournamentKey.toLowerCase());
        if (!originalTournament) {
            return this.calculateRankingsForType(rankingType);
        }
        this.tournaments.delete(excludeTournamentKey);
        this.tournaments.delete(excludeTournamentKey.toLowerCase());
        
        // Recalculate player statistics without this tournament
        this.players.clear();
        this.calculatePlayerStatistics();
        
        // Get rankings for this type
        const rankings = this.calculateRankingsForType(rankingType);
        
        // Restore the tournament
        this.tournaments.set(excludeTournamentKey, originalTournament);
        if (excludeTournamentKey !== excludeTournamentKey.toLowerCase()) {
            this.tournaments.set(excludeTournamentKey.toLowerCase(), originalTournament);
        }
        
        // Recalculate with all tournaments
        this.players.clear();
        this.calculatePlayerStatistics();
        
        return rankings;
    }

    /**
     * Calculate rankings for a specific type
     * @param {string} rankingType - Type of ranking
     * @returns {Array} Rankings array
     */
    calculateRankingsForType(rankingType) {
        switch (rankingType) {
            case 'overall':
                return this.getOfficialSeedRankings();
            case 'championships':
                return this.getPlayerRankings().sort((a, b) => b.tournament_wins - a.tournament_wins);
            case 'career_stats':
                return this.getPlayerRankings().sort((a, b) => {
                    const aWinPct = a.total_rounds > 0 ? (a.rounds_won / a.total_rounds) * 100 : 0;
                    const bWinPct = b.total_rounds > 0 ? (b.rounds_won / b.total_rounds) * 100 : 0;
                    return bWinPct - aWinPct;
                });
            case 'recent_form':
                // For recent form, we could implement a more sophisticated algorithm
                // For now, use a simple approach based on recent performance
                return this.getPlayerRankings().sort((a, b) => {
                    const aRecent = (a.tournament_wins || 0) * 2 + (a.top_three_finishes || 0);
                    const bRecent = (b.tournament_wins || 0) * 2 + (b.top_three_finishes || 0);
                    return bRecent - aRecent;
                });
            case 'booby':
                return this.getPlayerRankings().sort((a, b) => {
                    const boobyDiff = (b.booby_prizes || 0) - (a.booby_prizes || 0);
                    if (boobyDiff !== 0) {
                        return boobyDiff;
                    }
                    const pctDiff = (b.booby_percentage || 0) - (a.booby_percentage || 0);
                    if (pctDiff !== 0) {
                        return pctDiff;
                    }
                    return (a.tournaments_played || 0) - (b.tournaments_played || 0);
                });
            default:
                return this.getPlayerRankings();
        }
    }
}

// Export for browsers
if (typeof window !== 'undefined') {
    window.TournamentEngine = TournamentEngine;
}

// Export for Node scripts (static cache build step)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TournamentEngine };
}