/**
 * Session metadata types
 */

export interface SessionMetadata {
  mode?: 'default' | 'plan'
  planFilePath?: string
  [key: string]: unknown
}
