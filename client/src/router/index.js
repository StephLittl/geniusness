import { createRouter, createWebHistory } from 'vue-router'
import Signup from '../views/Signup.vue'
import Login from '../views/Login.vue'
import Home from '../views/Home.vue'
import Leagues from '../views/Leagues.vue'
import LeagueView from '../views/LeagueView.vue'
import LeagueJoin from '../views/LeagueJoin.vue'
import LeagueStart from '../views/LeagueCreate.vue'
import Stats from '../views/Stats.vue'
import ConnectExtension from '../views/ConnectExtension.vue'
import { useUserStore } from '../store/userStore'

const routes = [
  { path: '/', component: Home },
  { path: '/signup', component: Signup },
  { path: '/login', component: Login },
  { path: '/games/select', component: () => import('../views/GameSelection.vue') },
  { path: '/games/manage', component: () => import('../views/ManageGames.vue') },
  { path: '/leagues', component: Leagues },
  { path: '/leagues/:id', component: LeagueView, name: 'league-view' },
  { path: '/leagues/join', component: LeagueJoin },
  { path: '/leagues/create', component: LeagueStart },
  { path: '/stats', component: Stats },
  { path: '/connect-extension', component: ConnectExtension }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const store = useUserStore();
  const loggedIn = !!store.user?.id;

  if ((to.path.startsWith('/leagues') || to.path.startsWith('/games') || to.path === '/' || to.path === '/stats' || to.path === '/connect-extension') && !loggedIn) {
    next('/login');
  } else {
    next();
  }
});

export default router
