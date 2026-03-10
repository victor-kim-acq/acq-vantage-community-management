export interface Post {
  id: string;
  slug: string;
  title: string;
  content: string;
  postType: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  upvotes: number;
  isPinned: boolean;
  authorId: string;
  authorName: string;
  authorFirstName: string;
  authorLastName: string;
  authorBio: string;
  // Classification
  topic: string | null;
  role: string | null;
  classificationReasoning: string | null;
  // Routing
  suggestedRepliers: string[] | null;
  voiceProfile: 'A' | 'B' | null;
  // Workflow
  replyStatus: 'pending' | 'drafted' | 'replied' | 'skipped';
  assignedTo: string | null;
  // Metadata
  scrapedAt: string;
  classifiedAt: string | null;
  skoolUrl: string;
}

export interface Comment {
  id: string;
  postId?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  upvotes: number;
  parentId: string | null;
  rootId: string | null;
  authorId: string;
  authorName: string;
  authorFirstName: string;
  authorLastName: string;
  authorBio: string;
  scrapedAt?: string;
}

export interface Draft {
  id: number;
  postId: string;
  draftType: 'short' | 'long' | 'conversational';
  content: string;
  voiceProfile: 'A' | 'B';
  generatedAt: string;
  editedContent: string | null;
  editedAt: string | null;
}

export interface ClassificationResult {
  id: string;
  topic: string;
  role: string;
  reasoning: string;
}

export interface ScrapeResult {
  postsScraped: number;
  commentsScraped: number;
  newPosts: number;
  updatedPosts: number;
}

export type Topic =
  | 'paid_ads'
  | 'content_organic'
  | 'lead_gen_funnels'
  | 'email_outreach'
  | 'ai_tools'
  | 'sales_offers'
  | 'tracking_analytics'
  | 'scaling_strategy'
  | 'hiring'
  | 'operations'
  | 'conversational';

export type Role = 'giver' | 'seeker' | 'neutral';
