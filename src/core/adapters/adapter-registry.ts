/**
 * Universal AI Exporter - Adapter Registry
 * Selects the optimal scraping engine based on active URL
 */

import { AIPlatform } from '../types';
import { AIPlatformAdapter } from './adapter-interface';
import { ChatGPTAdapter } from './chatgpt-adapter';
import { ClaudeAdapter } from './claude-adapter';
import { PerplexityAdapter } from './perplexity-adapter';
import { DeepSeekAdapter } from './deepseek-adapter';
import { GeminiAdapter } from './gemini-adapter';
import { FallbackAdapter } from './fallback-adapter';

export class AdapterRegistry {
  private static adapters: AIPlatformAdapter[] = [
    new ChatGPTAdapter(),
    new ClaudeAdapter(),
    new PerplexityAdapter(),
    new DeepSeekAdapter(),
    new GeminiAdapter(),
    new FallbackAdapter()
  ];

  /**
   * Returns the best matching adapter for the specified URL
   */
  public static getAdapter(url: string = window.location.href): AIPlatformAdapter {
    for (const adapter of this.adapters) {
      if (adapter.platform !== 'unknown' && adapter.matches(url)) {
        return adapter;
      }
    }
    // Return universal fallback
    return this.adapters[this.adapters.length - 1];
  }

  /**
   * Identifies the current AI platform name
   */
  public static detectPlatform(url: string = window.location.href): AIPlatform {
    const adapter = this.getAdapter(url);
    return adapter.platform;
  }
}
