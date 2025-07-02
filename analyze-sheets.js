// Analyze the actual structure of the Google Sheets
const fetch = require('node-fetch');

async function analyzeSheets() {
    const sheetId = '1HGfdlDOfGHOL6Q4MP_TnF8UNE6YihBW-5gQs6Ykl78k';
    
    console.log('🔍 Analyzing Google Sheets structure...\n');
    
    // Check GIDs 0-10 to see what's actually there
    for (let gid = 0; gid <= 10; gid++) {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.text();
                const lines = data.trim().split('\n');
                
                if (lines.length > 1) {
                    console.log(`📊 GID ${gid}: ${lines.length - 1} rows`);
                    console.log(`   Headers: ${lines[0]}`);
                    
                    // Determine sheet type
                    const headers = lines[0].toLowerCase();
                    if (headers.includes('firstname') && headers.includes('lastname')) {
                        console.log(`   👥 Appears to be PLAYERS sheet`);
                        // Show some player data
                        for (let i = 1; i <= Math.min(3, lines.length - 1); i++) {
                            console.log(`   Player ${i}: ${lines[i]}`);
                        }
                    } else if (headers.includes('tournament') && headers.includes('round')) {
                        console.log(`   🏆 Appears to be TOURNAMENT sheet`);
                        // Check for data validation issues
                        let validRows = 0;
                        let invalidRows = 0;
                        const sharedHands = [];
                        
                        for (let i = 1; i <= Math.min(10, lines.length - 1); i++) {
                            const values = lines[i].split(',').map(v => v.trim());
                            
                            // Find Tricks_Won and Opponent_Tricks columns
                            const headerList = lines[0].split(',');
                            const tricksWonIndex = headerList.findIndex(h => h.includes('Tricks_Won'));
                            const opponentTricksIndex = headerList.findIndex(h => h.includes('Opponent_Tricks'));
                            
                            if (tricksWonIndex >= 0 && opponentTricksIndex >= 0) {
                                const tricksWon = parseInt(values[tricksWonIndex]);
                                const opponentTricks = parseInt(values[opponentTricksIndex]);
                                
                                if (!isNaN(tricksWon) && !isNaN(opponentTricks)) {
                                    if (tricksWon + opponentTricks === 13) {
                                        validRows++;
                                    } else {
                                        invalidRows++;
                                        console.log(`   ❌ Row ${i}: ${tricksWon} + ${opponentTricks} = ${tricksWon + opponentTricks} (should be 13)`);
                                    }
                                }
                            }
                            
                            // Check for shared hands
                            const playerFields = ['Player1', 'Player2', 'Opponent1', 'Opponent2'];
                            playerFields.forEach(field => {
                                const fieldIndex = headerList.findIndex(h => h.includes(field));
                                if (fieldIndex >= 0) {
                                    const value = values[fieldIndex];
                                    if (value && (value.includes('+') || value.includes('/') || value.includes('&'))) {
                                        sharedHands.push(`${field}: "${value}"`);
                                    }
                                }
                            });
                        }
                        
                        if (validRows > 0 || invalidRows > 0) {
                            console.log(`   ✅ Valid rows: ${validRows}, ❌ Invalid rows: ${invalidRows}`);
                        }
                        
                        if (sharedHands.length > 0) {
                            console.log(`   🤝 Shared hands found: ${sharedHands.slice(0, 3).join(', ')}`);
                        }
                    } else {
                        console.log(`   ❓ Unknown sheet type`);
                    }
                    
                    console.log(''); // Empty line
                }
            }
        } catch (e) {
            // Skip failed GIDs
        }
    }
}

analyzeSheets();