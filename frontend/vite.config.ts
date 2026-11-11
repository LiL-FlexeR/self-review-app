import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
	plugins: [react(), tailwind()],
	resolve: { alias: { '@app': fileURLToPath(new URL('./src', import.meta.url)) } },
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			'/api': {
				target: `http://localhost:${process.env.DEV_API_PORT ?? 3000}`,
				changeOrigin: false,
			},
		},
	},
});
