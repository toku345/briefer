import { useQuery } from '@tanstack/react-query';
import type { ModelInfo } from '@/lib/types';

interface ModelsResponse {
  success: boolean;
  models?: ModelInfo[];
  error?: string;
}

export function useModels() {
  return useQuery<ModelInfo[]>({
    queryKey: ['models'],
    queryFn: async () => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'GET_MODELS',
        })) as ModelsResponse;

        if (!response.success) {
          throw new Error(response.error ?? 'Failed to fetch models');
        }

        return response.models ?? [];
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('Could not establish connection') ||
            error.message.includes('Receiving end does not exist'))
        ) {
          return [];
        }
        console.error('[Briefer] Failed to fetch models:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
