import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        registration: resolve(__dirname, 'registration.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        profile: resolve(__dirname, 'profile.html'),
        service: resolve(__dirname, 'service.html'),
        mess: resolve(__dirname, 'mess.html'),
        notifications: resolve(__dirname, 'notifications.html'),
        payments: resolve(__dirname, 'payments.html'),
        messReduction: resolve(__dirname, 'mess-reduction.html'),
        wardenDashboard: resolve(__dirname, 'warden-dashboard.html')
      }
    }
  }
});
