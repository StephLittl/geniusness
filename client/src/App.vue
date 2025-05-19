<template>
  <div>
    <h2>Geniusness</h2>
    <input v-model="score" placeholder="Enter score" />
    <button @click="submitScore">Submit</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const score = ref('')
const user_id = 'user123'
const league_id = 'league1'
const date = new Date().toISOString().split('T')[0]

async function submitScore() {
  await axios.post('https://your-backend.onrender.com/api/scores', {
    user_id,
    league_id,
    date,
    score: Number(score.value)
  })
  alert('Score submitted!')
}
</script>
