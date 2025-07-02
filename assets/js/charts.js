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
                        if (playerScores.has(player)) {
                            const scores = playerScores.get(player);
                            const previousScore = scores[scores.length - 1] || 0;
                            scores.push(previousScore + partnership.tricks);
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
            this.colors.cardBlack,    // #f8fafc - Soft white
            this.colors.silver,       // #cbd5e1 - Warm silver
            this.colors.bronze,       // #a16207 - Warm bronze
            '#059669',               // Forest green
            '#7c3aed',               // Purple
            '#0891b2',               // Teal
            '#65a30d'                // Olive green
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