<template>
  <div id="app">
    <header class="app-header">
      <h1>Puzzle League</h1>
      <nav>
        <template v-if="loggedIn">
          <router-link to="/league">Leagues</router-link>
          <router-link to="/league/stats">My stats</router-link>
          <button type="button" class="nav-btn" @click="logout">Logout</button>
        </template>
        <template v-else>
          <router-link to="/signup">Sign up</router-link>
          <router-link to="/login">Log in</router-link>
        </template>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './store/userStore'

const store = useUserStore()
const router = useRouter()
const loggedIn = computed(() => !!store.user?.id)

function logout() {
  store.clearUser()
  router.push('/login')
}
</script>

<style>
#app {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 2rem;
  text-align: left;
}

.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #333;
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.app-header nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
}

.app-header a {
  color: #646cff;
  text-decoration: none;
}
.app-header a:hover {
  color: #535bf2;
}

.nav-btn {
  background: transparent;
  border: 1px solid #555;
  color: inherit;
  padding: 0.4rem 0.75rem;
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 6px;
}
.nav-btn:hover {
  border-color: #646cff;
}
</style>
