<template>
  <div class="home-page">
    <div class="main-content">
      <h1>Daily Scores</h1>
      <p class="greeting">Hi, {{ user?.username || user?.email || 'there' }}.</p>

      <section v-if="loading" class="loading">Loading…</section>
      <template v-else>
        <!-- Daily Score Entry -->
        <section class="daily-scores">
          <div class="section-header">
            <h2>Enter Today's Scores</h2>
          </div>
          
          <div v-if="userGames.length === 0" class="empty">
            <p>No games selected. <router-link to="/games/select">Select your games</router-link></p>
          </div>
          <div v-else class="score-entries">
            <div v-for="game in userGames" :key="game.gameid" class="score-entry" :style="{ borderLeftColor: game.color || '#4a7c59' }">
              <div v-if="!todayScoresByGame[game.gameid]" class="entry-form">
                <div class="game-header">
                  <label>{{ game.name }}</label>
                  <div class="info-tooltip" v-if="game.scoring_info">
                    <span class="info-icon">ℹ️</span>
                    <div class="tooltip-content">{{ game.scoring_info }}</div>
                  </div>
                </div>
                <div v-if="hasParseOption(game.slug)" class="entry-mode-toggle">
                  <button
                    type="button"
                    @click="scoreForms[game.gameid].entryMode = 'manual'"
                    :class="{ active: scoreForms[game.gameid].entryMode !== 'paste' }"
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    @click="scoreForms[game.gameid].entryMode = 'paste'"
                    :class="{ active: scoreForms[game.gameid].entryMode === 'paste' }"
                  >
                    Paste Share
                  </button>
                </div>
                <div v-if="scoreForms[game.gameid].entryMode !== 'paste'" class="input-row">
                  <!-- Time input (minutes/seconds) for Crossword and Pyramid Scheme -->
                  <template v-if="getInputType(game.slug) === 'time'">
                    <div class="time-inputs">
                      <input
                        v-model.number="scoreForms[game.gameid].minutes"
                        type="number"
                        min="0"
                        placeholder="Min"
                        class="no-spinner time-input"
                      />
                      <span>:</span>
                      <input
                        v-model.number="scoreForms[game.gameid].seconds"
                        type="number"
                        min="0"
                        max="59"
                        placeholder="Sec"
                        class="no-spinner time-input"
                      />
                    </div>
                    <button
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="!scoreForms[game.gameid].minutes && !scoreForms[game.gameid].seconds"
                    >
                      Save
                    </button>
                  </template>
                  <!-- Keyword input (time + errors) -->
                  <template v-else-if="getInputType(game.slug) === 'keyword'">
                    <div class="keyword-inputs">
                      <input
                        v-model.number="scoreForms[game.gameid].time"
                        type="number"
                        min="0"
                        placeholder="Time (seconds)"
                        class="no-spinner"
                      />
                      <input
                        v-model.number="scoreForms[game.gameid].errors"
                        type="number"
                        min="0"
                        placeholder="Errors"
                        class="no-spinner"
                      />
                    </div>
                    <button
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="(scoreForms[game.gameid].time == null || scoreForms[game.gameid].time === '') && (scoreForms[game.gameid].errors == null || scoreForms[game.gameid].errors === '')"
                    >
                      Save
                    </button>
                  </template>
                  <!-- Spelling Bee input (0, 1, or 2) -->
                  <template v-else-if="getInputType(game.slug) === 'spelling_bee'">
                    <select v-model="scoreForms[game.gameid].rank" class="spelling-bee-select">
                      <option value="">Select rank</option>
                      <option value="0">No Genius</option>
                      <option value="1">Genius</option>
                      <option value="2">Queen Bee</option>
                    </select>
                    <button
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="scoreForms[game.gameid].rank === ''"
                    >
                      Save
                    </button>
                  </template>
                  <!-- Standard score input -->
                  <template v-else>
                    <input
                      v-model.number="scoreForms[game.gameid].score"
                      type="number"
                      step="any"
                      placeholder="Enter score"
                      required
                      class="no-spinner"
                    />
                    <button
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="scoreForms[game.gameid].score == null || scoreForms[game.gameid].score === ''"
                    >
                      Save
                    </button>
                  </template>
                </div>
                <div v-else-if="hasParseOption(game.slug)" class="paste-row">
                  <textarea
                    v-model="scoreForms[game.gameid].shareText"
                    placeholder="Paste share text here..."
                    rows="3"
                  ></textarea>
                  <button
                    type="button"
                    @click="parseAndSave(game.gameid)"
                    :disabled="!scoreForms[game.gameid].shareText"
                  >
                    Parse & Save
                  </button>
                </div>
              </div>
              <div v-else class="entered-score">
                <div class="score-info">
                  <div class="game-header">
                    <strong :style="{ color: game.color || '#2d5a3d' }">{{ game.name }}</strong>
                    <div class="info-tooltip" v-if="game.scoring_info">
                      <span class="info-icon">ℹ️</span>
                      <div class="tooltip-content">{{ game.scoring_info }}</div>
                    </div>
                  </div>
                  <span class="score-value" :style="{ color: game.color || '#2d5a3d' }">{{ formatScore(todayScoresByGame[game.gameid].score, game.slug) }}</span>
                  <div class="league-names">
                    <span v-for="leagueName in getLeagueNamesForGame(game.gameid)" :key="leagueName" class="league-tag">
                      {{ leagueName }}
                    </span>
                  </div>
                </div>
                <button type="button" @click="showReenter(game.gameid)" class="reenter-btn">
                  Re-enter
                </button>
                <div v-if="reenteringGame === game.gameid" class="reenter-form">
                <div class="entry-mode-toggle" v-if="hasParseOption(userGames.find(g => g.gameid === reenteringGame)?.slug)">
                  <button
                    type="button"
                    @click="reenterForm.entryMode = 'manual'"
                    :class="{ active: reenterForm.entryMode !== 'paste' }"
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    @click="reenterForm.entryMode = 'paste'"
                    :class="{ active: reenterForm.entryMode === 'paste' }"
                  >
                    Paste Share
                  </button>
                </div>
                  <div v-if="reenterForm.entryMode !== 'paste'">
                    <template v-if="getInputType(userGames.find(g => g.gameid === reenteringGame)?.slug) === 'time'">
                      <div class="time-inputs">
                        <input
                          v-model.number="reenterForm.minutes"
                          type="number"
                          min="0"
                          placeholder="Min"
                          class="no-spinner time-input"
                        />
                        <span>:</span>
                        <input
                          v-model.number="reenterForm.seconds"
                          type="number"
                          min="0"
                          max="59"
                          placeholder="Sec"
                          class="no-spinner time-input"
                        />
                      </div>
                    </template>
                    <template v-else-if="getInputType(userGames.find(g => g.gameid === reenteringGame)?.slug) === 'keyword'">
                      <div class="keyword-inputs">
                        <input
                          v-model.number="reenterForm.time"
                          type="number"
                          min="0"
                          placeholder="Time (seconds)"
                          class="no-spinner"
                        />
                        <input
                          v-model.number="reenterForm.errors"
                          type="number"
                          min="0"
                          placeholder="Errors"
                          class="no-spinner"
                        />
                      </div>
                    </template>
                    <template v-else-if="getInputType(userGames.find(g => g.gameid === reenteringGame)?.slug) === 'spelling_bee'">
                      <select v-model="reenterForm.rank" class="spelling-bee-select">
                        <option value="">Select rank</option>
                        <option value="0">No Genius</option>
                        <option value="1">Genius</option>
                        <option value="2">Queen Bee</option>
                      </select>
                    </template>
                    <template v-else>
                      <input
                        v-model.number="reenterForm.score"
                        type="number"
                        step="any"
                        placeholder="Score"
                        required
                        class="no-spinner"
                      />
                    </template>
                  </div>
                  <div v-else-if="hasParseOption(userGames.find(g => g.gameid === reenteringGame)?.slug)">
                    <textarea
                      v-model="reenterForm.shareText"
                      placeholder="Paste share text here..."
                      rows="3"
                    ></textarea>
                  </div>
                  <div class="reenter-actions">
                    <button type="button" @click="updateScore(game.gameid)">Update</button>
                    <button type="button" @click="cancelReenter">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>

    <!-- Leagues Sidebar -->
    <aside class="leagues-sidebar">
      <h2>My Leagues</h2>
      <div v-if="leagues.length === 0" class="empty-sidebar">
        <p>No leagues yet.</p>
        <router-link to="/leagues/create" class="btn-link">Create one</router-link>
      </div>
      <div v-else class="leagues-list-sidebar">
        <div v-for="league in leagues" :key="league.leagueid" class="league-item-sidebar">
          <router-link :to="`/leagues/${league.leagueid}`" class="league-link">
            {{ league.name }}
          </router-link>
          <div class="league-standings-preview">
            <div class="overall-preview">
              <span class="preview-label">Leader:</span>
              <span class="top-player">
                {{ getTopPlayer(league.leagueid) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="sidebar-actions">
        <router-link to="/leagues/create" class="btn-link">Create League</router-link>
        <router-link to="/leagues/join" class="btn-link">Join League</router-link>
      </div>
    </aside>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'
import { useUserStore } from '../store/userStore'
import { storeToRefs } from 'pinia'
import axios from 'axios'

export default {
  data() {
    return {
      leagues: [],
      userGames: [],
      todayScores: [],
      loading: true,
      scoreForms: {},
      reenteringGame: null,
      reenterForm: { score: '' },
      leagueStandings: {}
    }
  },
  setup() {
    const store = useUserStore()
    const { user } = storeToRefs(store)
    return { store, user }
  },
  computed: {
    todayScoresByGame() {
      const map = {}
      for (const s of this.todayScores) {
        if (map[s.game_id]) {
          if (!map[s.game_id].leagues) {
            map[s.game_id].leagues = [map[s.game_id].league]
          }
          if (s.league && !map[s.game_id].leagues.some(l => l?.name === s.league?.name)) {
            map[s.game_id].leagues.push(s.league)
          }
        } else {
          map[s.game_id] = { ...s, leagues: s.league ? [s.league] : [] }
        }
      }
      return map
    }
  },
  async created() {
    if (!this.store.user?.id) return
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      try {
        const [leaguesRes, gamesRes, scoresRes] = await Promise.all([
          axios.get('/api/league/my', { params: { userId: this.store.user.id } }),
          axios.get(`/api/user-games/${this.store.user.id}`),
          axios.get(`/api/scores/today/${this.store.user.id}`)
        ])
        this.leagues = leaguesRes.data.leagues || []
        this.userGames = gamesRes.data.games || []
        this.todayScores = scoresRes.data.scores || []
        this.initScoreForms()
        await this.loadStandings()
      } catch (err) {
        console.error(err)
      } finally {
        this.loading = false
      }
    },
    initScoreForms() {
      const forms = {}
      for (const game of this.userGames) {
        const inputType = this.getInputType(game.slug)
        if (inputType === 'time') {
          forms[game.gameid] = { minutes: '', seconds: '', entryMode: 'manual', shareText: '' }
        } else if (inputType === 'keyword') {
          forms[game.gameid] = { time: '', errors: '', entryMode: 'manual', shareText: '' }
        } else if (inputType === 'spelling_bee') {
          forms[game.gameid] = { rank: '', entryMode: 'manual', shareText: '' }
        } else {
          forms[game.gameid] = { score: '', entryMode: 'manual', shareText: '' }
        }
      }
      this.scoreForms = forms
    },
    getInputType(slug) {
      if (['crossword', 'pyramid-scheme'].includes(slug)) return 'time'
      if (slug === 'keyword') return 'keyword'
      if (slug === 'spelling-bee') return 'spelling_bee'
      return 'score'
    },
    hasParseOption(slug) {
      return !['crossword', 'keyword'].includes(slug)
    },
    async loadStandings() {
      const standings = {}
      for (const league of this.leagues) {
        try {
          const res = await axios.get(`/api/standings/${league.leagueid}`)
          standings[league.leagueid] = {
            overall: res.data.overallStandings || []
          }
        } catch (err) {
          console.error(err)
          standings[league.leagueid] = { overall: [] }
        }
      }
      this.leagueStandings = standings
    },
    getTopPlayer(leagueId) {
      const standings = this.leagueStandings[leagueId]?.overall
      if (!standings || standings.length === 0) return '—'
      return `${standings[0].username} (${standings[0].totalPoints} pts)`
    },
    async submitScore(gameId) {
      const game = this.userGames.find(g => g.gameid === gameId)
      if (!game) return
      
      const form = this.scoreForms[gameId]
      const inputType = this.getInputType(game.slug)
      let scoreNum = null
      
      if (inputType === 'time') {
        const minutes = Number(form.minutes) || 0
        const seconds = Number(form.seconds) || 0
        if (minutes === 0 && seconds === 0) {
          alert('Please enter time')
          return
        }
        scoreNum = minutes * 60 + seconds
      } else if (inputType === 'keyword') {
        const time = Number(form.time) || 0
        const errors = Number(form.errors) || 0
        if (time === 0 && errors === 0) {
          alert('Please enter time or errors')
          return
        }
        scoreNum = time + (errors * 10)
      } else if (inputType === 'spelling_bee') {
        if (form.rank === '') {
          alert('Please select a rank')
          return
        }
        scoreNum = Number(form.rank)
      } else {
        if (form.score == null || form.score === '') {
          alert('Please enter a score')
          return
        }
        scoreNum = Number(form.score)
        if (isNaN(scoreNum)) {
          alert('Score must be a valid number')
          return
        }
      }
      
      try {
        const today = new Date().toISOString().slice(0, 10)
        await axios.post('/api/scores/daily', {
          user_id: this.store.user.id,
          game_id: gameId,
          date: today,
          score: scoreNum
        })
        // Reset form based on input type
        if (inputType === 'time') {
          this.scoreForms[gameId] = { minutes: '', seconds: '', entryMode: 'manual', shareText: '' }
        } else if (inputType === 'keyword') {
          this.scoreForms[gameId] = { time: '', errors: '', entryMode: 'manual', shareText: '' }
        } else if (inputType === 'spelling_bee') {
          this.scoreForms[gameId] = { rank: '', entryMode: 'manual', shareText: '' }
        } else {
          this.scoreForms[gameId] = { score: '', entryMode: 'manual', shareText: '' }
        }
        await this.loadData()
      } catch (err) {
        console.error('Score save error:', err)
        alert(err.response?.data?.error || 'Failed to save score')
      }
    },
    async parseAndSave(gameId) {
      const form = this.scoreForms[gameId]
      if (!form.shareText) {
        alert('Please paste share text')
        return
      }
      try {
        const res = await axios.post('/api/share-parser/parse', {
          gameId,
          shareText: form.shareText
        })
        const score = res.data.score
        if (score == null || isNaN(score)) {
          alert('Could not extract score from share text')
          return
        }
        const today = new Date().toISOString().slice(0, 10)
        await axios.post('/api/scores/daily', {
          user_id: this.store.user.id,
          game_id: gameId,
          date: today,
          score: score
        })
        this.scoreForms[gameId] = { score: '', entryMode: 'manual', shareText: '' }
        await this.loadData()
      } catch (err) {
        console.error('Parse/save error:', err)
        alert(err.response?.data?.error || 'Failed to parse or save score')
      }
    },
    showReenter(gameId) {
      const game = this.userGames.find(g => g.gameid === gameId)
      if (!game) return
      
      const existing = this.todayScoresByGame[gameId]
      const inputType = this.getInputType(game.slug)
      this.reenteringGame = gameId
      
      if (inputType === 'time') {
        const totalSeconds = existing?.score || 0
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        this.reenterForm = { minutes: minutes || '', seconds: seconds || '', entryMode: 'manual', shareText: '' }
      } else if (inputType === 'keyword') {
        const total = existing?.score || 0
        // We can't reverse calculate time and errors from total, so just show empty
        this.reenterForm = { time: '', errors: '', entryMode: 'manual', shareText: '' }
      } else if (inputType === 'spelling_bee') {
        this.reenterForm = { rank: String(existing?.score || ''), entryMode: 'manual', shareText: '' }
      } else {
        this.reenterForm = { score: existing?.score || '', entryMode: 'manual', shareText: '' }
      }
    },
    cancelReenter() {
      this.reenteringGame = null
      this.reenterForm = { score: '', entryMode: 'manual', shareText: '' }
    },
    formatScore(score, slug) {
      const inputType = this.getInputType(slug)
      if (inputType === 'time') {
        const minutes = Math.floor(score / 60)
        const seconds = score % 60
        return `${minutes}:${String(seconds).padStart(2, '0')}`
      }
      return score
    },
    async updateScore(gameId) {
      const game = this.userGames.find(g => g.gameid === gameId)
      if (!game) return
      
      const inputType = this.getInputType(game.slug)
      let scoreNum = null
      
      if (this.reenterForm.entryMode === 'paste') {
        if (!this.reenterForm.shareText) {
          alert('Please paste share text')
          return
        }
        try {
          const res = await axios.post('/api/share-parser/parse', {
            gameId,
            shareText: this.reenterForm.shareText
          })
          scoreNum = res.data.score
          if (scoreNum == null || isNaN(scoreNum)) {
            alert('Could not extract score from share text')
            return
          }
        } catch (err) {
          alert(err.response?.data?.error || 'Failed to parse share text')
          return
        }
      } else {
        if (inputType === 'time') {
          const minutes = Number(this.reenterForm.minutes) || 0
          const seconds = Number(this.reenterForm.seconds) || 0
          if (minutes === 0 && seconds === 0) {
            alert('Please enter time')
            return
          }
          scoreNum = minutes * 60 + seconds
        } else if (inputType === 'keyword') {
          const time = Number(this.reenterForm.time) || 0
          const errors = Number(this.reenterForm.errors) || 0
          if (time === 0 && errors === 0) {
            alert('Please enter time or errors')
            return
          }
          scoreNum = time + (errors * 10)
        } else if (inputType === 'spelling_bee') {
          if (this.reenterForm.rank === '') {
            alert('Please select a rank')
            return
          }
          scoreNum = Number(this.reenterForm.rank)
        } else {
          if (this.reenterForm.score == null || this.reenterForm.score === '') {
            alert('Please enter a score')
            return
          }
          scoreNum = Number(this.reenterForm.score)
          if (isNaN(scoreNum)) {
            alert('Score must be a valid number')
            return
          }
        }
      }
      try {
        const today = new Date().toISOString().slice(0, 10)
        await axios.post('/api/scores/daily', {
          user_id: this.store.user.id,
          game_id: gameId,
          date: today,
          score: scoreNum
        })
        this.cancelReenter()
        await this.loadData()
      } catch (err) {
        console.error('Score update error:', err)
        alert(err.response?.data?.error || 'Failed to update score')
      }
    },
    getLeagueNamesForGame(gameId) {
      const scoreData = this.todayScoresByGame[gameId]
      if (!scoreData) return []
      if (scoreData.leagues && scoreData.leagues.length > 0) {
        return scoreData.leagues.map(l => l?.name || l).filter(Boolean)
      }
      return this.leagues
        .filter(l => l.games?.some(g => g.gameid === gameId))
        .map(l => l.name)
    }
  }
}
</script>

<style scoped>
.home-page {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  align-items: start;
}
.main-content {
  min-width: 0;
}
.greeting {
  margin: -0.5rem 0 1.5rem;
  color: #666;
}
.daily-scores {
  margin-bottom: 2rem;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #4a7c59;
  background: white;
  color: #2d5a3d;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn:hover {
  background: #f0f8f0;
}
.score-entries {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.score-entry {
  padding: 1rem;
  border: 1px solid #4a7c59;
  border-left-width: 4px;
  border-radius: 8px;
  background: white;
}
.game-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.entry-form label {
  font-weight: 500;
  color: #2d5a3d;
  margin: 0;
}
.info-tooltip {
  position: relative;
  display: inline-block;
}
.info-icon {
  cursor: help;
  font-size: 1rem;
  opacity: 0.7;
}
.info-icon:hover {
  opacity: 1;
}
.tooltip-content {
  visibility: hidden;
  position: absolute;
  bottom: 125%;
  left: 0;
  background: #333;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  white-space: normal;
  width: 200px;
  z-index: 10;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.tooltip-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 10px;
  border: 5px solid transparent;
  border-top-color: #333;
}
.info-tooltip:hover .tooltip-content {
  visibility: visible;
}
.entry-mode-toggle {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  border: 1px solid #4a7c59;
  border-radius: 4px;
  overflow: hidden;
}
.entry-mode-toggle button {
  flex: 1;
  padding: 0.4rem 0.75rem;
  border: none;
  background: white;
  color: #2d5a3d;
  cursor: pointer;
  font-size: 0.85rem;
  margin: 0;
}
.entry-mode-toggle button.active {
  background: #2d5a3d;
  color: white;
}
.entry-mode-toggle button:hover:not(.active) {
  background: #f0f8f0;
}
.paste-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.paste-row textarea {
  padding: 0.5rem;
  border: 1px solid #4a7c59;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
}
.paste-row button {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  background: #2d5a3d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.paste-row button:hover {
  background: #1e3d28;
}
.paste-row button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.time-inputs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.time-input {
  width: 60px;
}
.keyword-inputs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}
.keyword-inputs input {
  width: 100%;
}
.spelling-bee-select {
  padding: 0.5rem;
  border: 1px solid #4a7c59;
  border-radius: 4px;
  background: white;
  color: #2d5a3d;
  font-size: 0.9rem;
  min-width: 150px;
}
.input-row input {
  padding: 0.5rem;
  flex: 1;
  border: 1px solid #4a7c59;
  border-radius: 4px;
}
.input-row input.no-spinner::-webkit-inner-spin-button,
.input-row input.no-spinner::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.input-row input.no-spinner {
  -moz-appearance: textfield;
}
.input-row button {
  padding: 0.5rem 1rem;
  background: #2d5a3d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.input-row button:hover {
  background: #1e3d28;
}
.input-row button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.hint-small {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.5rem;
  margin-bottom: 0;
}
.entered-score {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}
.score-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}
.score-info strong {
  display: block;
  color: #2d5a3d;
}
.score-value {
  font-size: 1.25rem;
  font-weight: bold;
  color: #2d5a3d;
}
.league-names {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.league-tag {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  background: #f0f8f0;
  border-radius: 4px;
  color: #2d5a3d;
}
.reenter-btn {
  padding: 0.4rem 0.75rem;
  font-size: 0.9rem;
  background: white;
  border: 1px solid #4a7c59;
  color: #2d5a3d;
  border-radius: 4px;
  cursor: pointer;
}
.reenter-btn:hover {
  background: #f0f8f0;
}
.reenter-form {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}
.reenter-form .entry-mode-toggle {
  margin-bottom: 0.5rem;
}
.reenter-form input,
.reenter-form textarea {
  padding: 0.5rem;
  border: 1px solid #4a7c59;
  border-radius: 4px;
  font-family: inherit;
}
.reenter-form textarea {
  resize: vertical;
  min-height: 60px;
}
.reenter-actions {
  display: flex;
  gap: 0.5rem;
}
.reenter-form input.no-spinner::-webkit-inner-spin-button,
.reenter-form input.no-spinner::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.reenter-form input.no-spinner {
  -moz-appearance: textfield;
}
.reenter-form button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}
.reenter-form button:first-of-type {
  background: #2d5a3d;
  color: white;
  border: none;
}
.reenter-form button:first-of-type:hover {
  background: #1e3d28;
}
.reenter-form button:last-of-type {
  background: white;
  border: 1px solid #4a7c59;
  color: #2d5a3d;
}
.reenter-form button:last-of-type:hover {
  background: #f0f8f0;
}
.leagues-sidebar {
  background: #f0f8f0;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #4a7c59;
}
.leagues-sidebar h2 {
  margin-top: 0;
  color: #2d5a3d;
  font-size: 1.25rem;
}
.empty-sidebar {
  color: #666;
  text-align: center;
  padding: 1rem 0;
}
.btn-link {
  display: inline-block;
  margin-top: 0.5rem;
  color: #2d5a3d;
  text-decoration: underline;
}
.leagues-list-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.league-item-sidebar {
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #4a7c59;
}
.league-link {
  display: block;
  font-weight: 500;
  color: #2d5a3d;
  text-decoration: none;
  margin-bottom: 0.75rem;
}
.league-link:hover {
  text-decoration: underline;
}
.league-standings-preview {
  font-size: 0.85rem;
}
.overall-preview {
  display: flex;
  justify-content: space-between;
  color: #666;
}
.preview-label {
  font-weight: 500;
}
.top-player {
  color: #2d5a3d;
  font-weight: 500;
}
.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid #4a7c59;
}
.sidebar-actions .btn-link {
  text-align: center;
  padding: 0.5rem;
  background: white;
  border: 1px solid #4a7c59;
  border-radius: 4px;
  text-decoration: none;
  color: #2d5a3d;
}
.sidebar-actions .btn-link:hover {
  background: #e8f5e9;
}
.loading,
.empty {
  color: #666;
  margin: 2rem 0;
}
</style>
