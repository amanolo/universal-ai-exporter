/**
 * Universal AI Exporter - CSV & Table Extractor Engine
 * Extracts HTML tables into RFC 4180 compliant CSV format with UTF-8 BOM support.
 */

import { ConversationData } from '../types';

export class CSVExporter {
  /**
   * Escapes a single cell according to RFC 4180 standards
   */
  private static escapeCell(cell: string): string {
    const stringVal = cell == null ? '' : String(cell);
    if (stringVal.includes('"') || stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('\r')) {
      return `"${stringVal.replace(/"/g, '""')}"`;
    }
    return stringVal;
  }

  /**
   * Converts a 2D table matrix into an RFC 4180 CSV string
   */
  public static tableToCSV(tableData: string[][]): string {
    return tableData.map(row => row.map(cell => this.escapeCell(cell)).join(',')).join('\r\n');
  }

  /**
   * Collects all tables from the conversation and generates CSV export
   */
  public static exportTables(
    conversation: ConversationData,
    tableIndex?: number
  ): { csvContent: string; count: number; filename: string } {
    const allTables: { messageAuthor: string; table: string[][] }[] = [];

    conversation.messages.forEach(msg => {
      if (msg.tables && msg.tables.length > 0) {
        msg.tables.forEach(t => {
          allTables.push({ messageAuthor: msg.author, table: t });
        });
      }
    });

    if (allTables.length === 0) {
      return {
        csvContent: '\uFEFFNo tables found in this conversation.',
        count: 0,
        filename: 'empty-tables.csv'
      };
    }

    // Single table selection
    if (typeof tableIndex === 'number' && tableIndex >= 0 && tableIndex < allTables.length) {
      const selected = allTables[tableIndex];
      const csv = '\uFEFF' + this.tableToCSV(selected.table);
      return {
        csvContent: csv,
        count: 1,
        filename: `table-${tableIndex + 1}.csv`
      };
    }

    // Consolidated CSV with table headers
    const sections: string[] = [];
    allTables.forEach((item, idx) => {
      sections.push(`--- TABLE ${idx + 1} (${item.messageAuthor}) ---`);
      sections.push(this.tableToCSV(item.table));
      sections.push('\r\n');
    });

    // Add UTF-8 BOM (\uFEFF) so Excel opens UTF-8 properly without mangling special characters
    const fullContent = '\uFEFF' + sections.join('\r\n');
    return {
      csvContent: fullContent,
      count: allTables.length,
      filename: `all-tables-${conversation.id}.csv`
    };
  }
}
