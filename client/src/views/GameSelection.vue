<template>
  <div class="game-selection">
    <h1>Select Your Daily Games</h1>
    <p class="hint">Choose which puzzle games you play daily. You can change this later.</p>
    <form @submit.prevent="saveGames">
      <div class="game-list">
        <label v-for="game in games" :key="game.gameid" class="game-check">
          <input type="checkbox" :value="game.gameid" v-model="selectedGames" />
          <span>{{ game.name }}</span>
        </label>
      </div>
      <button type="submit" :disabled="saving || selectedGames.length === 0">
        {{ saving ? 'Saving...' : 'Continue' }}
      </button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../store/userStore'
import axios from 'axios'

const router = useRouter()
const store = useUserStore()
const games = ref([])
const selectedGames = ref([])
const saving = ref(false)
const error = ref(null)

onMounted(async () => {
  try {
    const res = await axios.get('/api/league/games')
    games.value = res.data.games || []
  } catch (err) {
    error.value = 'Failed to load games'
  }
})

async function saveGames() {
  if (selectedGames.value.length === 0) {
    error.value = 'Please select at least one game'
    return
  }
  error.value = null
  saving.value = true
  try {
    await axios.post(`/api/user-games/${store.user.id}`, {
      gameIds: selectedGames.value
    })
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to save games'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.game-selection {
  max-width: 500px;
  margin: 0 auto;
  text-align: left;
}
.hint {
  color: var(--muted, #666);
  margin-bottom: 1.5rem;
}
.game-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.game-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #444;
  border-radius: 8px;
  cursor: pointer;
}
.game-check:hover {
  border-color: #646cff;
}
.game-check input[type="checkbox"] {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}
.error {
  color: #e74;
  margin-top: 1rem;
}
</style>
