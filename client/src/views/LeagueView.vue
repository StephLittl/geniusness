<template>
  <div class="league-view">
    <p v-if="loading" class="loading">Loading…</p>
    <template v-else-if="league">
      <header class="header">
        <div>
          <h1>{{ league.name }}</h1>
          <p class="current-date">{{ currentDateFormatted }}</p>
        </div>
        <div v-if="league.invite_code" class="invite">
          <label>Invite code</label>
          <div class="invite-row">
            <code>{{ league.invite_code }}</code>
            <button type="button" @click="copyInvite">Copy</button>
          </div>
        </div>
      </header>

      <!-- Standings at top: short leaderboard + last month in corner -->
      <section v-if="!isPersonalLeague" class="standings-top">
        <div class="standings-leaderboard">
          <h2 class="standings-heading">Standings</h2>
          <p v-if="scoreDateRange && periodOffset !== 0" class="standings-period-label">
            {{ scoreDateRangeLabel }}
          </p>
          <div v-if="periodStandings.length" class="standings-list compact">
            <div
              v-for="(player, idx) in periodStandings"
              :key="player.userId"
              class="standing-row"
              :class="{ 'is-you': player.userId === store.user?.id }"
            >
              <span class="rank">{{ idx + 1 }}</span>
              <span class="player-name">{{ player.username }}</span>
              <span class="player-points">{{ player.totalPoints }} pts</span>
            </div>
          </div>
          <div v-else class="no-standings">No scores yet.</div>
        </div>
        <div v-if="periodOffset === 0" class="yesterday-standings-corner">
          <h3 class="last-month-heading">Yesterday</h3>
          <div v-if="yesterdayStandings.length" class="standings-list compact small">
            <div
              v-for="(player, idx) in yesterdayStandings"
              :key="player.userId"
              class="standing-row"
              :class="{ 'is-you': player.userId === store.user?.id }"
            >
              <span class="rank">{{ idx + 1 }}</span>
              <span class="player-name">{{ player.username }}</span>
              <span class="player-points">{{ player.totalPoints }}</span>
            </div>
          </div>
          <div v-else class="no-standings">—</div>
        </div>
        <div class="last-month-standings-corner">
          <h3 class="last-month-heading">Last month</h3>
          <div v-if="lastMonthStandings.length" class="standings-list compact small">
            <div
              v-for="(player, idx) in lastMonthStandings"
              :key="player.userId"
              class="standing-row"
              :class="{ 'is-you': player.userId === store.user?.id }"
            >
              <span class="rank">{{ idx + 1 }}</span>
              <span class="player-name">{{ player.username }}</span>
              <span class="player-points">{{ player.totalPoints }}</span>
            </div>
          </div>
          <div v-else class="no-standings">—</div>
        </div>
      </section>

      <!-- Current period scores -->
      <section class="score-grid-section">
        <div class="grid-controls">
          <button type="button" @click="goToPreviousPeriod" class="btn btn-nav" :disabled="!canGoOlder">
            ← {{ periodNavLabel.prev }}
          </button>
          <button type="button" @click="goToNextPeriod" class="btn btn-nav" :disabled="periodOffset >= 0">
            {{ periodNavLabel.next }} →
          </button>
          <button v-if="periodOffset !== 0" type="button" @click="goToCurrentPeriod" class="btn btn-current">
            {{ periodNavLabel.current }}
          </button>
          <select
            v-if="periodSelectOptions.length"
            class="period-select"
            :value="periodOffset"
            @change="goToPeriod(Number(($event.target).value))"
          >
            <option v-for="opt in periodSelectOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
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
      standingsLoading: false,
      periodStandings: [],
      yesterdayStandings: [],
      lastMonthStandings: []
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
        if (l.reset_period === 'weekly') return { prev: 'Previous week', next: 'Next week', current: 'Current week' }
        if (l.reset_period === 'monthly') return { prev: 'Previous month', next: 'Next month', current: 'Current month' }
        if (l.reset_period === 'yearly') return { prev: 'Previous year', next: 'Next year', current: 'Current year' }
      }
      return { prev: 'Previous 30 days', next: 'Next 30 days', current: 'Current 30 days' }
    },
    canGoOlder() {
      if (!this.league) return false
      const olderRange = this.getScoreDateRange(this.league, this.periodOffset - 1)
      const start = this.league.start_date
      if (!start) return true
      return olderRange.to > start
    },
    // Options for month/period selector (monthly: "Jan 2026", etc.)
    periodSelectOptions() {
      if (!this.league) return []
      const l = this.league
      const start = l.start_date || this.getEasternDate()
      const opts = []
      if (l.league_type === 'periodic' && l.reset_period === 'monthly') {
        for (let off = 0; off >= -60; off--) {
          const { from } = this.getScoreDateRange(l, off)
          if (from < start) break
          const [y, m] = from.split('-').map(Number)
          const monthName = new Date(y, m - 1, 1).toLocaleString('default', { month: 'short' })
          opts.push({ value: off, label: `${monthName} ${y}` })
        }
        return opts
      }
      if (l.league_type === 'periodic' && l.reset_period === 'weekly') {
        for (let off = 0; off >= -52; off--) {
          const { from, to } = this.getScoreDateRange(l, off)
          if (to < start) break
          opts.push({ value: off, label: `${from} – ${to}` })
        }
        return opts
      }
      if (l.league_type === 'periodic' && l.reset_period === 'yearly') {
        const today = this.getEasternDate()
        const currentYear = Number(today.slice(0, 4))
        const startYear = start ? Number(String(start).slice(0, 4)) : currentYear - 5
        for (let y = currentYear; y >= startYear && y >= currentYear - 10; y--) {
          opts.push({ value: y - currentYear, label: String(y) })
        }
        return opts
      }
      return []
    },
    scoreDateRangeLabel() {
      if (!this.scoreDateRange) return ''
      const { from, to } = this.scoreDateRange
      if (from === to) return from
      return `${from} – ${to}`
    },
    currentDateFormatted() {
      const d = this.getEasternDate()
      if (!d) return ''
      const [y, m, day] = d.split('-').map(Number)
      const date = new Date(y, m - 1, day)
      return date.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' })
    },
    yesterdayDate() {
      return this.addDaysToDate(this.getEasternDate(), -1)
    },
    dateColumns() {
      if (!this.scores.length) return []
      const yesterday = this.periodOffset === 0 ? this.yesterdayDate : null
      const dates = [...new Set(this.scores.map(s => this.normalizeDate(s.date)))]
        .filter(d => !yesterday || d !== yesterday)
        .sort()
        .reverse()
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
              playerScores[this.normalizeDate(score.date)] = score.score
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
      return [...new Set(this.lastMonthScores.map(s => this.normalizeDate(s.date)))].sort().reverse()
    },
    lastMonthGridByGame() {
      if (!this.league?.games || !this.league?.players || !this.lastMonthScores.length) return []
      return this.league.games.map(game => {
        const playerRows = this.league.players.map(player => {
          const playerScores = {}
          for (const score of this.lastMonthScores) {
            if (score.user_id === player.user_id && score.game_id === game.gameid) {
              playerScores[this.normalizeDate(score.date)] = score.score
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
    if (!this.isPersonalLeague) {
      await this.fetchPeriodStandings()
      await this.fetchYesterdayStandings()
      await this.fetchLastMonthStandings()
    }
    this.loading = false
  },
  methods: {
    async fetchPeriodStandings() {
      if (!this.route.params.id || !this.league) return
      try {
        const { from, to } = this.getScoreDateRange(this.league, this.periodOffset)
        const res = await axios.get(`/api/standings/${this.route.params.id}`, { params: { from, to } })
        this.periodStandings = res.data.overallStandings || []
      } catch (err) {
        this.periodStandings = []
      }
    },
    async fetchYesterdayStandings() {
      if (!this.route.params.id || !this.league) return
      try {
        const yesterday = this.yesterdayDate
        const res = await axios.get(`/api/standings/${this.route.params.id}`, { params: { from: yesterday, to: yesterday } })
        this.yesterdayStandings = res.data.overallStandings || []
      } catch (err) {
        this.yesterdayStandings = []
      }
    },
    async fetchLastMonthStandings() {
      if (!this.route.params.id || !this.league) return
      try {
        const { from, to } = this.getScoreDateRange(this.league, -1)
        const res = await axios.get(`/api/standings/${this.route.params.id}`, { params: { from, to } })
        this.lastMonthStandings = res.data.overallStandings || []
      } catch (err) {
        this.lastMonthStandings = []
      }
    },
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
        let { from, to } = this.getScoreDateRange(this.league, this.periodOffset)
        // When viewing current period, include yesterday so "who won yesterday" works
        // (e.g. Feb 1: yesterday is Jan 31, which is in previous month)
        if (this.periodOffset === 0) {
          const yesterday = this.addDaysToDate(this.getEasternDate(), -1)
          if (yesterday < from) from = yesterday
        }
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
    normalizeDate(dateVal) {
      if (dateVal == null) return ''
      const s = String(dateVal)
      return s.length >= 10 ? s.slice(0, 10) : s
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
      if (!dateStr) return ''
      const s = String(dateStr).slice(0, 10)
      const [, month, day] = s.split('-').map(Number)
      if (!month || !day) return s
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
    async goToPreviousPeriod() {
      this.periodOffset -= 1;
      this.scores = [];
      await this.fetchScores();
      if (!this.isPersonalLeague) await this.fetchPeriodStandings();
    },
    async goToNextPeriod() {
      this.periodOffset += 1;
      this.scores = [];
      await this.fetchScores();
      if (!this.isPersonalLeague) await this.fetchPeriodStandings();
    },
    async goToCurrentPeriod() {
      this.periodOffset = 0;
      this.scores = [];
      await this.fetchScores();
      if (!this.isPersonalLeague) await this.fetchPeriodStandings();
    },
    async goToPeriod(offset) {
      if (Number(offset) === this.periodOffset) return;
      this.periodOffset = Number(offset);
      this.scores = [];
      await this.fetchScores();
      if (!this.isPersonalLeague) await this.fetchPeriodStandings();
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
.current-date {
  margin: 0.25rem 0 0 0;
  font-size: 0.9rem;
  color: #666;
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
.score-grid-section {
  margin-bottom: 2rem;
  min-width: 0;
}
.grid-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
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
.btn-nav {
  min-width: 8rem;
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
.period-select {
  margin-left: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #4a7c59;
  background: white;
  color: #2d5a3d;
  font-size: 0.9rem;
  cursor: pointer;
}
.period-select:focus {
  outline: none;
  border-color: #2d5a3d;
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
/* Standings at top: short leaderboard + last month in corner */
.standings-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}
.standings-leaderboard {
  max-width: 280px;
  flex-shrink: 0;
}
.standings-heading {
  margin: 0 0 0.25rem 0;
  font-size: 1.1rem;
  color: #2d5a3d;
}
.standings-period-label {
  font-size: 0.8rem;
  color: #666;
  margin: 0 0 0.5rem 0;
}
.yesterday-standings-corner,
.last-month-standings-corner {
  max-width: 180px;
  padding: 0.5rem 0.75rem;
  background: #f8f8f8;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}
.last-month-heading {
  margin: 0 0 0.35rem 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #666;
}
.standings-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.standings-list.compact .standing-row {
  padding: 0.35rem 0.5rem;
  gap: 0.5rem;
}
.standings-list.compact.small {
  font-size: 0.8rem;
}
.standings-list.compact.small .standing-row {
  padding: 0.25rem 0.35rem;
  gap: 0.35rem;
  grid-template-columns: 18px 1fr auto;
}
.standings-list.compact.small .standing-row .rank {
  font-size: 0.8rem;
}
.standings-list.compact.small .standing-row .player-points {
  font-size: 0.8rem;
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
  font-size: 0.9rem;
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
