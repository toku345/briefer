import { extractMainContent } from '../lib/extractor';
import type { ContentResponse } from '../lib/types';

chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse): boolean => {
    if (message.type === 'GET_CONTENT') {
      try {
        const content = extractMainContent(document);
        sendResponse({ success: true, data: content } as ContentResponse);
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        } as ContentResponse);
      }
    }
    return true;
  }
);
