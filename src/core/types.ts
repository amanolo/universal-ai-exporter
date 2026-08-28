/**
 * Universal AI Exporter - Core Types
 */

export type AIPlatform = 'chatgpt' | 'claude' | 'perplexity' | 'deepseek' | 'gemini' | 'unknown';

export type MessageRole = 'user' | 'assistant' | 'system' | 'thought';

export interface CodeBlock {
  language: string;
  code: string;
}

export interface ClaudeArtifact {
  id?: string;
  title: string;
  type: 'code' | 'markdown' | 'html' | 'svg' | 'react' | 'unknown';
  language?: string;
  content: string;
}

export interface WebCitation {
  index: number;
  title: string;
  url: string;
  snippet?: string;
  siteName?: string;
  publishedDate?: string;
}

export interface ExtractedMessage {
  id: string;
  role: MessageRole;
  author: string;
  timestamp?: string;
  contentHtml: string;
  contentText: string;
  model?: string;
  codeBlocks: CodeBlock[];
  reasoning?: string; // DeepSeek <think> reasoning process
  artifacts?: ClaudeArtifact[]; // Claude artifacts
  citations?: WebCitation[]; // Perplexity citations/sources
  tables?: string[][][]; // 3D array: tables -> rows -> cells
}

export interface ConversationData {
  id: string;
  title: string;
  platform: AIPlatform;
  url: string;
  exportedAt: string;
  model?: string;
  messages: ExtractedMessage[];
  totalTablesCount: number;
  metadata?: Record<string, unknown>;
}

export type PDFTheme = 'executive' | 'midnight' | 'academic';

export type ExportScopeMode = 'all' | 'latest' | 'last3' | 'custom';

export interface ExportScope {
  mode: ExportScopeMode;
  selectedMessageIds?: string[];
}

export interface ExportOptions {
  format: 'pdf' | 'markdown' | 'csv';
  pdfTheme?: PDFTheme;
  scope?: ExportScope;
  includeReasoning?: boolean;
  includeArtifacts?: boolean;
  includeCitations?: boolean;
  includeFrontmatter?: boolean;
  selectedTableIndex?: number; // For CSV: -1 for all tables, or specific table index
  customHeader?: string;
}

export interface LicensePayload {
  email: string;
  tier: 'free' | 'pro';
  issuedAt: number;
  expires: 'lifetime' | number;
}

export interface LicenseStatus {
  isPro: boolean;
  tier: 'free' | 'pro';
  email?: string;
  expires?: string;
  licenseKey?: string;
  activatedAt?: string;
}

export interface ExtractionResult {
  success: boolean;
  conversation?: ConversationData;
  error?: string;
}
