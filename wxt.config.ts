import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Briefer',
    description: 'ローカルLLMでページを素早く要約・チャット',
    permissions: ['activeTab', 'scripting', 'storage', 'contextMenus'],
    host_permissions: ['http://localhost:*/*'],
    action: {
      default_title: 'Open Briefer',
      default_icon: {
        16: '/icon-16.png',
        48: '/icon-48.png',
        128: '/icon-128.png',
      },
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; style-src 'self'; connect-src 'self' http://localhost:*",
    },
  },
});
