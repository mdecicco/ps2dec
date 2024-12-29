import { defineConfig } from 'electron-vite';
import path from 'path';

export default defineConfig({
    main: {
        root: path.join(__dirname, 'src/apps/backend'),
        build: {
            outDir: '../../../build/apps/backend',
            sourcemap: true,
            rollupOptions: {
                input: {
                    index: path.join(__dirname, 'src/apps/backend/index.ts')
                }
            }
        },
        resolve: {
            alias: {
                ['apps/backend']: path.resolve(__dirname, 'src/apps/backend'),
                decompiler: path.resolve(__dirname, 'src/packages/decompiler'),
                decoder: path.resolve(__dirname, 'src/packages/decoder'),
                utils: path.resolve(__dirname, 'src/packages/utils'),
                messages: path.resolve(__dirname, 'src/packages/messages')
            }
        }
    },
    renderer: {
        root: path.join(__dirname, 'src/apps/frontend'),
        build: {
            outDir: '../../../build/apps/frontend',
            sourcemap: true,
            rollupOptions: {
                input: {
                    index: path.join(__dirname, 'src/apps/frontend/index.ts')
                }
            }
        },
        resolve: {
            alias: {
                ['apps/frontend']: path.resolve(__dirname, 'src/apps/frontend'),
                decompiler: path.resolve(__dirname, 'src/packages/decompiler'),
                decoder: path.resolve(__dirname, 'src/packages/decoder'),
                utils: path.resolve(__dirname, 'src/packages/utils'),
                messages: path.resolve(__dirname, 'src/packages/messages')
            }
        }
    }
});
