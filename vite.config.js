import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
    base: './',
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    plugins: [
        react(),
        electron([
            {
                entry: 'electron/main.ts',
                onstart: function (options) {
                    options.startup();
                },
                vite: {
                    build: {
                        sourcemap: true,
                        outDir: 'dist-electron',
                        rollupOptions: {
                            external: ['electron']
                        }
                    }
                }
            },
            {
                entry: 'electron/preload.ts',
                onstart: function (options) {
                    options.reload();
                },
                vite: {
                    build: {
                        sourcemap: true,
                        outDir: 'dist-electron'
                    }
                }
            }
        ]),
        renderer()
    ],
    server: {
        port: 5173,
        host: true
    },
    css: {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true
            }
        }
    }
});
