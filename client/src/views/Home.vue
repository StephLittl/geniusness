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
              <div class="entry-form">
                <div class="game-header">
                  <label>{{ game.name }}</label>
                  <div class="info-tooltip" v-if="game.scoring_info">
                    <span class="info-icon">i</span>
                    <div class="tooltip-content">{{ formatScoringInfo(game.scoring_info) }}</div>
                  </div>
                  <button 
                    v-if="reenteringGame === game.gameid" 
                    type="button" 
                    @click="cancelReenter" 
                    class="cancel-btn-top"
                    title="Cancel"
                  >
                    ×
                  </button>
                </div>
                <!-- Show input fields if no score exists OR if re-entering -->
                <template v-if="!todayScoresByGame || !todayScoresByGame[String(game.gameid)] || reenteringGame === game.gameid">
                  <div v-if="hasParseOption(game.slug)" class="entry-mode-toggle">
                    <button
                      type="button"
                      @click="setEntryMode(game.gameid, 'manual')"
                      :class="{ active: (reenteringGame === game.gameid ? reenterForm.entryMode : scoreForms[game.gameid].entryMode) !== 'paste' }"
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      @click="setEntryMode(game.gameid, 'paste')"
                      :class="{ active: (reenteringGame === game.gameid ? reenterForm.entryMode : scoreForms[game.gameid].entryMode) === 'paste' }"
                    >
                      Paste Share
                    </button>
                  </div>
                  <div v-if="(reenteringGame === game.gameid ? reenterForm.entryMode : scoreForms[game.gameid].entryMode) !== 'paste'" class="input-row">
                  <!-- Time input (minutes/seconds) for Crossword and Pyramid Scheme -->
                  <template v-if="getInputType(game.slug) === 'time'">
                    <div class="time-inputs">
                      <input
                        v-if="reenteringGame !== game.gameid"
                        v-model.number="scoreForms[game.gameid].minutes"
                        type="number"
                        min="0"
                        placeholder="Min"
                        class="no-spinner time-input"
                      />
                      <input
                        v-else
                        v-model.number="reenterForm.minutes"
                        type="number"
                        min="0"
                        placeholder="Min"
                        class="no-spinner time-input"
                      />
                      <span>:</span>
                      <input
                        v-if="reenteringGame !== game.gameid"
                        v-model.number="scoreForms[game.gameid].seconds"
                        type="number"
                        min="0"
                        max="59"
                        placeholder="Sec"
                        class="no-spinner time-input"
                      />
                      <input
                        v-else
                        v-model.number="reenterForm.seconds"
                        type="number"
                        min="0"
                        max="59"
                        placeholder="Sec"
                        class="no-spinner time-input"
                      />
                    </div>
                    <button
                      v-if="reenteringGame !== game.gameid"
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="!scoreForms[game.gameid].minutes && !scoreForms[game.gameid].seconds"
                    >
                      Save
                    </button>
                    <button v-else type="button" @click="updateScore(game.gameid)">Re-enter</button>
                  </template>
                  <!-- Keyword input (time + errors) -->
                  <template v-else-if="getInputType(game.slug) === 'keyword'">
                    <div class="keyword-inputs">
                      <input
                        v-if="reenteringGame !== game.gameid"
                        v-model.number="scoreForms[game.gameid].time"
                        type="number"
                        min="0"
                        placeholder="Time (seconds)"
                        class="no-spinner"
                      />
                      <input
                        v-else
                        v-model.number="reenterForm.time"
                        type="number"
                        min="0"
                        placeholder="Time (seconds)"
                        class="no-spinner"
                      />
                      <input
                        v-if="reenteringGame !== game.gameid"
                        v-model.number="scoreForms[game.gameid].errors"
                        type="number"
                        min="0"
                        placeholder="Errors"
                        class="no-spinner"
                      />
                      <input
                        v-else
                        v-model.number="reenterForm.errors"
                        type="number"
                        min="0"
                        placeholder="Errors"
                        class="no-spinner"
                      />
                    </div>
                    <button
                      v-if="reenteringGame !== game.gameid"
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="(scoreForms[game.gameid].time == null || scoreForms[game.gameid].time === '') && (scoreForms[game.gameid].errors == null || scoreForms[game.gameid].errors === '')"
                    >
                      Save
                    </button>
                    <button v-else type="button" @click="updateScore(game.gameid)">Re-enter</button>
                  </template>
                  <!-- Spelling Bee input (0, 1, or 2) -->
                  <template v-else-if="getInputType(game.slug) === 'spelling_bee'">
                    <select 
                      v-if="reenteringGame !== game.gameid"
                      v-model="scoreForms[game.gameid].rank" 
                      class="spelling-bee-select"
                    >
                      <option value="">Select rank</option>
                      <option value="0">No Genius</option>
                      <option value="1">Genius</option>
                      <option value="2">Queen Bee</option>
                    </select>
                    <select 
                      v-else
                      v-model="reenterForm.rank" 
                      class="spelling-bee-select"
                    >
                      <option value="">Select rank</option>
                      <option value="0">No Genius</option>
                      <option value="1">Genius</option>
                      <option value="2">Queen Bee</option>
                    </select>
                    <button
                      v-if="reenteringGame !== game.gameid"
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="scoreForms[game.gameid].rank === ''"
                    >
                      Save
                    </button>
                    <button v-else type="button" @click="updateScore(game.gameid)">Re-enter</button>
                  </template>
                  <!-- Connections dropdown (0-3 mistakes, failed) -->
                  <template v-else-if="getInputType(game.slug) === 'connections'">
                    <select 
                      v-if="reenteringGame !== game.gameid"
                      v-model="scoreForms[game.gameid].mistakes" 
                      class="connections-select"
                    >
                      <option value="">Select mistakes</option>
                      <option value="0">0 mistakes</option>
                      <option value="1">1 mistake</option>
                      <option value="2">2 mistakes</option>
                      <option value="3">3 mistakes</option>
                      <option value="4">Failed</option>
                    </select>
                    <select 
                      v-else
                      v-model="reenterForm.mistakes" 
                      class="connections-select"
                    >
                      <option value="">Select mistakes</option>
                      <option value="0">0 mistakes</option>
                      <option value="1">1 mistake</option>
                      <option value="2">2 mistakes</option>
                      <option value="3">3 mistakes</option>
                      <option value="4">Failed</option>
                    </select>
                    <button
                      v-if="reenteringGame !== game.gameid"
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="scoreForms[game.gameid].mistakes === ''"
                    >
                      Save
                    </button>
                    <button v-else type="button" @click="updateScore(game.gameid)">Re-enter</button>
                  </template>
                  <!-- Wordle dropdown (0-6) -->
                  <template v-else-if="getInputType(game.slug) === 'wordle'">
                    <select 
                      v-if="reenteringGame !== game.gameid"
                      v-model="scoreForms[game.gameid].guesses" 
                      class="wordle-select"
                    >
                      <option value="">Select guesses</option>
                      <option value="1">1 guess</option>
                      <option value="2">2 guesses</option>
                      <option value="3">3 guesses</option>
                      <option value="4">4 guesses</option>
                      <option value="5">5 guesses</option>
                      <option value="6">6 guesses</option>
                      <option value="0">Failed</option>
                    </select>
                    <select 
                      v-else
                      v-model="reenterForm.guesses" 
                      class="wordle-select"
                    >
                      <option value="">Select guesses</option>
                      <option value="1">1 guess</option>
                      <option value="2">2 guesses</option>
                      <option value="3">3 guesses</option>
                      <option value="4">4 guesses</option>
                      <option value="5">5 guesses</option>
                      <option value="6">6 guesses</option>
                      <option value="0">Failed</option>
                    </select>
                    <button
                      v-if="reenteringGame !== game.gameid"
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="scoreForms[game.gameid].guesses === ''"
                    >
                      Save
                    </button>
                    <button v-else type="button" @click="updateScore(game.gameid)">Re-enter</button>
                  </template>
                  <!-- Standard score input -->
                  <template v-else>
                    <input
                      v-if="reenteringGame !== game.gameid"
                      v-model.number="scoreForms[game.gameid].score"
                      type="number"
                      step="any"
                      placeholder="Enter score"
                      required
                      class="no-spinner"
                    />
                    <input
                      v-else
                      v-model.number="reenterForm.score"
                      type="number"
                      step="any"
                      placeholder="Enter score"
                      required
                      class="no-spinner"
                    />
                    <button
                      v-if="reenteringGame !== game.gameid"
                      type="button"
                      @click="submitScore(game.gameid)"
                      :disabled="scoreForms[game.gameid].score == null || scoreForms[game.gameid].score === ''"
                    >
                      Save
                    </button>
                    <button v-else type="button" @click="updateScore(game.gameid)">Re-enter</button>
                  </template>
                </div>
                  <div v-else-if="hasParseOption(game.slug) && (reenteringGame === game.gameid ? reenterForm.entryMode : scoreForms[game.gameid].entryMode) === 'paste'" class="paste-row">
                    <textarea
                      v-if="reenteringGame !== game.gameid"
                      v-model="scoreForms[game.gameid].shareText"
                      placeholder="Paste share text"
                      class="paste-textarea"
                    ></textarea>
                    <textarea
                      v-else
                      v-model="reenterForm.shareText"
                      placeholder="Paste share text"
                      class="paste-textarea"
                    ></textarea>
                    <button
                      v-if="reenteringGame !== game.gameid"
                      type="button"
                      @click="parseAndSave(game.gameid)"
                      :disabled="!scoreForms[game.gameid].shareText"
                    >
                      Save
                    </button>
                    <button v-else type="button" @click="updateScore(game.gameid)">Re-enter</button>
                  </div>
                </template>
                <!-- Show score if it exists and not re-entering -->
                <div v-if="todayScoresByGame && todayScoresByGame[String(game.gameid)] && reenteringGame !== game.gameid" class="current-score-display">
                  <div class="score-row">
                    <span class="score-label">Score:</span>
                    <span class="score-value" :style="{ color: game.color || '#2d5a3d' }">
                      {{ formatScore(todayScoresByGame[String(game.gameid)].score, game.slug) }}
                    </span>
                    <button type="button" @click="showReenter(game.gameid)" class="reenter-btn-small">
                      Re-enter
                    </button>
                  </div>
                  <div class="league-names" v-if="getLeagueNamesForGame(game.gameid).length > 0">
                    <span v-for="leagueName in getLeagueNamesForGame(game.gameid)" :key="leagueName" class="league-tag">
                      {{ leagueName }}
                    </span>
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
        <div v-for="league in leagues.filter(l => l.name !== 'Personal')" :key="league.leagueid" class="league-item-sidebar">
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
      if (!this.todayScores || !Array.isArray(this.todayScores)) {
        return map
      }
      // Group scores by game_id, keeping the most recent one per game
      for (const s of this.todayScores) {
        const gameId = s.game_id || s.gameid
        if (!gameId) continue
        
        // Convert to string to ensure consistent key matching
        const gameIdKey = String(gameId)
        
        if (map[gameIdKey]) {
          // If we already have a score for this game, merge league info
          if (!map[gameIdKey].leagues) {
            map[gameIdKey].leagues = map[gameIdKey].league ? [map[gameIdKey].league] : []
          }
          if (s.league && !map[gameIdKey].leagues.some(l => l?.name === s.league?.name)) {
            map[gameIdKey].leagues.push(s.league)
          }
          // Keep the score from the most recent entry (or just keep the first one since they should be the same)
        } else {
          // First score for this game
          map[gameIdKey] = { 
            ...s, 
            leagues: s.league ? [s.league] : [],
            score: s.score
          }
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
        // Load saved entry mode preference from localStorage
        const savedMode = localStorage.getItem(`entryMode_${game.gameid}`) || 'manual'
        const inputType = this.getInputType(game.slug)
        if (inputType === 'time') {
          forms[game.gameid] = { minutes: '', seconds: '', entryMode: savedMode, shareText: '' }
        } else if (inputType === 'keyword') {
          forms[game.gameid] = { time: '', errors: '', entryMode: savedMode, shareText: '' }
        } else if (inputType === 'spelling_bee') {
          forms[game.gameid] = { rank: '', entryMode: savedMode, shareText: '' }
        } else if (inputType === 'connections') {
          forms[game.gameid] = { mistakes: '', entryMode: savedMode, shareText: '' }
        } else if (inputType === 'wordle') {
          forms[game.gameid] = { guesses: '', entryMode: savedMode, shareText: '' }
        } else {
          forms[game.gameid] = { score: '', entryMode: savedMode, shareText: '' }
        }
      }
      this.scoreForms = forms
    },
    setEntryMode(gameId, mode) {
      if (this.reenteringGame === gameId) {
        this.reenterForm.entryMode = mode
      } else {
        this.scoreForms[gameId].entryMode = mode
      }
      // Save preference to localStorage
      localStorage.setItem(`entryMode_${gameId}`, mode)
    },
    getInputType(slug) {
      if (['crossword', 'mini-crossword', 'pyramid-scheme'].includes(slug)) return 'time'
      if (slug === 'keyword') return 'keyword'
      if (slug === 'spelling-bee') return 'spelling_bee'
      if (slug === 'connections') return 'connections'
      if (slug === 'wordle') return 'wordle'
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
      } else if (inputType === 'connections') {
        if (form.mistakes === '') {
          alert('Please select number of mistakes')
          return
        }
        scoreNum = Number(form.mistakes)
      } else if (inputType === 'wordle') {
        if (form.guesses === '') {
          alert('Please select number of guesses')
          return
        }
        scoreNum = Number(form.guesses)
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
        const today = this.getEasternDate()
        await axios.post('/api/scores/daily', {
          user_id: this.store.user.id,
          game_id: gameId,
          date: today,
          score: scoreNum
        })
        // Reset form based on input type
        const savedMode = localStorage.getItem(`entryMode_${gameId}`) || 'manual'
        if (inputType === 'time') {
          this.scoreForms[gameId] = { minutes: '', seconds: '', entryMode: savedMode, shareText: '' }
        } else if (inputType === 'keyword') {
          this.scoreForms[gameId] = { time: '', errors: '', entryMode: savedMode, shareText: '' }
        } else if (inputType === 'spelling_bee') {
          this.scoreForms[gameId] = { rank: '', entryMode: savedMode, shareText: '' }
        } else if (inputType === 'connections') {
          this.scoreForms[gameId] = { mistakes: '', entryMode: savedMode, shareText: '' }
        } else if (inputType === 'wordle') {
          this.scoreForms[gameId] = { guesses: '', entryMode: savedMode, shareText: '' }
        } else {
          this.scoreForms[gameId] = { score: '', entryMode: savedMode, shareText: '' }
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
        const today = this.getEasternDate()
        await axios.post('/api/scores/daily', {
          user_id: this.store.user.id,
          game_id: gameId,
          date: today,
          score: score
        })
        const savedMode = localStorage.getItem(`entryMode_${gameId}`) || 'manual'
        this.scoreForms[gameId] = { score: '', entryMode: savedMode, shareText: '' }
        await this.loadData()
      } catch (err) {
        console.error('Parse/save error:', err)
        alert(err.response?.data?.error || 'Failed to parse or save score')
      }
    },
    showReenter(gameId) {
      const game = this.userGames.find(g => g.gameid === gameId)
      if (!game) return
      
      const existing = this.todayScoresByGame[String(gameId)]
      const inputType = this.getInputType(game.slug)
      this.reenteringGame = gameId
      
      // Use the same entry mode as the original form
      const savedMode = localStorage.getItem(`entryMode_${gameId}`) || 'manual'
      
      if (inputType === 'time') {
        const totalSeconds = existing?.score || 0
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        this.reenterForm = { minutes: minutes || '', seconds: seconds || '', entryMode: savedMode, shareText: '' }
      } else if (inputType === 'keyword') {
        const total = existing?.score || 0
        // We can't reverse calculate time and errors from total, so just show empty
        this.reenterForm = { time: '', errors: '', entryMode: savedMode, shareText: '' }
      } else if (inputType === 'spelling_bee') {
        this.reenterForm = { rank: String(existing?.score || ''), entryMode: savedMode, shareText: '' }
      } else if (inputType === 'connections') {
        this.reenterForm = { mistakes: String(existing?.score || ''), entryMode: savedMode, shareText: '' }
      } else if (inputType === 'wordle') {
        this.reenterForm = { guesses: String(existing?.score || ''), entryMode: savedMode, shareText: '' }
      } else {
        this.reenterForm = { score: existing?.score || '', entryMode: savedMode, shareText: '' }
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
        } else if (inputType === 'connections') {
          if (this.reenterForm.mistakes === '') {
            alert('Please select number of mistakes')
            return
          }
          scoreNum = Number(this.reenterForm.mistakes)
        } else if (inputType === 'wordle') {
          if (this.reenterForm.guesses === '') {
            alert('Please select number of guesses')
            return
          }
          scoreNum = Number(this.reenterForm.guesses)
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
        const today = this.getEasternDate()
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
      const scoreData = this.todayScoresByGame[String(gameId)]
      if (!scoreData) return []
      if (scoreData.leagues && scoreData.leagues.length > 0) {
        // Filter out "Personal" league
        return scoreData.leagues
          .map(l => l?.name || l)
          .filter(Boolean)
          .filter(name => name !== 'Personal')
      }
      return this.leagues
        .filter(l => l.games?.some(g => g.gameid === gameId))
        .map(l => l.name)
        .filter(name => name !== 'Personal')
    },
    // Helper function to get today's date in Eastern time zone
    getEasternDate() {
      const now = new Date();
      // Convert to Eastern time using Intl.DateTimeFormat
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      // 'en-CA' format gives us YYYY-MM-DD directly
      return formatter.format(now);
    },
    formatScoringInfo(info) {
      if (!info) return ''
      // If it's already a string, return it
      if (typeof info === 'string') return info
      // If it's an object, try to format it nicely
      if (typeof info === 'object') {
        return JSON.stringify(info, null, 2)
      }
      return String(info)
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
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  align-items: start;
}

@media (max-width: 1200px) {
  .score-entries {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .score-entries {
    grid-template-columns: 1fr;
  }
}
.score-entry {
  padding: 1rem;
  border: 1px solid #4a7c59;
  border-left-width: 4px;
  border-radius: 8px;
  background: white;
  box-sizing: border-box;
  overflow: visible;
  position: relative;
  height: 160px;
  max-height: 160px;
  min-height: 160px;
  display: flex;
  flex-direction: column;
}
.entry-form .input-row,
.entry-form .paste-row {
  margin-right: 0;
  padding-right: 0;
}
.game-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
  position: relative;
}
.game-header label {
  display: flex;
  align-items: center;
}
.info-tooltip {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  flex-shrink: 0;
}
.entry-form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: calc(160px - 2rem - 0.75rem);
  gap: 0;
  overflow: visible;
}
.entry-form > .entry-mode-toggle {
  margin-bottom: 0.5rem;
  height: 24px;
  min-height: 24px;
  max-height: 24px;
  flex-shrink: 0;
}
.entry-form > .input-row,
.entry-form > .paste-row {
  margin: 0 !important;
  padding: 0 !important;
  position: relative;
  top: 0;
  left: 0;
  height: 36px;
  min-height: 36px;
  max-height: 36px;
  flex-shrink: 0;
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
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e0e0e0;
  color: #666;
  font-size: 0.75rem;
  font-weight: bold;
  font-style: normal;
}
.info-icon:hover {
  opacity: 1;
  background: #d0d0d0;
}
.tooltip-content {
  visibility: hidden;
  position: absolute;
  bottom: 125%;
  left: 0;
  background: #2d5a3d;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  white-space: normal;
  width: 220px;
  z-index: 1000;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  line-height: 1.4;
}
.tooltip-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #2d5a3d;
}
.info-tooltip:hover .tooltip-content {
  visibility: visible;
}
.entry-mode-toggle {
  display: flex;
  gap: 0;
  margin-bottom: 0.5rem;
  border: 1px solid #4a7c59;
  border-radius: 4px;
  overflow: hidden;
  align-items: stretch;
  flex-shrink: 0;
}
.entry-mode-toggle button {
  flex: 1;
  padding: 0.25rem 0.5rem;
  border: none;
  background: white;
  color: #2d5a3d;
  cursor: pointer;
  font-size: 0.75rem;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
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
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  height: 36px;
  max-height: 36px;
  min-height: 36px;
  margin: 0;
  padding: 0;
  position: relative;
  flex-shrink: 0;
}
.paste-row textarea,
.paste-textarea {
  padding: 0.4rem 0.5rem !important;
  border: 1px solid #4a7c59 !important;
  border-radius: 4px !important;
  font-family: inherit !important;
  font-size: 0.9rem !important;
  resize: none !important;
  height: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  line-height: 1.2 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  flex: 1;
  min-width: 0;
  margin: 0 !important;
  display: block;
  color: inherit !important;
  flex-shrink: 0;
}
.paste-row button {
  flex-shrink: 0;
  height: 36px;
  padding: 0.4rem 1rem;
  font-size: 0.9rem;
  background: #2d5a3d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  box-sizing: border-box;
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
.input-row,
.paste-row {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  height: 36px;
  max-height: 36px;
  min-height: 36px;
  margin: 0;
  padding: 0;
  position: relative;
  flex-shrink: 0;
}
.input-row .keyword-inputs {
  flex-direction: column;
  height: auto;
  min-height: auto;
  max-height: none;
  align-items: stretch;
}
.input-row:has(.keyword-inputs) {
  height: auto;
  min-height: auto;
  max-height: none;
  align-items: flex-start;
}
.input-row:has(.keyword-inputs) > button {
  align-self: center;
  margin-left: auto;
  margin-top: 0;
}
.input-row input:not(.time-input),
.input-row .time-inputs,
.input-row .keyword-inputs,
.input-row select {
  flex: 1;
  min-width: 0;
}
.input-row > button {
  flex-shrink: 0;
  margin-left: auto;
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
.input-row > button,
.paste-row > button {
  margin-left: auto;
}
.input-row button {
  padding: 0.4rem 1rem;
  background: #2d5a3d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  height: 36px;
  font-size: 0.9rem;
  box-sizing: border-box;
  flex-shrink: 0;
  white-space: nowrap;
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
.current-score-display {
  display: flex !important;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
  font-size: 0.9rem;
  visibility: visible !important;
  opacity: 1 !important;
}
.current-score-display .score-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
}
.current-score-display .score-label {
  font-weight: 500;
  color: #666;
}
.current-score-display .score-value {
  font-size: 1.1rem;
  font-weight: bold;
}
.reenter-btn-small {
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
  background: #f0f8f0;
  color: #2d5a3d;
  border: 1px solid #4a7c59;
  border-radius: 4px;
  cursor: pointer;
  margin-left: auto;
  flex-shrink: 0;
}
.reenter-btn-small:hover {
  background: #e0f0e0;
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
.cancel-btn-top {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: #666;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  flex-shrink: 0;
  z-index: 10;
}
.cancel-btn-top:hover {
  background: #f0f0f0;
  color: #333;
}
.connections-select,
.wordle-select {
  padding: 0.5rem;
  border: 1px solid #4a7c59;
  border-radius: 4px;
  background: white;
  color: #2d5a3d;
  font-size: 0.9rem;
  min-width: 150px;
  flex: 1;
  min-width: 0;
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
