export const ROUTING: Record<string, { repliers: string[]; voiceProfile: 'A' | 'B' }> = {
  paid_ads:           { repliers: ['Saulo', 'Caio'],            voiceProfile: 'A' },
  content_organic:    { repliers: ['Saulo', 'Caio'],            voiceProfile: 'A' },
  lead_gen_funnels:   { repliers: ['Saulo', 'Victor'],          voiceProfile: 'A' },
  email_outreach:     { repliers: ['Saulo', 'Victor'],          voiceProfile: 'A' },
  ai_tools:           { repliers: ['Victor'],                   voiceProfile: 'A' },
  sales_offers:       { repliers: ['Saulo', 'Caio', 'Victor'],  voiceProfile: 'A' },
  tracking_analytics: { repliers: ['Victor'],                   voiceProfile: 'A' },
  scaling_strategy:   { repliers: ['Caio'],                     voiceProfile: 'A' },
  hiring:             { repliers: ['Caio'],                     voiceProfile: 'A' },
  operations:         { repliers: ['Caio'],                     voiceProfile: 'A' },
  conversational:     { repliers: ['Samaria'],                  voiceProfile: 'B' },
};

export function getRouting(topic: string): { repliers: string[]; voiceProfile: 'A' | 'B' } {
  return ROUTING[topic] || { repliers: [], voiceProfile: 'A' };
}

/**
 * Team members to exclude from community analysis.
 * These are ACQ Vantage team members — never generate draft replies for their posts.
 */
export const TEAM_MEMBERS = [
  'Saulo Castelo Branco',
  'Saulo Medeiros',
  'Caio Beleza',
  'Victor Kim',
  'Samaria Simmons',
  'Alex Hormozi',
];

export function isTeamMember(name: string): boolean {
  return TEAM_MEMBERS.some(
    member => member.toLowerCase() === name.toLowerCase()
  );
}
