import { getAnthropicClient } from './anthropic';
import { loadClassificationPrompts } from './prompts';
import { getRouting } from './routing';
import { getUnclassifiedPosts, updatePostClassification } from './db';
import { ClassificationResult, Post } from '@/types';

const CLASSIFICATION_TOOL = {
  name: 'submit_classifications',
  description: 'Submit topic and role classifications for community posts.',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const },
            topic: {
              type: 'string' as const,
              enum: [
                'paid_ads', 'content_organic', 'lead_gen_funnels', 'email_outreach',
                'ai_tools', 'sales_offers', 'tracking_analytics', 'scaling_strategy',
                'hiring', 'operations', 'conversational',
              ],
            },
            role: {
              type: 'string' as const,
              enum: ['giver', 'seeker', 'neutral'],
            },
            reasoning: { type: 'string' as const },
          },
          required: ['id', 'topic', 'role', 'reasoning'],
        },
      },
    },
    required: ['items'],
  },
};

const BATCH_SIZE = 10;

function formatPostsForClassification(posts: Post[]): string {
  return posts
    .map(
      (p, i) =>
        `[${i + 1}] ID: ${p.id}\nType: ${p.postType}\nTitle: ${p.title}\nContent: ${p.content}\n`
    )
    .join('\n---\n\n');
}

export async function classifyPosts(): Promise<{ classified: number; errors: number }> {
  const client = getAnthropicClient();
  const systemPrompt = loadClassificationPrompts();
  const posts = await getUnclassifiedPosts();

  let classified = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const userMessage = formatPostsForClassification(batch);

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: [CLASSIFICATION_TOOL],
        tool_choice: { type: 'tool', name: 'submit_classifications' },
        messages: [
          {
            role: 'user',
            content: `Classify these ${batch.length} community posts:\n\n${userMessage}`,
          },
        ],
      });

      // Extract results from tool use block
      const toolBlock = response.content.find(
        (block) => block.type === 'tool_use' && block.name === 'submit_classifications'
      );

      if (toolBlock && toolBlock.type === 'tool_use') {
        const input = toolBlock.input as { items: ClassificationResult[] };
        for (const item of input.items) {
          try {
            const routing = getRouting(item.topic);
            await updatePostClassification(
              item.id,
              item.topic,
              item.role,
              item.reasoning,
              routing.repliers,
              routing.voiceProfile
            );
            classified++;
          } catch (err) {
            console.error(`Failed to update classification for post ${item.id}:`, err);
            errors++;
          }
        }
      }
    } catch (err) {
      console.error(`Failed to classify batch starting at index ${i}:`, err);
      errors += batch.length;
    }
  }

  return { classified, errors };
}
