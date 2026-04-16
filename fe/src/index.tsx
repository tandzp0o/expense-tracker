import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// ✅ Production: register SW để enable PWA install prompt
// ✅ Development: unregister SW để tránh conflict với HMR
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        if (process.env.NODE_ENV === 'production') {
            navigator.serviceWorker
                .register('/sw.js')
                .then(registration => {
                    console.log('[SW] Registered:', registration.scope);
                })
                .catch(err => {
                    console.error('[SW] Registration failed:', err);
                });
        } else {
            // Dev mode: dọn sạch SW cũ nếu có
            navigator.serviceWorker
                .getRegistrations()
                .then(registrations => {
                    registrations.forEach(r => {
                        r.unregister();
                        console.log('[SW] Unregistered for dev mode');
                    });
                });
        }
    });
}

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
