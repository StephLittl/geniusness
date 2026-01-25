<template>
  <div class="manage-games-page">
    <h1>Manage My Games</h1>
    <p class="hint">Games from your leagues are always shown. You can add or remove other games.</p>
    
    <section v-if="loading" class="loading">Loading…</section>
    <section v-else class="games-list">
      <div v-for="game in allGames" :key="game.gameid" class="game-item" :style="{ borderLeftColor: game.color || '#4a7c59' }">
        <label class="game-checkbox">
          <input
            type="checkbox"
            :value="game.gameid"
            :checked="userGames.some(g => g.gameid === game.gameid) || game.inLeagueGames"
            :disabled="game.inLeagueGames"
            @change="toggleGame(game.gameid, $event.target.checked)"
          />
          <div class="game-info">
            <strong :style="{ color: game.color || '#2d5a3d' }">{{ game.name }}</strong>
            <span v-if="game.inLeagueGames" class="league-badge">(from league)</span>
            <p v-if="game.scoring_info" class="scoring-info">{{ game.scoring_info }}</p>
          </div>
        </label>
      </div>
    </section>
  </div>
</template>

<script>
import { useUserStore } from '../store/userStore'
import axios from 'axios'

export default {
  data() {
    return {
      allGames: [],
      userGames: [],
      loading: true
    }
  },
  setup() {
    const store = useUserStore()
    return { store }
  },
  async created() {
    if (!this.store.user?.id) return
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      try {
        const [gamesRes, userGamesRes] = await Promise.all([
          axios.get('/api/league/games'),
          axios.get(`/api/user-games/${this.store.user.id}`)
        ])
        this.allGames = gamesRes.data.games || []
        this.userGames = userGamesRes.data.games || []
        
        const userGamesMap = new Map(this.userGames.map(g => [g.gameid, g]))
        this.allGames = this.allGames.map(g => {
          const userGame = userGamesMap.get(g.gameid)
          return {
            ...g,
            inUserGames: !!userGame,
            inLeagueGames: userGame?.inLeagueGames || false
          }
        })
      } catch (err) {
        console.error(err)
      } finally {
        this.loading = false
      }
    },
    async toggleGame(gameId, checked) {
      const game = this.allGames.find(g => g.gameid === gameId)
      if (game?.inLeagueGames) return
      try {
        if (checked) {
          const currentGameIds = this.userGames.map(g => g.gameid)
          if (!currentGameIds.includes(gameId)) {
            await axios.post(`/api/user-games/${this.store.user.id}`, {
              gameIds: [...currentGameIds, gameId]
            })
          }
        } else {
          await axios.delete(`/api/user-games/${this.store.user.id}/${gameId}`)
        }
        await this.loadData()
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to update games')
      }
    }
  }
}
</script>

<style scoped>
.manage-games-page {
  max-width: 600px;
  margin: 0 auto;
}
.hint {
  color: #666;
  margin-bottom: 1.5rem;
}
.games-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.game-item {
  padding: 1rem;
  border: 1px solid #4a7c59;
  border-left-width: 4px;
  border-radius: 8px;
  background: white;
}
.game-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  cursor: pointer;
}
.game-checkbox input[type="checkbox"] {
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.25rem;
  cursor: pointer;
}
.game-checkbox input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.game-info {
  flex: 1;
}
.game-info strong {
  display: block;
  margin-bottom: 0.25rem;
}
.league-badge {
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
  margin-left: 0.5rem;
}
.scoring-info {
  font-size: 0.85rem;
  color: #666;
  margin: 0.5rem 0 0 0;
}
.loading {
  color: #666;
  margin: 2rem 0;
}
</style>
