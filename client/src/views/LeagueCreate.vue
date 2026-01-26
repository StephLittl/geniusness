<template>
  <div class="league-create">
    <h1>Create a league</h1>
    <form @submit.prevent="createLeague">
      <div class="field">
        <label>League name</label>
        <input v-model="leagueName" placeholder="e.g. Weekend Wordle" required />
      </div>

      <div class="field">
        <label>League Type</label>
        <select v-model="leagueType" required @change="onLeagueTypeChange">
          <option value="tracking">Tracking Only (No Winners)</option>
          <option value="periodic">Periodic Competition (Resets Regularly)</option>
          <option value="dated">Dated Competition (Specific Dates)</option>
        </select>
        <p class="field-hint">
          <span v-if="leagueType === 'tracking'">Track scores over time with no winners or resets</span>
          <span v-else-if="leagueType === 'periodic'">Competition that resets on a regular schedule (weekly, monthly, etc.)</span>
          <span v-else-if="leagueType === 'dated'">One-time competition with specific start and end dates</span>
        </p>
      </div>

      <!-- Periodic League Options -->
      <template v-if="leagueType === 'periodic'">
        <div class="field">
          <label>Reset Period</label>
          <select v-model="resetPeriod" required>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom (specify days)</option>
          </select>
        </div>

        <div v-if="resetPeriod === 'custom'" class="field">
          <label>Custom Period (days)</label>
          <input 
            v-model.number="customPeriodDays" 
            type="number" 
            min="1" 
            placeholder="e.g. 14 for bi-weekly"
            required
          />
        </div>

        <div class="field">
          <label>Start Date (optional)</label>
          <input v-model="startDate" type="date" />
          <p class="field-hint">Leave blank to start from today</p>
        </div>
      </template>

      <!-- Dated League Options -->
      <template v-if="leagueType === 'dated'">
        <div class="field">
          <label>Start Date</label>
          <input v-model="startDate" type="date" required />
        </div>
        <div class="field">
          <label>End Date</label>
          <input v-model="endDate" type="date" required />
        </div>
      </template>

      <!-- Tracking League Options -->
      <template v-if="leagueType === 'tracking'">
        <div class="field">
          <label>Start Date (optional)</label>
          <input v-model="startDate" type="date" />
          <p class="field-hint">Leave blank to start from today</p>
        </div>
      </template>

      <div class="field">
        <label>Games</label>
        <div class="game-list">
          <label v-for="game in games" :key="game.gameid" class="game-check">
            <input type="checkbox" :value="game.gameid" v-model="selectedGames" />
            {{ game.name }}
          </label>
        </div>
      </div>

      <div class="field">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="requiresStartingWord"
            :disabled="!hasWordleSelected"
          />
          <span>Require daily starting Wordle word</span>
        </label>
        <p class="field-hint" v-if="requiresStartingWord">
          All players in this league must use the same starting word each day. Only one league can have this feature enabled.
        </p>
        <p class="field-hint" v-else-if="!hasWordleSelected">
          Wordle must be selected to enable this feature.
        </p>
      </div>

      <button type="submit" :disabled="creating || !isFormValid">Create league</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <p><router-link to="/leagues">← Back to leagues</router-link></p>
  </div>
</template>

<script>
import axios from 'axios'
import { useUserStore } from '../store/userStore'
import { useRouter } from 'vue-router'

export default {
  data() {
    const today = new Date().toISOString().slice(0, 10)
    return {
      leagueName: '',
      leagueType: 'tracking',
      startDate: today,
      endDate: today,
      resetPeriod: 'weekly',
      customPeriodDays: null,
      games: [],
      selectedGames: [],
      requiresStartingWord: false,
      creating: false,
      error: null
    }
  },
  setup() {
    const store = useUserStore()
    const router = useRouter()
    return { store, router }
  },
  computed: {
    hasWordleSelected() {
      const wordleGame = this.games.find(g => g.slug === 'wordle')
      return wordleGame && this.selectedGames.includes(wordleGame.gameid)
    },
    isFormValid() {
      if (!this.leagueName || this.selectedGames.length === 0) return false
      if (this.requiresStartingWord && !this.hasWordleSelected) return false
      if (this.leagueType === 'dated') {
        return this.startDate && this.endDate && new Date(this.startDate) <= new Date(this.endDate)
      }
      if (this.leagueType === 'periodic') {
        if (this.resetPeriod === 'custom') {
          return this.customPeriodDays && this.customPeriodDays > 0
        }
        return true
      }
      return true
    }
  },
  async created() {
    try {
      const res = await axios.get('/api/league/games')
      this.games = res.data.games || []
    } catch (err) {
      this.error = 'Failed to load games'
    }
  },
  methods: {
    onLeagueTypeChange() {
      // Reset form when league type changes
      if (this.leagueType === 'tracking') {
        this.resetPeriod = 'weekly'
        this.customPeriodDays = null
      } else if (this.leagueType === 'periodic') {
        this.endDate = null
      } else if (this.leagueType === 'dated') {
        this.resetPeriod = 'weekly'
        this.customPeriodDays = null
      }
    },
    async createLeague() {
      if (!this.isFormValid) {
        this.error = 'Please fill in all required fields'
        return
      }
      this.error = null
      this.creating = true
      try {
        const payload = {
          name: this.leagueName,
          gameIds: this.selectedGames,
          userId: this.store.user.id,
          leagueType: this.leagueType
        }

        if (this.leagueType === 'dated') {
          payload.startDate = this.startDate
          payload.endDate = this.endDate
        } else if (this.leagueType === 'periodic') {
          payload.resetPeriod = this.resetPeriod
          if (this.startDate) payload.startDate = this.startDate
          if (this.resetPeriod === 'custom') {
            payload.customPeriodDays = this.customPeriodDays
          }
        } else if (this.leagueType === 'tracking') {
          if (this.startDate) payload.startDate = this.startDate
        }

        if (this.requiresStartingWord) {
          payload.requiresStartingWord = true
        }

        const res = await axios.post('/api/league/create', payload)
        this.router.push(`/leagues/${res.data.leagueId}`)
      } catch (err) {
        this.error = err.response?.data?.error || 'Failed to create league'
      } finally {
        this.creating = false
      }
    }
  }
}
</script>

<style scoped>
.league-create { max-width: 480px; margin: 0 auto; text-align: left; }
.field { margin-bottom: 1.25rem; }
.field label { display: block; margin-bottom: 0.35rem; font-weight: 500; color: #2d5a3d; }
.field input[type="text"],
.field input[type="date"],
.field input[type="number"],
.field select { width: 100%; padding: 0.5rem; box-sizing: border-box; border: 1px solid #4a7c59; border-radius: 4px; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-weight: normal; cursor: pointer; }
.checkbox-label input[type="checkbox"] { width: auto; cursor: pointer; }
.field-hint { font-size: 0.85rem; color: #666; margin-top: 0.25rem; font-style: italic; }
.date-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
.date-row input { flex: 1; }
.game-list { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }
.game-check { display: flex; align-items: center; gap: 0.35rem; font-weight: normal; }
button[type="submit"] { padding: 0.75rem 1.5rem; background: #2d5a3d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
button[type="submit"]:hover { background: #1e3d28; }
button[type="submit"]:disabled { background: #ccc; cursor: not-allowed; }
.error { color: #c00; margin-top: 1rem; }
</style>
