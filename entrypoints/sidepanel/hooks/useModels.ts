import { useQuery } from '@tanstack/react-query';
import { fetchModels } from '@/lib/llm-client';
import type { ModelInfo } from '@/lib/types';

export function useModels() {
  return useQuery<ModelInfo[]>({
    queryKey: ['models'],
    queryFn: () => fetchModels(),
    staleTime: 5 * 60 * 1000,
  });
}
