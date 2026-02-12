import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Briefer',
    description: 'ローカルLLMでページを素早く要約・チャット',
    version: '2.0.0',
    permissions: ['activeTab', 'scripting', 'sidePanel', 'storage', 'contextMenus'],
    host_permissions: ['http://localhost:*/*'],
    action: { default_title: 'Open Briefer' },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; style-src 'self'; connect-src 'self' http://localhost:*",
    },
  },
});
