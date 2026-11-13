import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig(({ mode }) => {
	const environment = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'DEV_');

	return {
		plugins: [react(), tailwind()],
		resolve: { alias: { '@app': fileURLToPath(new URL('./src', import.meta.url)) } },
		server: {
			port: 5173,
			strictPort: true,
			proxy: {
				'/api': {
					target: `http://localhost:${environment.DEV_API_PORT ?? 3000}`,
					changeOrigin: false,
				},
			},
		},
	};
});
