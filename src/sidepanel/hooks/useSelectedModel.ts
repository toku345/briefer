import { useCallback, useEffect, useState } from 'react';
import type { GetSelectedModelResponse, SetSelectedModelResponse } from '@/lib/types';

export function useSelectedModel() {
  const [model, setModel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: 'GET_SELECTED_MODEL' })
      .then((result) => {
        const response = result as GetSelectedModelResponse;
        if (!response.success) {
          throw new Error(response.error ?? 'Failed to load selected model');
        }
        setModel(response.data);
        setError(null);
      })
      .catch((error) => {
        console.error('[Briefer] Failed to load selected model:', error);
        setError(error instanceof Error ? error.message : 'モデル設定の読み込みに失敗しました');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const selectModel = useCallback(async (modelId: string) => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'SET_SELECTED_MODEL',
        modelId,
      })) as SetSelectedModelResponse;

      if (!response.success) {
        throw new Error(response.error ?? 'Failed to save selected model');
      }

      setModel(response.data.selectedModel);
      setError(null);
    } catch (error) {
      console.error('[Briefer] Failed to save selected model:', error);
      setError(error instanceof Error ? error.message : 'モデル設定の保存に失敗しました');
      throw error;
    }
  }, []);

  return { model, selectModel, isLoading, error };
}
