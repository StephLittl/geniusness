<template>
  <div class="connect-extension-page">
    <h1 class="page-title">Connect browser extension</h1>

    <section v-if="connected" class="connect-status connected">
      <div class="status-icon">✓</div>
      <h2>You're already connected</h2>
      <p class="status-hint">Your Geniusness extension is linked to this account. You only need to connect once per browser.</p>
      <p class="reconnect-hint">If you reinstalled the extension or use a different browser, click below to send your credentials again.</p>
      <button
        type="button"
        class="btn-secondary"
        :disabled="sending"
        @click="sendCredentials"
      >
        {{ sending ? 'Sending…' : 'Send credentials again' }}
      </button>
    </section>

    <section v-else class="connect-status not-connected">
      <h2>Link your extension</h2>
      <p class="status-hint">Link the Geniusness browser extension so you can send scores from puzzle sites (NYT Games, Washington Post Keyword, etc.) with one click.</p>
      <ol class="connect-steps">
        <li>Install the extension from the <code>extension</code> folder (see extension/README.md in the project).</li>
        <li>Open the extension popup and set your <strong>API base URL</strong> and <strong>App origin</strong>.</li>
        <li>Click the button below to send your account credentials to the extension.</li>
      </ol>
      <button
        type="button"
        class="btn-primary"
        :disabled="sending"
        @click="sendCredentials"
      >
        {{ sending ? 'Sending…' : 'Send credentials to extension' }}
      </button>
      <p v-if="error" class="error-msg">{{ error }}</p>
    </section>
  </div>
</template>

<script>
import { useUserStore } from '../store/userStore'

const STORAGE_KEY = 'geniusness_extension_connected'

export default {
  name: 'ConnectExtension',
  data() {
    return {
      connected: false,
      sending: false,
      error: null
    }
  },
  setup() {
    return { store: useUserStore() }
  },
  mounted() {
    this.connected = localStorage.getItem(STORAGE_KEY) === '1'
    this._listener = (event) => {
      if (event.data && event.data.type === 'GENIUSNESS_EXTENSION_CONNECT_RESPONSE') {
        this.sending = false
        if (event.data.ok) {
          this.connected = true
          this.error = null
          localStorage.setItem(STORAGE_KEY, '1')
        } else {
          this.error = event.data.error || 'Connection failed.'
        }
      }
    }
    window.addEventListener('message', this._listener)
  },
  beforeUnmount() {
    if (this._listener) {
      window.removeEventListener('message', this._listener)
    }
  },
  methods: {
    sendCredentials() {
      this.sending = true
      this.error = null
      const apiBaseUrl = (import.meta.env.VITE_API_URL || '').trim() || (typeof window !== 'undefined' ? window.location.origin : '')
      const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''
      window.postMessage(
        {
          type: 'GENIUSNESS_EXTENSION_CONNECT',
          payload: {
            apiBaseUrl,
            appOrigin,
            userId: this.store.user?.id,
            accessToken: this.store.accessToken ?? null
          }
        },
        '*'
      )
    }
  }
}
</script>

<style scoped>
.connect-extension-page {
  max-width: 560px;
}

.page-title {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  color: var(--primary-green, #2d5a3d);
}

.connect-status {
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #fafafa;
}

.connect-status.connected {
  background: #f0f8f0;
  border-color: var(--light-green, #4a7c59);
}

.connect-status h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
  color: #333;
}

.connect-status.connected .status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--light-green, #4a7c59);
  color: white;
  font-weight: bold;
  margin-bottom: 0.75rem;
}

.status-hint,
.reconnect-hint {
  margin: 0 0 0.75rem 0;
  color: #555;
  font-size: 0.95rem;
}

.reconnect-hint {
  font-size: 0.9rem;
  color: #666;
}

.connect-steps {
  margin: 0 0 1.25rem 1.25rem;
  padding: 0;
  color: #555;
  font-size: 0.95rem;
  line-height: 1.6;
}

.connect-steps li {
  margin-bottom: 0.5rem;
}

.connect-steps code {
  font-size: 0.9em;
  background: #eee;
  padding: 0.1em 0.3em;
  border-radius: 4px;
}

.btn-primary,
.btn-secondary {
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: var(--light-green, #4a7c59);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-green, #2d5a3d);
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #d0d0d0;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-msg {
  margin: 0.75rem 0 0 0;
  color: #c62828;
  font-size: 0.9rem;
}
</style>
