import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { join } from 'path'

// Basic crash logging
function logError(error: Error | string, context = '') {
  const timestamp = new Date().toISOString()
  const errorStr = error instanceof Error ? error.stack || error.message : String(error)
  const logEntry = `[${timestamp}] ${context}: ${errorStr}\n`
  const logFile = join(process.cwd(), 'vite-crash.log')
  writeFileSync(logFile, logEntry, { flag: 'a' })
}

// Process error handlers
process.on('uncaughtException', (err) => {
  logError(err, 'UNCAUGHT EXCEPTION')
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logError(String(reason), 'UNHANDLED REJECTION')
})

const apiProxyTarget = process.env.VITE_PROXY_TARGET || process.env.VITE_API_URL || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  logLevel: 'info',
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      overlay: true
    },
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
            logError(err, 'PROXY ERROR');
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  preview: {
    port: 5200,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
            logError(err, 'PROXY ERROR');
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  }
})