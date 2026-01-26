import axios from 'axios'

// Get API base URL from environment variable
// In development, this will be empty (uses relative paths with Vite proxy)
// In production, set VITE_API_URL to your backend URL (e.g., https://api.yourapp.com)
const apiBaseURL = import.meta.env.VITE_API_URL || ''

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: apiBaseURL
})

export default apiClient
