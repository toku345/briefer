import { useQuery } from '@tanstack/react-query';
import type { GetModelsResponse, ModelInfo } from '@/lib/types';

export function useModels() {
  return useQuery<ModelInfo[]>({
    queryKey: ['models'],
    queryFn: async () => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'GET_MODELS',
        })) as GetModelsResponse;

        if (!response.success) {
          throw new Error(response.error ?? 'Failed to fetch models');
        }

        return response.models ?? [];
      } catch (error) {
        // Service Worker接続エラーも含め、全てのエラーをログ出力して再スロー
        console.error('[Briefer] Failed to fetch models:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
