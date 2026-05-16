import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'

// P0-4 שכבה 2: ניטור שגיאות אוטומטי בפרודקשן
// פועל רק כשבונים production (npm run build). במצב dev — שקט לחלוטין.
Sentry.init({
  dsn: 'https://54d7918abefb443fb7748776b9ae2241@o4511360802291712.ingest.us.sentry.io/4511399842086912',
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  // sampling — בפרויקט קטן עם משתמש יחיד מספיק לדגום מעט
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0,        // ללא session replay רגיל (חוסך quota)
  replaysOnErrorSampleRate: 1.0,      // אם יש error — מצלם session ל-debug
  // הפעלות
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,              // מסתיר טקסט (הגנה על נתונים פיננסיים)
      blockAllMedia: true,
    }),
  ],
  // פרטיות — האפליקציה מטפלת בנתונים פיננסיים, לכן לא שולחים PII כברירת מחדל
  sendDefaultPii: false,
  // לא לשלוח שגיאות שגרתיות שלא מעניינות אותנו
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],
})

const FallbackUI = ({ resetError }) => (
  <div style={{
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: "-apple-system,'Heebo',sans-serif",
    direction: 'rtl',
    background: '#F4F6F9',
    color: '#0A1F44',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>משהו השתבש</div>
    <div style={{ fontSize: 14, color: '#64748B', marginBottom: 24, maxWidth: 320 }}>
      קרתה שגיאה בלתי צפויה. הצוות קיבל הודעה ויטפל. אפשר לנסות לרענן.
    </div>
    <button
      onClick={resetError}
      style={{
        background: '#1B4FD8',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        padding: '14px 32px',
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      רענן
    </button>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={FallbackUI} showDialog={false}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
