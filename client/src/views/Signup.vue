<template>
  <div class="signup">
    <h2>Sign Up</h2>
    <form @submit.prevent="signup">
      <div>
        <input v-model="firstName" placeholder="First name" />
      </div>
      <div>
        <input v-model="lastName" placeholder="Last name" />
      </div>
      <div>
        <input v-model="username" placeholder="Username" required />
      </div>
      <div>
        <input v-model="email" type="email" placeholder="Email" required />
      </div>
      <div>
        <input v-model="password" type="password" placeholder="Password" required />
      </div>
      <button type="submit">Sign Up</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <p><router-link to="/login">Already have an account? Log in</router-link></p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const firstName = ref('')
const lastName = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const error = ref(null)

async function signup() {
  error.value = null
  try {
    const res = await axios.post('/api/auth/signup', {
      firstName: firstName.value,
      lastName: lastName.value,
      username: username.value,
      email: email.value,
      password: password.value
    })
    // Store user temporarily for game selection
    const { useUserStore } = await import('../store/userStore')
    const store = useUserStore()
    store.setUser({ id: res.data.user.id, email: res.data.user.email, username: username.value })
    router.push('/games/select')
  } catch (err) {
    error.value = err.response?.data?.error || 'Signup failed'
  }
}
</script>

<style scoped>
.signup { max-width: 400px; margin: auto; }
.signup input { display: block; width: 100%; margin-bottom: 0.5rem; padding: 0.5rem; }
.error { color: #e74; margin-top: 1rem; }
</style>
  