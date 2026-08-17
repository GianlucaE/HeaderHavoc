import {defineConfig} from 'vitest/config';

export default defineConfig({
    plugins: [
        {
            name: 'headerhavoc-dev-chrome-mock',
            apply: 'serve',
            transformIndexHtml(html: string) {
                return html.replace('<head>', '<head><script type="module" src="/dev/mock-chrome.ts"></script>');
            },
        },
    ],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        target: 'esnext',
        rollupOptions: {
            input: {
                background: 'src/background/service-worker.ts',
                options: 'options.html',
                popup: 'popup.html',
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: 'assets/[name][extname]',
            },
        },
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
    },
});
