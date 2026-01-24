<template>
  <div class="leagues">
    <h1>Leagues</h1>
    <p class="greeting">Hi, {{ user?.username || user?.email || 'there' }}.</p>

    <div class="actions">
      <router-link to="/league/create" class="btn primary">Create league</router-link>
      <router-link to="/league/join" class="btn">Join league</router-link>
      <router-link to="/league/stats" class="btn">My stats</router-link>
    </div>

    <section v-if="loading" class="loading">Loading…</section>
    <section v-else-if="leagues.length === 0" class="empty">
      <p>You’re not in any leagues yet.</p>
      <p>Create one or join with an invite code.</p>
    </section>
    <section v-else class="league-list">
      <h2>My leagues</h2>
      <ul>
        <li v-for="l in leagues" :key="l.leagueid">
          <router-link :to="`/league/view/${l.leagueid}`">{{ l.name }}</router-link>
          <span class="meta">
            {{ l.games?.length || 0 }} games
            · {{ l.end_date ? `ends ${l.end_date}` : 'indefinite' }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'
import { useUserStore } from '../store/userStore'
import { storeToRefs } from 'pinia'
import axios from 'axios'

export default {
  data() {
    return { leagues: [], loading: true }
  },
  setup() {
    const store = useUserStore()
    const { user } = storeToRefs(store)
    return { store, user }
  },
  async created() {
    if (!this.store.user?.id) return
    try {
      const res = await axios.get('/api/league/my', { params: { userId: this.store.user.id } })
      this.leagues = res.data.leagues || []
    } catch (err) {
      console.error(err)
    } finally {
      this.loading = false
    }
  }
}
</script>

<style scoped>
.leagues { max-width: 640px; margin: 0 auto; text-align: left; }
.greeting { margin: -0.5rem 0 1rem; color: var(--muted, #666); }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem; }
.btn { padding: 0.5rem 1rem; border-radius: 8px; text-decoration: none; border: 1px solid #444; }
.btn.primary { background: #646cff; border-color: #646cff; color: #fff; }
.btn:hover { border-color: #646cff; }
.loading, .empty { color: var(--muted, #666); margin: 2rem 0; }
.league-list ul { list-style: none; padding: 0; margin: 0; }
.league-list li { padding: 0.75rem 0; border-bottom: 1px solid #333; }
.league-list a { font-weight: 500; }
.meta { margin-left: 0.5rem; font-size: 0.9rem; color: var(--muted, #666); }
</style>
