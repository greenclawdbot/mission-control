import { Task } from '@shared/src/types';

export const DEFAULT_PROMPTS = {
  coding: "You are a software development assistant. Create a detailed implementation plan for: {title}. Include specific steps, file structure, and technical considerations.",
  research: "Research and analyze the following topic: {title}. Provide comprehensive findings with supporting evidence, methodology, and recommendations.",
  documentation: "Create clear documentation for: {title}. Include API details, usage examples, and integration guides.",
  debugging: "Debug the following issue: {title}. Systematically identify root causes, propose solutions, and provide step-by-step resolution plan.",
  deployment: "Plan and execute deployment for: {title}. Include environment setup, rollback procedures, and verification steps.",
  review: "Conduct thorough code review of: {title}. Analyze architecture, identify issues, and provide improvement recommendations.",
  general: "You are a helpful AI assistant. Plan and execute the following task: {title}. Provide a structured approach with clear objectives and actionable steps."
} as const;

export function getDefaultPrompt(taskTitle: string, customPrompt?: string): string {
  // Try to detect task type based on title keywords
  const lowerTitle = taskTitle.toLowerCase();
  
  if (lowerTitle.includes('implement') || lowerTitle.includes('create') || lowerTitle.includes('build') || lowerTitle.includes('setup')) {
    return customPrompt || DEFAULT_PROMPTS.coding;
  }
  
  if (lowerTitle.includes('research') || lowerTitle.includes('analyze') || lowerTitle.includes('investigate') || lowerTitle.includes('study')) {
    return customPrompt || DEFAULT_PROMPTS.research;
  }
  
  if (lowerTitle.includes('document') || lowerTitle.includes('doc') || lowerTitle.includes('guide') || lowerTitle.includes('manual')) {
    return customPrompt || DEFAULT_PROMPTS.documentation;
  }
  
  if (lowerTitle.includes('debug') || lowerTitle.includes('fix') || lowerTitle.includes('issue') || lowerTitle.includes('error')) {
    return customPrompt || DEFAULT_PROMPTS.debugging;
  }
  
  if (lowerTitle.includes('deploy') || lowerTitle.includes('release') || lowerTitle.includes('production')) {
    return customPrompt || DEFAULT_PROMPTS.deployment;
  }
  
  if (lowerTitle.includes('review') || lowerTitle.includes('code') || lowerTitle.includes('test')) {
    return customPrompt || DEFAULT_PROMPTS.review;
  }
  
  // Default to general prompt if no specific type detected
  return customPrompt || DEFAULT_PROMPTS.general;
}
