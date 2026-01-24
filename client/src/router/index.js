import { createRouter, createWebHistory } from 'vue-router'
import Signup from '../views/Signup.vue'
import Login from '../views/Login.vue'
import League from '../views/League.vue'
import LeagueView from '../views/LeagueView.vue'
import LeagueJoin from '../views/LeagueJoin.vue'
import LeagueStart from '../views/LeagueCreate.vue'
import { useUserStore } from '../store/userStore'

const routes = [
  { path: '/', redirect: '/league' },
  { path: '/signup', component: Signup },
  { path: '/login', component: Login },
  { path: '/league', component: League },
  { path: '/league/view/:id', component: LeagueView, name: 'league-view' },
  { path: '/league/join', component: LeagueJoin },
  { path: '/league/create', component: LeagueStart },
  { path: '/league/stats', component: () => import('../views/Stats.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const store = useUserStore(); // Pinia/Vuex
  const loggedIn = !!store.user?.id;

  if (to.path.startsWith('/league') && !loggedIn) {
    next('/login');
  } else {
    next();
  }
});

export default router
