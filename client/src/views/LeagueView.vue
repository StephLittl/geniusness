<template>
  <div class="league-view">
    <p v-if="loading" class="loading">Loading…</p>
    <template v-else-if="league">
      <header class="header">
        <div>
          <h1>{{ league.name }}</h1>
        </div>
        <div v-if="league.invite_code" class="invite">
          <label>Invite code</label>
          <div class="invite-row">
            <code>{{ league.invite_code }}</code>
            <button type="button" @click="copyInvite">Copy</button>
          </div>
        </div>
      </header>

      <!-- Who won yesterday (when viewing current period) – always show above scores box -->
      <p v-if="periodOffset === 0" class="yesterday-winners">
        {{ yesterdayWinnersText || 'Yesterday: No scores yet.' }}
      </p>

      <!-- Current period scores (at top) -->
      <section class="score-grid-section">
        <div class="grid-controls">
          <button type="button" @click="goToPreviousPeriod" class="btn" :disabled="!canGoOlder">
            ← {{ periodNavLabel.prev }}
          </button>
          <button v-if="periodOffset !== 0" type="button" @click="goToCurrentPeriod" class="btn btn-current">
            {{ periodNavLabel.current }}
          </button>
          <button type="button" @click="goToNextPeriod" class="btn" :disabled="periodOffset >= 0">
            {{ periodNavLabel.next }} →
          </button>
        </div>
        <div v-if="!scores.length" class="empty">No scores in this period.</div>
        <div v-else class="grid-scroll-box">
          <div v-for="section in gridByGame" :key="section.gameId" class="game-block">
            <h3 class="game-block-title" :style="{ color: section.gameColor || '#333' }">{{ section.gameName }}</h3>
            <table class="score-grid">
              <thead>
                <tr>
                  <th class="sticky-col">Player</th>
                  <th v-for="date in dateColumns" :key="date" class="date-col">{{ formatDate(date) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in section.playerRows" :key="row.key">
                  <td class="sticky-col row-label">{{ row.playerName }}</td>
                  <td
                    v-for="date in dateColumns"
                    :key="date"
                    class="score-cell"
                    :style="getScoreCellStyle(section.gameId, section.gameColor, date, row)"
                  >
                    <span v-if="row.scores[date] !== undefined">{{ row.scores[date] }}</span>
                    <span v-else class="empty-cell">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Last month's scores (compact) -->
      <section v-if="lastMonthScores.length" class="last-month-section">
        <h3 class="last-month-title">Last month</h3>
        <div class="grid-scroll-box last-month-box">
          <div v-for="section in lastMonthGridByGame" :key="section.gameId" class="game-block">
            <h4 class="game-block-title" :style="{ color: section.gameColor || '#333' }">{{ section.gameName }}</h4>
            <table class="score-grid score-grid-compact">
              <thead>
                <tr>
                  <th class="sticky-col">Player</th>
                  <th v-for="date in lastMonthDateColumns" :key="date" class="date-col">{{ formatDate(date) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in section.playerRows" :key="row.key">
                  <td class="sticky-col row-label">{{ row.playerName }}</td>
                  <td
                    v-for="date in lastMonthDateColumns"
                    :key="date"
                    class="score-cell"
                    :style="getScoreCellStyleForScores(section, date, row, lastMonthRankByGameAndDate)"
                  >
                    <span v-if="row.scores[date] !== undefined">{{ row.scores[date] }}</span>
                    <span v-else class="empty-cell">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Standings (hidden for Personal league) -->
      <section v-if="!isPersonalLeague" class="standings-section">
        <h2>Standings</h2>
        <div v-if="standingsLoading" class="loading">Loading standings…</div>
        <div v-else-if="standings.overallStandings?.length" class="standings-block">
          <h3>Overall</h3>
          <div class="standings-list">
            <div
              v-for="(player, idx) in standings.overallStandings"
              :key="player.userId"
              class="standing-row"
              :class="{ 'is-you': player.userId === store.user?.id }"
            >
              <span class="rank">{{ idx + 1 }}</span>
              <span class="player-name">{{ player.username }}</span>
              <span class="player-points">{{ player.totalPoints }} pts</span>
            </div>
          </div>
        </div>
        <div v-else class="no-standings">No scores yet.</div>
      </section>

      <p><router-link to="/leagues">← Back to leagues</router-link></p>
    </template>
    <p v-else class="error">League not found.</p>
  </div>
</template>

<script>
import { useRoute } from 'vue-router'
import { useUserStore } from '../store/userStore'
import axios from 'axios'

export default {
  data() {
    return {
      league: null,
      scores: [],
      lastMonthScores: [],
      loading: true,
      periodOffset: 0,
      standings: {},
      standingsLoading: false
    }
  },
  setup() {
    const route = useRoute()
    const store = useUserStore()
    return { route, store }
  },
  computed: {
    isPersonalLeague() {
      return (this.league?.name || '').toLowerCase() === 'personal'
    },
    scoreDateRange() {
      if (!this.league) return null
      return this.getScoreDateRange(this.league, this.periodOffset)
    },
    periodNavLabel() {
      const l = this.league
      if (!l) return { prev: 'Previous', next: 'Next', current: 'Current period' }
      if (l.league_type === 'periodic' && l.reset_period) {
        if (l.reset_period === 'weekly') return { prev: 'Previous week', next: 'Next week', current: 'This week' }
        if (l.reset_period === 'monthly') return { prev: 'Previous month', next: 'Next month', current: 'This month' }
        if (l.reset_period === 'yearly') return { prev: 'Previous year', next: 'Next year', current: 'This year' }
      }
      return { prev: 'Previous 30 days', next: 'Next 30 days', current: 'Last 30 days' }
    },
    canGoOlder() {
      if (!this.league) return false
      const olderRange = this.getScoreDateRange(this.league, this.periodOffset - 1)
      const start = this.league.start_date
      if (!start) return true
      return olderRange.to > start
    },
    scoreDateRangeLabel() {
      if (!this.scoreDateRange) return ''
      const { from, to } = this.scoreDateRange
      if (from === to) return from
      return `${from} – ${to}`
    },
    yesterdayDate() {
      return this.addDaysToDate(this.getEasternDate(), -1)
    },
    // When viewing current period: who won yesterday per game and daily winner
    yesterdayWinnersText() {
      if (this.periodOffset !== 0 || !this.league?.games?.length || !this.scores.length) return ''
      const yesterday = this.yesterdayDate
      const dayScores = this.scores.filter(s => s.date === yesterday)
      if (!dayScores.length) return ''
      const parts = []
      const gameMap = Object.fromEntries((this.league.games || []).map(g => [g.gameid, g]))
      for (const game of this.league.games) {
        const gs = dayScores.filter(s => s.game_id === game.gameid)
        if (gs.length === 0) continue
        const isLowerBetter = game.score_type !== 'higher_better'
        gs.sort((a, b) => isLowerBetter ? Number(a.score) - Number(b.score) : Number(b.score) - Number(a.score))
        const winnerId = gs[0].user_id
        const winner = this.league.players?.find(p => p.user_id === winnerId)
        const name = winner?.username || winner?.email || '—'
        parts.push(`${game.name} — ${name}`)
      }
      if (parts.length === 0) return ''
      // Daily winner: lowest sum of rank points (1st=1, etc.) across games
      const userIds = [...new Set(dayScores.map(s => s.user_id))]
      const pointsByUser = Object.fromEntries(userIds.map(id => [id, 0]))
      for (const game of this.league.games) {
        const gs = dayScores.filter(s => s.game_id === game.gameid).slice()
        if (gs.length === 0) continue
        const isLowerBetter = game.score_type !== 'higher_better'
        gs.sort((a, b) => isLowerBetter ? Number(a.score) - Number(b.score) : Number(b.score) - Number(a.score))
        let rank = 1
        let prevScore = null
        for (let i = 0; i < gs.length; i++) {
          if (prevScore != null && gs[i].score !== prevScore) rank = i + 1
          prevScore = gs[i].score
          pointsByUser[gs[i].user_id] = (pointsByUser[gs[i].user_id] || 0) + rank
        }
      }
      const minPoints = Math.min(...Object.values(pointsByUser).filter(p => p > 0))
      const dailyWinnerId = userIds.find(id => pointsByUser[id] === minPoints)
      const dailyWinner = this.league.players?.find(p => p.user_id === dailyWinnerId)
      const dailyName = dailyWinner?.username || dailyWinner?.email || '—'
      return `Yesterday: ${parts.join('; ')}. Daily: ${dailyName}.`
    },
    dateColumns() {
      if (!this.scores.length) return []
      const dates = [...new Set(this.scores.map(s => s.date))].sort().reverse()
      return dates
    },
    gridRows() {
      if (!this.league?.games || !this.league?.players || !this.scores.length) return []
      const rows = []
      for (const player of this.league.players) {
        for (const game of this.league.games) {
          const key = `${player.user_id}-${game.gameid}`
          const playerScores = {}
          for (const score of this.scores) {
            if (score.user_id === player.user_id && score.game_id === game.gameid) {
              playerScores[score.date] = score.score
            }
          }
          rows.push({
            key,
            playerName: player.username || player.email || '—',
            gameName: game.name,
            gameColor: game.color,
            scores: playerScores
          })
        }
      }
      return rows
    },
    // Group by game, then list players (for score grid)
    gridByGame() {
      if (!this.league?.games || !this.league?.players || !this.scores.length) return []
      return this.league.games.map(game => {
        const playerRows = this.league.players.map(player => {
          const playerScores = {}
          for (const score of this.scores) {
            if (score.user_id === player.user_id && score.game_id === game.gameid) {
              playerScores[score.date] = score.score
            }
          }
          return {
            key: `${player.user_id}-${game.gameid}`,
            playerName: player.username || player.email || '—',
            scores: playerScores
          }
        })
        return {
          gameId: game.gameid,
          gameName: game.name,
          gameColor: game.color,
          scoreType: game.score_type || 'lower_better',
          playerRows
        }
      })
    },
    // Per-game, per-date rank (1 = best). Uses game score_type: lower_better or higher_better.
    rankByGameAndDate() {
      if (!this.league?.games || !this.dateColumns.length) return {}
      const out = {}
      for (const section of this.gridByGame) {
        const isLowerBetter = section.scoreType !== 'higher_better'
        out[section.gameId] = {}
        for (const date of this.dateColumns) {
          const entries = section.playerRows
            .map(row => ({ key: row.key, score: row.scores[date] }))
            .filter(e => e.score !== undefined)
          entries.sort((a, b) =>
            isLowerBetter
              ? Number(a.score) - Number(b.score)
              : Number(b.score) - Number(a.score)
          )
          let rank = 1
          let prevScore = null
          out[section.gameId][date] = {}
          for (let i = 0; i < entries.length; i++) {
            if (prevScore !== null && entries[i].score !== prevScore) rank = i + 1
            prevScore = entries[i].score
            out[section.gameId][date][entries[i].key] = rank
          }
        }
      }
      return out
    },
    lastMonthDateColumns() {
      if (!this.lastMonthScores.length) return []
      return [...new Set(this.lastMonthScores.map(s => s.date))].sort().reverse()
    },
    lastMonthGridByGame() {
      if (!this.league?.games || !this.league?.players || !this.lastMonthScores.length) return []
      return this.league.games.map(game => {
        const playerRows = this.league.players.map(player => {
          const playerScores = {}
          for (const score of this.lastMonthScores) {
            if (score.user_id === player.user_id && score.game_id === game.gameid) {
              playerScores[score.date] = score.score
            }
          }
          return {
            key: `${player.user_id}-${game.gameid}`,
            playerName: player.username || player.email || '—',
            scores: playerScores
          }
        })
        return {
          gameId: game.gameid,
          gameName: game.name,
          gameColor: game.color,
          scoreType: game.score_type || 'lower_better',
          playerRows
        }
      })
    },
    lastMonthRankByGameAndDate() {
      if (!this.lastMonthGridByGame.length || !this.lastMonthDateColumns.length) return {}
      const out = {}
      for (const section of this.lastMonthGridByGame) {
        const isLowerBetter = section.scoreType !== 'higher_better'
        out[section.gameId] = {}
        for (const date of this.lastMonthDateColumns) {
          const entries = section.playerRows
            .map(row => ({ key: row.key, score: row.scores[date] }))
            .filter(e => e.score !== undefined)
          entries.sort((a, b) =>
            isLowerBetter ? Number(a.score) - Number(b.score) : Number(b.score) - Number(a.score)
          )
          let rank = 1
          let prevScore = null
          out[section.gameId][date] = {}
          for (let i = 0; i < entries.length; i++) {
            if (prevScore !== null && entries[i].score !== prevScore) rank = i + 1
            prevScore = entries[i].score
            out[section.gameId][date][entries[i].key] = rank
          }
        }
      }
      return out
    }
  },
  async created() {
    await this.fetchLeague()
    await this.fetchScores()
    await this.fetchLastMonthScores()
    if (!this.isPersonalLeague) await this.fetchStandings()
    this.loading = false
  },
  methods: {
    async fetchStandings() {
      if (!this.route.params.id) return
      this.standingsLoading = true
      try {
        const res = await axios.get(`/api/standings/${this.route.params.id}`)
        this.standings = {
          overallStandings: res.data.overallStandings || [],
          dailyStandings: res.data.dailyStandings || {},
          gameStandings: res.data.gameStandings || {}
        }
      } catch (err) {
        this.standings = {}
      } finally {
        this.standingsLoading = false
      }
    },
    async fetchLeague() {
      try {
        const res = await axios.get(`/api/league/${this.route.params.id}`)
        this.league = res.data
        this.periodOffset = 0
      } catch (err) {
        this.league = null
      }
    },
    async fetchScores() {
      if (!this.league) return
      try {
        const { from, to } = this.getScoreDateRange(this.league, this.periodOffset)
        const params = { from, to }
        const res = await axios.get(`/api/scores/league/${this.route.params.id}`, { params })
        this.scores = res.data.scores || []
      } catch (err) {
        this.scores = []
      }
    },
    async fetchLastMonthScores() {
      if (!this.league) return
      try {
        const { from, to } = this.getScoreDateRange(this.league, -1)
        const params = { from, to }
        const res = await axios.get(`/api/scores/league/${this.route.params.id}`, { params })
        this.lastMonthScores = res.data.scores || []
      } catch (err) {
        this.lastMonthScores = []
      }
    },
    addDaysToDate(dateStr, delta) {
      const [y, m, d] = dateStr.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      date.setDate(date.getDate() + delta)
      const yy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${yy}-${mm}-${dd}`
    },
    copyInvite() {
      if (!this.league?.invite_code) return
      navigator.clipboard?.writeText(this.league.invite_code).catch(() => {})
    },
    formatDate(dateStr) {
      // Parse date string (YYYY-MM-DD), output M/D to fit in small box
      const [, month, day] = dateStr.split('-').map(Number)
      return `${month}/${day}`
    },
    getScoreCellStyle(gameId, gameColor, date, row) {
      const ranks = this.rankByGameAndDate[gameId]?.[date]
      const rank = ranks?.[row.key]
      if (rank == null || !gameColor) return {}
      const bg = this.getShadeForRank(gameColor, rank)
      return bg ? { backgroundColor: bg } : {}
    },
    getScoreCellStyleForScores(section, date, row, rankMap) {
      const ranks = rankMap?.[section.gameId]?.[date]
      const rank = ranks?.[row.key]
      if (rank == null || !section.gameColor) return {}
      const bg = this.getShadeForRank(section.gameColor, rank)
      return bg ? { backgroundColor: bg } : {}
    },
    // Rank 1 = darkest, 2/3/4 = progressively lighter. Lower score = better (rank 1).
    getShadeForRank(hexColor, rank) {
      const hex = (hexColor || '').replace(/^#/, '')
      if (!hex) return ''
      let r, g, b
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16)
        g = parseInt(hex[1] + hex[1], 16)
        b = parseInt(hex[2] + hex[2], 16)
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16)
        g = parseInt(hex.slice(2, 4), 16)
        b = parseInt(hex.slice(4, 6), 16)
      } else return ''
      const t = Math.min(rank, 4); // 1=darkest, 4=lightest
      const blend = [0, 0.25, 0.5, 0.75][t - 1] ?? 0.75 // mix with white
      r = Math.round(r * (1 - blend) + 255 * blend)
      g = Math.round(g * (1 - blend) + 255 * blend)
      b = Math.round(b * (1 - blend) + 255 * blend)
      return `rgb(${r},${g},${b})`
    },
    getEasternDate() {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(now);
    },
    // Date range for score grid. periodOffset: 0 = current, -1 = previous period, 1 = next (toward current)
    getScoreDateRange(league, periodOffset = 0) {
      const today = this.getEasternDate();
      const startDate = league.start_date || today;
      const endDate = league.end_date || today;

      const addDays = (dateStr, delta) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + delta);
        const yy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      };

      const fmt = (d) => {
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      };

      if (league.league_type === 'periodic' && league.reset_period) {
        const [y, m, d] = today.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        let from, to;
        if (league.reset_period === 'weekly') {
          const dayOfWeek = date.getDay();
          const sun = new Date(date);
          sun.setDate(sun.getDate() - dayOfWeek + (periodOffset * 7));
          const sat = new Date(sun);
          sat.setDate(sat.getDate() + 6);
          from = fmt(sun);
          to = fmt(sat);
          if (periodOffset === 0 && to > today) to = today;
          if (periodOffset > 0) { from = today; to = today; }
        } else if (league.reset_period === 'monthly') {
          const ref = new Date(y, m - 1 + periodOffset, 1);
          const refY = ref.getFullYear();
          const refM = ref.getMonth();
          from = fmt(new Date(refY, refM, 1));
          const lastDay = new Date(refY, refM + 1, 0);
          to = fmt(lastDay);
          if (periodOffset === 0 && to > today) to = today;
          if (periodOffset > 0) { from = today; to = today; }
        } else if (league.reset_period === 'yearly') {
          const refY = y + periodOffset;
          from = fmt(new Date(refY, 0, 1));
          to = fmt(new Date(refY, 11, 31));
          if (periodOffset === 0 && to > today) to = today;
          if (periodOffset > 0) { from = today; to = today; }
        } else {
          from = addDays(today, -29 + (periodOffset * 30));
          to = addDays(today, periodOffset * 30);
          if (periodOffset === 0) to = today;
          if (periodOffset > 0) { from = today; to = today; }
        }
        from = from < startDate ? startDate : from;
        to = endDate && to > endDate ? endDate : to;
        if (from > to) from = to;
        return { from, to };
      }

      const from = addDays(today, -29 + (periodOffset * 30));
      const to = periodOffset === 0 ? today : addDays(today, periodOffset * 30);
      let fromClamped = from < startDate ? startDate : from;
      let toClamped = endDate && to > endDate ? endDate : to;
      if (periodOffset > 0) toClamped = today;
      if (fromClamped > toClamped) fromClamped = toClamped;
      return { from: fromClamped, to: toClamped };
    },
    goToPreviousPeriod() {
      this.periodOffset -= 1;
      this.fetchScores();
    },
    goToNextPeriod() {
      this.periodOffset += 1;
      this.fetchScores();
    },
    goToCurrentPeriod() {
      this.periodOffset = 0;
      this.fetchScores();
    }
  }
}
</script>

<style scoped>
.league-view {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 0 auto;
  text-align: left;
  overflow-x: hidden; /* keep scroll box from pushing page width */
}
.loading,
.error {
  margin: 2rem 0;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.invite {
  margin-top: 0.5rem;
}
.invite label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
}
.invite-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.invite-row code {
  padding: 0.35rem 0.5rem;
  background: #f0f8f0;
  border-radius: 6px;
  color: #2d5a3d;
}
.yesterday-winners {
  font-size: 0.9rem;
  color: #333;
  margin: 0 0 1rem 0;
}
.score-grid-section {
  margin-bottom: 2rem;
  min-width: 0;
}
.grid-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #4a7c59;
  background: white;
  color: #2d5a3d;
  cursor: pointer;
}
.btn:hover {
  background: #f0f8f0;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-current {
  background: #2d5a3d;
  color: white;
  border-color: #2d5a3d;
}
.btn-current:hover {
  background: #1e3d28;
}
.error {
  color: #e74;
  margin-top: 0.5rem;
}
/* Scroll contained in a box; page does not scroll with the grid */
/* Cap width to viewport minus sidebar (220px) and main padding (4rem) so it never goes off-screen */
.grid-scroll-box {
  width: 100%;
  max-width: min(100%, calc(100vw - 220px - 4rem));
  min-width: 0;
  max-height: 70vh;
  overflow: auto;
  border: 1px solid #444;
  border-radius: 8px;
  background: #fff;
  box-sizing: border-box;
}
.game-block {
  margin-bottom: 1rem;
}
.game-block:last-child {
  margin-bottom: 0;
}
.game-block-title {
  margin: 0;
  padding: 0.35rem 0.5rem 0.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}
.score-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  table-layout: fixed; /* uniform column widths */
}
.score-grid th,
.score-grid td {
  width: 40px; /* same size for all date/score boxes */
  max-width: 40px;
  padding: 0.2rem 0.25rem;
  text-align: center;
  border: 1px solid #4a7c59;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.score-grid th {
  background: #2d5a3d;
  color: white;
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 1;
}
.sticky-col {
  position: sticky;
  left: 0;
  background: white;
  z-index: 2;
  text-align: left;
  box-shadow: 1px 0 0 #4a7c59;
}
.score-grid th.sticky-col,
.score-grid td.sticky-col {
  width: 80px;
  max-width: 80px;
}
.score-grid th.sticky-col {
  background: #2d5a3d;
  color: white;
  z-index: 3;
  box-shadow: 1px 0 0 rgba(255,255,255,0.2);
}
.row-label {
  font-size: 0.75rem;
}
.date-col {
  font-size: 0.65rem;
}
.score-cell {
  font-size: 0.75rem;
}
.empty-cell {
  color: #999;
}
.last-month-section {
  margin-bottom: 2rem;
}
.last-month-title {
  font-size: 1rem;
  margin: 0 0 0.5rem 0;
  color: #2d5a3d;
}
.last-month-box {
  max-height: 40vh;
  font-size: 0.75rem;
}
.score-grid-compact.score-grid th,
.score-grid-compact.score-grid td {
  padding: 0.15rem 0.2rem;
  font-size: 0.7rem;
}
.score-grid-compact .row-label {
  font-size: 0.7rem;
}
.score-grid-compact .date-col {
  min-width: 32px;
  font-size: 0.65rem;
}
.score-grid-compact .score-cell {
  min-width: 24px;
}
.standings-section {
  margin-bottom: 2rem;
}
.standings-section h2 {
  margin-bottom: 0.5rem;
}
.standings-block h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: #2d5a3d;
}
.standings-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.standing-row {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
}
.standing-row:hover {
  background: #f0f8f0;
}
.standing-row.is-you {
  background: #e8f5e9;
  font-weight: 500;
}
.standing-row .rank {
  font-weight: bold;
  color: #2d5a3d;
}
.standing-row .player-name {
  color: #333;
}
.standing-row .player-points {
  font-weight: 500;
  color: #2d5a3d;
}
.no-standings {
  color: #666;
  font-style: italic;
}
.empty {
  color: #666;
  margin: 2rem 0;
  text-align: center;
}
.error {
  color: #c00;
}
</style>
