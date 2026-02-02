import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // manifest.json をコピー
      copyFileSync(resolve(__dirname, 'src/manifest.json'), resolve(distDir, 'manifest.json'));

      // アイコンをコピー
      const iconsDir = resolve(__dirname, 'src/icons');
      const distIconsDir = resolve(distDir, 'icons');
      mkdirSync(distIconsDir, { recursive: true });

      try {
        const icons = readdirSync(iconsDir);
        for (const icon of icons) {
          copyFileSync(resolve(iconsDir, icon), resolve(distIconsDir, icon));
        }
      } catch {
        // アイコンが存在しない場合は無視
      }

      // sidepanel HTMLを正しい場所に移動
      const srcSidepanelDir = resolve(distDir, 'src/sidepanel');
      const destSidepanelDir = resolve(distDir, 'sidepanel');

      if (existsSync(srcSidepanelDir)) {
        mkdirSync(destSidepanelDir, { recursive: true });
        const files = readdirSync(srcSidepanelDir);
        for (const file of files) {
          renameSync(resolve(srcSidepanelDir, file), resolve(destSidepanelDir, file));
        }
        // srcディレクトリを削除
        rmSync(resolve(distDir, 'src'), { recursive: true, force: true });
      }

      // CSSファイルをsidepanelに移動
      const assetsDir = resolve(distDir, 'assets');
      if (existsSync(assetsDir)) {
        const cssFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.css'));
        for (const css of cssFiles) {
          renameSync(resolve(assetsDir, css), resolve(destSidepanelDir, 'style.css'));
        }
        // assetsが空なら削除
        if (readdirSync(assetsDir).length === 0) {
          rmSync(assetsDir, { recursive: true });
        }
      }

      // HTMLファイルのパス参照を修正
      const htmlPath = resolve(destSidepanelDir, 'index.html');
      if (existsSync(htmlPath)) {
        let html = readFileSync(htmlPath, 'utf-8');
        // CSS参照を修正
        html = html.replace(/href="[^"]*sidepanel\.css"/g, 'href="style.css"');
        // JS参照を修正（相対パスに）
        html = html.replace(/src="[^"]*sidepanel\/index\.js"/g, 'src="index.js"');
        writeFileSync(htmlPath, html);
      }
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name]/index.js',
        chunkFileNames: 'shared/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  plugins: [react(), copyStaticAssets()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
