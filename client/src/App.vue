<template>
  <div id="app">
    <template v-if="loggedIn">
      <aside class="sidebar">
        <h1 class="logo">Puzzle League</h1>
        <nav class="sidebar-nav">
          <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' }">
            Home
          </router-link>
          <router-link to="/games/manage" class="nav-item nav-sub" :class="{ active: $route.path === '/games/manage' }">
            Manage My Games
          </router-link>
          <router-link to="/leagues" class="nav-item" :class="{ active: $route.path.startsWith('/leagues') }">
            Leagues
          </router-link>
          <router-link to="/stats" class="nav-item" :class="{ active: $route.path === '/stats' }">
            My Stats
          </router-link>
          <button type="button" class="nav-item logout-btn" @click="logout">
            Logout
          </button>
        </nav>
      </aside>
      <main class="main-content">
        <router-view />
      </main>
    </template>
    <template v-else>
      <div class="auth-container">
        <router-view />
      </div>
    </template>
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
* {
  box-sizing: border-box;
}

#app {
  min-height: 100vh;
  display: flex;
  background: white;
}

.sidebar {
  width: 220px;
  background: #2d5a3d;
  color: white;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
  z-index: 100;
}

.logo {
  margin: 0 0 2rem 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-item {
  padding: 0.75rem 1rem;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  transition: background 0.2s;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 1rem;
  cursor: pointer;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.2);
  font-weight: 500;
}

.nav-sub {
  padding-left: 2rem;
  font-size: 0.9rem;
  opacity: 0.9;
}

.logout-btn {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.main-content {
  flex: 1;
  margin-left: 220px;
  padding: 2rem;
  min-width: 0;
  max-width: calc(100vw - 220px); /* don't let content push past viewport */
  overflow-x: hidden;
}

.auth-container {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
}

/* Global green/white theme */
:root {
  --primary-green: #2d5a3d;
  --light-green: #4a7c59;
  --bg-green: #f0f8f0;
  --text-dark: #333;
  --text-muted: #666;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--text-dark);
}

a {
  color: var(--primary-green);
}

a:hover {
  color: var(--light-green);
}

button {
  font-family: inherit;
}

/* Remove number input spinners globally */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}
</style>
