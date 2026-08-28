/**
 * Universal AI Exporter - AI Platform Adapter Interface
 */

import { AIPlatform, ConversationData } from '../types';

export interface AIPlatformAdapter {
  /**
   * Unique platform identifier
   */
  readonly platform: AIPlatform;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Tests if this adapter matches the current URL or DOM structure
   */
  matches(url: string): boolean;

  /**
   * Extracts the full conversation data from the active DOM
   */
  extractConversation(): Promise<ConversationData>;
}
