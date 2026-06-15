import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    // Listen on all network interfaces (LAN / Tailscale accessible), not just localhost.
    host: true,
    // Accept any Host header (e.g. Tailscale MagicDNS names / IPs); Vite blocks
    // unknown hosts by default and would return "host not allowed".
    allowedHosts: true,
  },
})
