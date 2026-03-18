/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/llm-client', () => ({
  fetchModels: vi.fn(),
}));

const { useModels } = await import('../entrypoints/sidepanel/hooks/useModels');
const { fetchModels } = await import('../lib/llm-client');
const mockFetchModels = vi.mocked(fetchModels);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('useModels', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('enabled=false の場合 fetchModels を呼ばない', async () => {
    mockFetchModels.mockResolvedValue([]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useModels({ enabled: false }), { wrapper });

    expect(result.current.isFetching).toBe(false);
    expect(mockFetchModels).not.toHaveBeenCalled();
  });
});
