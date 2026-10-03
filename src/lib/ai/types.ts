export type TicketCategory =
  | 'duplicate_question'
  | 'billing'
  | 'bug'
  | 'feature_request';

export interface SimilarSolvedTicket {
  id: string;
  subject: string;
  description: string;
  resolutionSummary: string;
  resolvedAt?: string;
  similarityScore?: number;
}

export interface ClassificationResult {
  category: TicketCategory;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  isHighRisk: boolean; // true for billing, security, credentials
}

export interface SuggestedReplyResult {
  category: TicketCategory;
  confidence: number;
  reasoning: string;
  suggestedReplyText: string;
  similarTicketsUsed: SimilarSolvedTicket[];
  shouldRequireHumanReview: boolean;
  canAutoReply: boolean;
  autoReplied: boolean;
  provider: string;
}

export interface AutoReplyConfig {
  enabled: boolean;
  min_confidence: number;
  allowed_categories: TicketCategory[];
  excluded_categories: string[];
}
