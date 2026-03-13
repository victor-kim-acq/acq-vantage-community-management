import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient } from '@/lib/anthropic';
import { loadReplyDraftingPrompt } from '@/lib/prompts';
import { getPostById, getCommentsByPostId, saveDraft } from '@/lib/db';
import { Draft } from '@/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { postId, secret } = body;

  // Allow access via cron secret OR logged-in session cookie
  const hasSecret = secret === process.env.CRON_SECRET;
  const hasCookie = request.cookies.get('acq_auth')?.value === 'authenticated';
  if (!hasSecret && !hasCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 });
  }

  try {
    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const comments = await getCommentsByPostId(postId);
    const systemPrompt = loadReplyDraftingPrompt();
    const voiceProfile = post.voiceProfile || 'A';

    // Build thread context (limit to last 30 comments to avoid timeout)
    const recentComments = comments.slice(-30);
    const threadContext = recentComments.length > 0
      ? (comments.length > 30 ? `[Showing last 30 of ${comments.length} comments]\n` : '') +
        recentComments.map(c => `- ${c.authorName}: ${c.content} (${c.upvotes} upvotes)`).join('\n')
      : 'No comments yet.';

    // Build voice profile instructions
    let voiceInstruction: string;
    if (voiceProfile === 'A') {
      voiceInstruction = 'Generate both a SHORT version (3-5 lines) and a LONG version (8-12 lines). Separate them with "---SHORT---" and "---LONG---" markers.';
    } else {
      voiceInstruction = 'Generate a single short reply.';
    }

    const userMessage = `Post Title: ${post.title}
Post Author: ${post.authorName}
Post Content: ${post.content}
Topic: ${post.topic || 'unclassified'}
Role: ${post.role || 'unknown'}

Thread Context (${comments.length} comments):
${threadContext}

Generate a draft reply using Voice Profile ${voiceProfile}.
${voiceInstruction}

The reply should @ mention the post author on the first line.
Review all existing comments before drafting — do not repeat advice already given.`;

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const responseText = response.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('\n');

    const drafts: Draft[] = [];

    if (voiceProfile === 'A') {
      // Parse short and long versions
      const shortMatch = responseText.match(/---SHORT---\s*([\s\S]*?)(?:---LONG---|$)/);
      const longMatch = responseText.match(/---LONG---\s*([\s\S]*?)$/);

      const shortContent = shortMatch?.[1]?.trim() || responseText.trim();
      const longContent = longMatch?.[1]?.trim() || '';

      if (shortContent) {
        const draft = await saveDraft({
          postId,
          draftType: 'short',
          content: shortContent,
          voiceProfile,
        });
        drafts.push(draft);
      }

      if (longContent) {
        const draft = await saveDraft({
          postId,
          draftType: 'long',
          content: longContent,
          voiceProfile,
        });
        drafts.push(draft);
      }

      // If parsing failed, save the whole response as short
      if (drafts.length === 0) {
        const draft = await saveDraft({
          postId,
          draftType: 'short',
          content: responseText.trim(),
          voiceProfile,
        });
        drafts.push(draft);
      }
    } else {
      const draft = await saveDraft({
        postId,
        draftType: 'short',
        content: responseText.trim(),
        voiceProfile,
      });
      drafts.push(draft);
    }

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('Draft generation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Draft generation failed' },
      { status: 500 }
    );
  }
}
