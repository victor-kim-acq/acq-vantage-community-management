import { readFileSync } from 'fs';
import { join } from 'path';

const PROMPTS_DIR = join(process.cwd(), 'prompts');

export function loadPrompt(filename: string): string {
  const filepath = join(PROMPTS_DIR, filename);
  return readFileSync(filepath, 'utf-8');
}

export function loadClassificationPrompts(): string {
  const main = loadPrompt('topic_classification.md');
  const edgeCases = loadPrompt('classification_edge_cases.md');
  return `${main}\n\n${edgeCases}`;
}

export function loadReplyDraftingPrompt(): string {
  return loadPrompt('reply_drafting.md');
}
