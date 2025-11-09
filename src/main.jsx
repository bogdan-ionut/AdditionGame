import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { installTtsShim } from './shims/tts-global'
import { resolveApiBaseUrl } from './lib/api/baseUrl'

installTtsShim()
resolveApiBaseUrl()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
