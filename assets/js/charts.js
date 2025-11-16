/**
 * Tournament Progress Charts
 * Advanced visualizations using Chart.js
 */

class TournamentCharts {
    constructor() {
        this.charts = new Map();
        this.colors = {
            primary: '#d4af37',        // Muted gold
            secondary: '#22c55e',      // Softer green
            accent: '#dc2626',         // Classic red
            gold: '#d4af37',           // Muted gold
            silver: '#cbd5e1',         // Warm silver
            bronze: '#a16207',         // Warm bronze
            cardBlack: '#f8fafc',      // Soft white
            cardRed: '#dc2626',        // Classic red
            pokerGreen: '#0f2419',     // Dark poker green
            creamWhite: '#fefefe'      // Warm white
        };
        
        // Load Chart.js if not already loaded
        this.loadChartJS();
    }

    /**
     * Load Chart.js library
     */
    async loadChartJS() {
        if (typeof Chart !== 'undefined') {
            this.initializeChartDefaults();
            return;
        }

        try {
            // Load Chart.js from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
            script.onload = () => {
                this.initializeChartDefaults();
                console.log('📊 Chart.js loaded successfully');
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Error loading Chart.js:', error);
        }
    }

    /**
     * Initialize Chart.js defaults
     */
    initializeChartDefaults() {
        if (typeof Chart === 'undefined') return;

        Chart.defaults.font.family = 'Inter, sans-serif';
        Chart.defaults.color = '#374151';
        Chart.defaults.borderColor = '#22c55e';
        Chart.defaults.backgroundColor = 'rgba(212, 175, 55, 0.1)';
    }

    /**
     * Create tournament progress chart (horse race style)
     */
    createTournamentProgressChart(canvasId, tournamentData) {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded yet');
            return null;
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas ${canvasId} not found`);
            return null;
        }

        const ctx = canvas.getContext('2d');
        
        // Process tournament data for line chart
        const progressData = this.processTournamentProgress(tournamentData);
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: progressData.rounds,
                datasets: progressData.players.map((player, index) => ({
                    label: player.name,
                    data: player.cumulativeScores,
                    borderColor: this.getPlayerColor(index),
                    backgroundColor: this.getPlayerColor(index, 0.1),
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.2,
                    fill: false
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Tournament Progress - Championship Race',
                        font: {
                            size: 18,
                            weight: 'bold',
                            family: 'Playfair Display'
                        },
                        color: '#1a1a1a'
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        callbacks: {
                            title: function(context) {
                                return `Round ${context[0].label}`;
                            },
                            label: function(context) {
                                const player = context.dataset.label;
                                const score = context.parsed.y;
                                const position = this.getPositionAtRound(progressData, context.dataIndex, player);
                                return `${player}: ${score} tricks (${position} place)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Tournament Rounds',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#374151'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Cumulative Tricks',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#374151'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        beginAtZero: true
                    }
                },
                elements: {
                    point: {
                        hoverBorderWidth: 3
                    }
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create player performance radar chart
     */
    createPlayerRadarChart(canvasId, playerData) {
        if (typeof Chart === 'undefined') return null;

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: [
                    'Strategic Play',
                    'Aggression',
                    'Consistency',
                    'Partnership',
                    'Pressure Performance',
                    'Trump Analysis'
                ],
                datasets: [{
                    label: playerData.name,
                    data: [
                        playerData.strategy || 85,
                        playerData.aggression || 75,
                        playerData.consistency || 90,
                        playerData.partnership || 80,
                        playerData.pressure || 95,
                        playerData.trumpAnalysis || 88
                    ],
                    borderColor: this.colors.primary,
                    backgroundColor: `${this.colors.primary}20`,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${playerData.name} - Playing Style Analysis`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: '#1a1a1a'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create partnership success chart
     */
    createPartnershipChart(canvasId, partnershipData) {
        if (typeof Chart === 'undefined') return null;

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: partnershipData.map(p => p.partnership),
                datasets: [{
                    label: 'Success Rate (%)',
                    data: partnershipData.map(p => p.successRate),
                    backgroundColor: partnershipData.map((p, i) => this.getPlayerColor(i, 0.7)),
                    borderColor: partnershipData.map((p, i) => this.getPlayerColor(i)),
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Partnership Success Rates',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: '#1a1a1a'
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const partnership = partnershipData[context.dataIndex];
                                return [
                                    `Success Rate: ${context.parsed.y}%`,
                                    `Games Played: ${partnership.gamesPlayed}`,
                                    `Average Score: ${partnership.averageScore}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Partnerships',
                            font: { weight: 'bold' },
                            color: '#374151'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Success Rate (%)',
                            font: { weight: 'bold' },
                            color: '#374151'
                        },
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create tournament statistics pie chart
     */
    createTournamentStatsChart(canvasId, statsData) {
        if (typeof Chart === 'undefined') return null;

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: statsData.map(s => s.category),
                datasets: [{
                    data: statsData.map(s => s.value),
                    backgroundColor: [
                        this.colors.gold,
                        this.colors.primary,
                        this.colors.secondary,
                        this.colors.accent,
                        this.colors.silver
                    ],
                    borderWidth: 3,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Tournament Performance Distribution',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: '#1a1a1a'
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label;
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create yearly performance trend chart
     */
    createYearlyTrendChart(canvasId, yearlyData) {
        if (typeof Chart === 'undefined') return null;

        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: yearlyData.years,
                datasets: [{
                    label: 'Average Performance',
                    data: yearlyData.averagePerformance,
                    borderColor: this.colors.primary,
                    backgroundColor: `${this.colors.primary}20`,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.3
                }, {
                    label: 'Tournament Wins',
                    data: yearlyData.tournamentWins,
                    borderColor: this.colors.gold,
                    backgroundColor: `${this.colors.gold}20`,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: false,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Yearly Performance Trends',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: '#1a1a1a'
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Year',
                            font: { weight: 'bold' },
                            color: '#374151'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Average Score',
                            font: { weight: 'bold' },
                            color: '#374151'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Tournament Wins',
                            font: { weight: 'bold' },
                            color: '#374151'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Process tournament data for progress visualization
     */
    processTournamentProgress(tournamentData) {
        if (!tournamentData || !tournamentData.rounds) {
            return this.generateSampleProgressData();
        }

        const rounds = Array.from({length: tournamentData.rounds.length}, (_, i) => i + 1);
        const playerScores = new Map();

        // Initialize player scores
        tournamentData.final_standings.forEach(standing => {
            playerScores.set(standing.player, [0]);
        });

        // Calculate cumulative scores for each round
        tournamentData.rounds.forEach((round, roundIndex) => {
            round.tables.forEach(table => {
                table.partnerships.forEach(partnership => {
                    partnership.players.forEach(player => {
                        // Handle shared hand partnerships - convert format to match final standings
                        let playerToFind = player;
                        const delimiters = ['+', '&'];
                        let foundDelimiter = null;
                        
                        for (const delimiter of delimiters) {
                            if (player.includes(delimiter)) {
                                foundDelimiter = delimiter;
                                break;
                            }
                        }
                        
                        if (foundDelimiter) {
                            // Convert any delimiter to "/" format to match final standings
                            const regex = new RegExp(`\\s*\\${foundDelimiter}\\s*`, 'g');
                            playerToFind = player.replace(regex, '/');
                            console.log(`    🔗 Converting partnership "${player}" → "${playerToFind}"`);
                        }
          
                        if (roundScores.has(playerToFind)) {
                            const currentScore = roundScores.get(playerToFind);
                            const newScore = currentScore + partnership.tricks;
                            roundScores.set(playerToFind, newScore);
                        } else {
                            console.warn(`⚠️  Player "${playerToFind}" from partnership not found in initialized players!`);
                            console.log(`    Available players (${playerScores.size}):`, Array.from(playerScores.keys()).join(', '));
                        }
                    });
                });
            });
        });

        // Convert to chart format
        const players = Array.from(playerScores.entries()).map(([name, scores]) => ({
            name: name,
            cumulativeScores: scores.slice(1) // Remove initial 0
        }));

        return { rounds, players };
    }

    /**
     * Generate sample progress data for demonstration
     */
    generateSampleProgressData() {
        const rounds = [1, 2, 3, 4, 5, 6, 7, 8];
        const players = [
            { name: 'Margaret Wilson', cumulativeScores: [14, 27, 41, 55, 68, 82, 95, 112] },
            { name: 'James Ruston', cumulativeScores: [12, 25, 39, 53, 66, 79, 93, 108] },
            { name: 'Emma Jones', cumulativeScores: [13, 24, 37, 51, 64, 78, 91, 105] },
            { name: 'David Smith', cumulativeScores: [11, 23, 36, 49, 62, 75, 89, 102] },
            { name: 'Sarah Brown', cumulativeScores: [10, 22, 35, 48, 61, 74, 87, 98] }
        ];

        return { rounds, players };
    }

    /**
     * Get color for player based on index
     */
    getPlayerColor(index, alpha = 1) {
        const colors = [
            this.colors.gold,         // #d4af37 - Muted gold
            this.colors.accent,       // #dc2626 - Classic red
            this.colors.secondary,    // #22c55e - Softer green
            this.colors.bronze,       // #a16207 - Warm bronze
            '#059669',               // Forest green
            '#7c3aed',               // Purple
            '#0891b2',               // Teal
            '#65a30d',               // Olive green
            '#c2410c',               // Orange-red
            '#7c2d12',               // Dark brown
            '#1e40af',               // Deep blue
            '#be185d'                // Dark pink
        ];
        
        const color = colors[index % colors.length];
        
        if (alpha < 1) {
            // Convert hex to rgba
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        
        return color;
    }

    /**
     * Get position at specific round for tooltip
     */
    getPositionAtRound(progressData, roundIndex, playerName) {
        const roundScores = progressData.players.map(player => ({
            name: player.name,
            score: player.cumulativeScores[roundIndex] || 0
        }));
        
        roundScores.sort((a, b) => b.score - a.score);
        
        const position = roundScores.findIndex(player => player.name === playerName) + 1;
        
        const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
        return ordinals[position] || `${position}th`;
    }

    /**
     * Create rank progression chart showing position changes throughout tournament
     */
    createRankProgressChart(canvasId, tournamentData, highlightPlayer = null, tournamentEngine = null) {
        console.log(`📈 Creating rank progression chart on canvas '${canvasId}' for player: ${highlightPlayer || 'all players'}`);
        
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js not loaded yet');
            return null;
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`❌ Canvas '${canvasId}' not found`);
            return null;
        }

        console.log('✅ Canvas found, Chart.js loaded');

        const ctx = canvas.getContext('2d');
        
        // Process tournament data for rank progression
        const rankData = this.processRankProgression(tournamentData, tournamentEngine);
        
        if (!rankData || !rankData.players || rankData.players.length === 0) {
            console.error('❌ No rank data generated');
            return null;
        }

        console.log(`📊 Creating chart with ${rankData.players.length} players and ${rankData.rounds.length} rounds`);
        
        // Register custom plugin for drawing player names grouped by rank
        const playerNamesPlugin = {
            id: 'playerNames',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                const yScale = chart.scales.y;
                
                // Group players by final rank with their original colors
                const rankGroups = new Map();
                chart.data.datasets.forEach((dataset, index) => {
                    const finalRank = dataset.data[dataset.data.length - 1];
                    if (!rankGroups.has(finalRank)) {
                        rankGroups.set(finalRank, []);
                    }
                    
                    // Use the original full-opacity color instead of the potentially faded borderColor
                    const originalColor = this.getPlayerColor(index);
                    
                    rankGroups.get(finalRank).push({
                        name: dataset.label,
                        color: originalColor // Use full-opacity color
                    });
                });
                
                // Adjust font size based on number of rank groups
                const fontSize = rankGroups.size > 12 ? 10 : 12;
                const maxWidth = 120; // Maximum width before wrapping (within 140px padding)
                const lineHeight = fontSize + 4; // Line spacing
                
                // Draw grouped labels with text wrapping
                rankGroups.forEach((players, rank) => {
                    const baseYPosition = yScale.getPixelForValue(rank);
                    let xPosition = chartArea.right + 15; // 15px padding from chart edge
                    
                    ctx.save();
                    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    
                    // Create ordinal for rank
                    const ordinal = rank === 1 ? '1st' : 
                                   rank === 2 ? '2nd' : 
                                   rank === 3 ? '3rd' : 
                                   `${rank}th`;
                    
                    // Draw the rank prefix in dark gray
                    ctx.fillStyle = '#374151';
                    ctx.fillText(`${ordinal}: `, xPosition, baseYPosition);
                    
                    // Measure the rank prefix width
                    const rankPrefixWidth = ctx.measureText(`${ordinal}: `).width;
                    let currentX = xPosition + rankPrefixWidth;
                    let currentY = baseYPosition;
                    let currentLineWidth = rankPrefixWidth;
                    
                    // Draw each player name with wrapping
                    players.forEach((player, index) => {
                        ctx.fillStyle = player.color;
                        const separator = index > 0 ? ', ' : '';
                        const text = separator + player.name;
                        const textWidth = ctx.measureText(text).width;
                        
                        // Check if we need to wrap to next line
                        if (currentLineWidth + textWidth > maxWidth && index > 0) {
                            currentY += lineHeight;
                            currentX = xPosition + rankPrefixWidth;
                            currentLineWidth = rankPrefixWidth;
                            
                            // Remove separator for first item on new line
                            const wrappedText = player.name;
                            ctx.fillText(wrappedText, currentX, currentY);
                            currentX += ctx.measureText(wrappedText).width;
                            currentLineWidth += ctx.measureText(wrappedText).width;
                        } else {
                            ctx.fillText(text, currentX, currentY);
                            currentX += textWidth;
                            currentLineWidth += textWidth;
                        }
                    });
                    
                    ctx.restore();
                });
            }
        };

        const chart = new Chart(ctx, {
            type: 'line',
            plugins: [playerNamesPlugin],
            data: {
                labels: rankData.rounds,
                datasets: (() => {
                    // Show all players when no one is highlighted (tournament overview)
                    // Only limit when there's a highlighted player (individual scorecard)
                    let playersToShow = rankData.players;
                    
                    if (highlightPlayer && rankData.players.length > 10) {
                        // When highlighting a specific player, show top 10 + highlighted player for readability
                        const finalRanks = rankData.players.map(p => ({ 
                            name: p.name, 
                            finalRank: p.ranks[p.ranks.length - 1] || 999,
                            data: p
                        })).sort((a, b) => a.finalRank - b.finalRank);
                        
                        playersToShow = finalRanks.slice(0, 10).map(p => p.data);
                        console.log(`📊 Limited to top 10 players for individual scorecard:`, playersToShow.map(p => p.name));
                    } else if (!highlightPlayer) {
                        console.log(`📊 Showing all ${rankData.players.length} players for tournament overview`);
                    }
                    
                    const datasets = playersToShow.map((player, index) => {
                        const isHighlighted = highlightPlayer && player.name === highlightPlayer;
                        const baseColor = this.getPlayerColor(index);
                        
                        return {
                            label: player.name,
                            data: player.ranks,
                            scores: player.scores, // Add scores for tooltip access
                            borderColor: isHighlighted ? '#dc2626' : (highlightPlayer ? this.fadeColor(baseColor, 0.3) : baseColor),
                            backgroundColor: isHighlighted ? 'rgba(220, 38, 38, 0.1)' : (highlightPlayer ? this.fadeColor(baseColor, 0.1) : this.getPlayerColor(index, 0.1)),
                            borderWidth: isHighlighted ? 5 : (highlightPlayer ? 2 : 3),
                            pointRadius: isHighlighted ? 6 : (highlightPlayer ? 3 : 4),
                            pointHoverRadius: isHighlighted ? 8 : 6,
                            tension: 0.1,
                            fill: false,
                            pointStyle: this.getPointStyle(index),
                            pointBorderWidth: isHighlighted ? 3 : 2,
                            pointBackgroundColor: isHighlighted ? '#dc2626' : baseColor,
                            pointBorderColor: isHighlighted ? '#ffffff' : baseColor,
                            stepped: false
                        };
                    });
                    
                    // If we have a highlighted player not in the top performers, add them
                    if (highlightPlayer && !playersToShow.find(p => p.name === highlightPlayer)) {
                        const highlightedPlayer = rankData.players.find(p => p.name === highlightPlayer);
                        if (highlightedPlayer) {
                            datasets.push({
                                label: highlightedPlayer.name,
                                data: highlightedPlayer.ranks,
                                scores: highlightedPlayer.scores, // Add scores for tooltip access
                                borderColor: '#dc2626',
                                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                                borderWidth: 5,
                                pointRadius: 6,
                                pointHoverRadius: 8,
                                tension: 0.1,
                                fill: false,
                                pointStyle: 'circle',
                                pointBorderWidth: 3,
                                pointBackgroundColor: '#dc2626',
                                pointBorderColor: '#ffffff',
                                stepped: false
                            });
                            console.log(`➕ Added highlighted player ${highlightPlayer} to chart`);
                        }
                    }
                    
                    return datasets;
                })()
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        right: !highlightPlayer && rankData.players.length > 12 ? 160 : 140 // Extra padding for tournament overview with many players
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: highlightPlayer ? `Rank Progression - ${highlightPlayer} vs Field` : 'Tournament Rank Progression',
                        font: {
                            size: 18,
                            weight: 'bold',
                            family: 'Playfair Display'
                        },
                        color: '#1a1a1a'
                    },
                    legend: {
                        display: false // Disable legend as we'll show names on the right
                    },
                    playerNames: {}, // Enable our custom plugin
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        filter: function(tooltipItem) {
                            return true; // Show all items, we'll sort them instead
                        },
                        itemSort: function(a, b) {
                            // Sort tooltip items by rank (ascending - best rank first)
                            return a.parsed.y - b.parsed.y;
                        },
                        callbacks: {
                            title: function(context) {
                                return `After Round ${context[0].label}`;
                            },
                            label: function(context) {
                                const player = context.dataset.label;
                                const rank = context.parsed.y;
                                const roundIndex = context.dataIndex;
                                const tricks = context.dataset.scores ? context.dataset.scores[roundIndex] : 0;
                                
                                const ordinal = rank === 1 ? '1st' : 
                                              rank === 2 ? '2nd' : 
                                              rank === 3 ? '3rd' : 
                                              `${rank}th`;
                                return `    ${player}: ${ordinal} (${tricks} tricks)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Tournament Rounds',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#374151'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Rank Position',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#374151'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        reverse: true, // 1st place at top
                        min: 0, // Add padding at top for 1st place
                        max: rankData.players.length + 1, // Add padding at bottom for last place
                        ticks: {
                            stepSize: 1, // Show all ticks
                            callback: function(value) {
                                // Hide 0th and last+1 positions, show only valid ranks
                                if (value <= 0 || value > rankData.players.length) {
                                    return '';
                                }
                                // Show ordinal numbers
                                return value === 1 ? '1st' : 
                                       value === 2 ? '2nd' : 
                                       value === 3 ? '3rd' : 
                                       `${value}th`;
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        hoverBorderWidth: 3
                    }
                }
            }
        });

        console.log(`✅ Chart created successfully for ${canvasId}`);
        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Process tournament data for rank progression with proper tie handling
     */
    processRankProgression(tournamentData, tournamentEngine = null) {
        console.log('🔍 Processing rank progression data:', tournamentData);
        
        if (!tournamentData || !tournamentData.rounds) {
            console.warn('⚠️ No tournament data or rounds found, using sample data');
            return this.generateSampleRankData();
        }

        console.log(`📊 Tournament has ${tournamentData.rounds.length} rounds, ${tournamentData.final_standings.length} players`);

        const rounds = Array.from({length: tournamentData.rounds.length}, (_, i) => i + 1);
        const playerScores = new Map();

        // Initialize player scores tracking
        tournamentData.final_standings.forEach(standing => {
            playerScores.set(standing.player, [0]); // Start with 0 tricks before round 1
        });

        console.log(`🎯 Initialized ${playerScores.size} players:`, Array.from(playerScores.keys()).join(', '));
        console.log(`📋 Sample round data:`, tournamentData.rounds[0]?.tables[0]?.partnerships[0]);

        // Calculate cumulative scores after each round
        tournamentData.rounds.forEach((round, roundIndex) => {
            console.log(`🎮 Processing round ${round.round} (index ${roundIndex}):`, round);
            
            // Create a copy of current scores for this round
            const roundScores = new Map();
            playerScores.forEach((scores, player) => {
                roundScores.set(player, scores[scores.length - 1] || 0);
            });

            // Add this round's tricks
            let roundTricksAdded = 0;
            
            round.tables.forEach(table => {
                table.partnerships.forEach(partnership => {
                    const tricks = partnership.tricks || 0;
                    const seatGroups = [];
                    if (Array.isArray(partnership.position1) && partnership.position1.length > 0) {
                        seatGroups.push(partnership.position1);
                    }
                    if (Array.isArray(partnership.position2) && partnership.position2.length > 0) {
                        seatGroups.push(partnership.position2);
                    }

                    seatGroups.forEach(positionPlayers => {
                        if (!positionPlayers || positionPlayers.length === 0) return;
                        
                        const isSharedSeat = positionPlayers.length > 1;
                        let playerKey;

                        if (isSharedSeat) {
                            const displayNames = positionPlayers.map(id => 
                                tournamentEngine && tournamentEngine.getDisplayName ? 
                                    tournamentEngine.getDisplayName(id) : id
                            );
                            playerKey = displayNames.join('/');
                        } else {
                            playerKey = positionPlayers[0];
                        }

                        // Resolve to the key used in playerScores map
                        let resolvedKey = playerKey;
                        if (!roundScores.has(resolvedKey)) {
                            if (!isSharedSeat && tournamentEngine && tournamentEngine.getDisplayName) {
                                const displayName = tournamentEngine.getDisplayName(resolvedKey);
                                if (roundScores.has(displayName)) {
                                    resolvedKey = displayName;
                                }
                            }
                        }

                        if (!roundScores.has(resolvedKey)) {
                            console.warn(`    ⚠️ No match found for player seat: ${playerKey}`);
                            console.log(`    Available players: ${Array.from(roundScores.keys()).join(', ')}`);
                            return;
                        }

                        const currentScore = roundScores.get(resolvedKey);
                        const newScore = currentScore + tricks;
                        roundScores.set(resolvedKey, newScore);
                        roundTricksAdded += partnership.tricks;
                        console.log(`    ✅ Added ${partnership.tricks} tricks to ${resolvedKey} (shared seat: ${isSharedSeat})`);
                    });
                });
            });

            console.log(`  ✅ Round ${round.round}: Added ${roundTricksAdded} total tricks`);

            // Update player scores tracking
            roundScores.forEach((score, player) => {
                playerScores.get(player).push(score);
            });
        });

        // Convert scores to ranks for each round
        const playerRanks = new Map();
        
        // Initialize rank tracking
        playerScores.forEach((scores, player) => {
            playerRanks.set(player, []);
        });

        // Calculate ranks for each round
        for (let roundIndex = 1; roundIndex <= rounds.length; roundIndex++) {
            const roundScores = [];
            
            // Collect all scores for this round
            playerScores.forEach((scores, player) => {
                roundScores.push({
                    player: player,
                    score: scores[roundIndex] || 0
                });
            });

            // Sort by score (highest first) and assign ranks with tie handling
            roundScores.sort((a, b) => b.score - a.score);
            
            let currentRank = 1;
            for (let i = 0; i < roundScores.length; i++) {
                if (i > 0 && roundScores[i].score < roundScores[i-1].score) {
                    currentRank = i + 1; // Skip ranks for ties
                }
                playerRanks.get(roundScores[i].player).push(currentRank);
            }
            
            if (roundIndex <= 3) { // Log first few rounds for debugging
                console.log(`📊 Round ${roundIndex} ranks:`, roundScores.slice(0, 5).map(p => `${p.player}: ${p.score} (rank ${playerRanks.get(p.player)[playerRanks.get(p.player).length - 1]})`));
            }
        }

        // Convert to chart format
        const players = Array.from(playerRanks.entries()).map(([name, ranks]) => ({
            name: name,
            ranks: ranks,
            scores: playerScores.get(name).slice(1) // Remove initial 0, keep scores after each round
        }));

        console.log('✅ Final rank progression data:', { rounds, players: players.slice(0, 3) });
        return { rounds, players };
    }

    /**
     * Generate sample rank progression data
     */
    generateSampleRankData() {
        const rounds = [1, 2, 3, 4, 5, 6, 7, 8];
        const players = [
            { name: 'Margaret Wilson', ranks: [2, 1, 1, 1, 1, 1, 1, 1], scores: [8, 15, 23, 31, 39, 47, 55, 63] },
            { name: 'James Ruston', ranks: [5, 4, 3, 2, 2, 2, 2, 2], scores: [6, 13, 22, 30, 38, 46, 54, 61] },
            { name: 'Emma Jones', ranks: [3, 2, 2, 3, 3, 3, 3, 3], scores: [7, 14, 21, 28, 36, 44, 52, 59] },
            { name: 'David Smith', ranks: [1, 3, 4, 4, 4, 4, 4, 4], scores: [9, 12, 20, 27, 35, 43, 51, 58] },
            { name: 'Sarah Brown', ranks: [4, 5, 5, 5, 5, 5, 5, 5], scores: [5, 11, 19, 26, 34, 42, 50, 57] }
        ];

        return { rounds, players };
    }

    /**
     * Get point style for differentiation when lines overlap
     */
    getPointStyle(index) {
        const styles = ['circle', 'triangle', 'rectRot', 'rectRounded', 'cross', 'crossRot', 'star', 'circle', 'triangle', 'rectRot'];
        return styles[index % styles.length];
    }

    /**
     * Fade a color to given opacity
     */
    fadeColor(color, alpha) {
        // Convert hex to rgba with specified alpha
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Destroy chart by ID
     */
    destroyChart(canvasId) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.destroy();
            this.charts.delete(canvasId);
        }
    }

    /**
     * Destroy all charts
     */
    destroyAllCharts() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }

    /**
     * Get chart by ID
     */
    getChart(canvasId) {
        return this.charts.get(canvasId);
    }
}

// Export for use in other scripts
window.TournamentCharts = TournamentCharts;