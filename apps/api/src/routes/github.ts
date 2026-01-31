import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as taskService from '../services/taskService';
import githubService from '../services/githubService';

const createGitHubTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
  planningModel: z.string().optional(),
  github_repo: z.object({
    name: z.string(),
    owner: z.string()
  }).optional()
});

const githubRepoParamsSchema = z.object({
  owner: z.string(),
  repo: z.string()
});

export async function registerGitHubRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/github/repos - List repositories
  fastify.get('/api/v1/github/repos', async (request, reply) => {
    try {
      const repos = await githubService.getUserRepos();
      return reply.send({ repos });
    } catch (error) {
      console.error('GitHub repos error:', error);
      return reply.status(500).send({ error: 'Failed to fetch GitHub repositories' });
    }
  });

  // GET /api/v1/github/repos/:owner/:repo/issues - List repository issues
  fastify.get<{ Params: z.infer<typeof githubRepoParamsSchema> }>('/api/v1/github/repos/:owner/:repo/issues', async (request, reply) => {
    const { owner, repo } = request.params;
    const fullName = `${owner}/${repo}`;
    
    try {
      const issues = await githubService.getRepoIssues(fullName);
      return reply.send({ issues });
    } catch (error) {
      console.error('GitHub issues error:', error);
      return reply.status(500).send({ error: `Failed to fetch issues for ${fullName}` });
    }
  });

  // POST /api/v1/github/tasks - Create task from GitHub issue
  fastify.post<{
    Body: z.infer<typeof createGitHubTaskSchema>;
  }>('/api/v1/github/tasks', async (request, reply) => {
    const data = createGitHubTaskSchema.parse(request.body);
    
    try {
      // If GitHub repo not provided, return error
      if (!data.github_repo) {
        return reply.status(400).send({ error: 'GitHub repository information required' });
      }
      
      // Create a GitHub issue first
      const issue = await githubService.createIssue(
        data.github_repo.owner,
        data.github_repo.name,
        data.title,
        data.description
      );
      
      // Create a task linked to that GitHub issue
      const task = await taskService.createTask({
        title: data.title,
        description: data.description,
        assignee: 'clawdbot',
        priority: data.priority,
        systemPrompt: `Working on GitHub issue ${data.github_repo.owner}/${data.github_repo.name}#${issue.number}`,
        planningModel: data.planningModel,
        github_repo: {
          name: data.github_repo.name,
          owner: data.github_repo.owner,
          issue_number: issue.number
        }
      }, 'clawdbot');
      
      return reply.status(201).send({ task });
    } catch (error) {
      console.error('Create GitHub task error:', error);
      return reply.status(500).send({ error: 'Failed to create task from GitHub issue' });
    }
  });

  // Webhook handler for GitHub events
  async function handleGitHubWebhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any;
      console.log('GitHub webhook received:', body);
      
      // Handle different webhook events
      if (body.action === 'opened' || body.action === 'reopened') {
        // Issue opened/reopened - create or update task
        console.log(`Processing GitHub issue: ${body.repository.name}#${body.issue.number}`);
      } else if (body.action === 'closed') {
        // Issue closed - update task status to Done
        console.log(`GitHub issue closed: ${body.repository.name}#${body.issue.number}`);
      }
      
      return reply.status(200).send({ received: true });
    } catch (error) {
      console.error('GitHub webhook error:', error);
      return reply.status(500).send({ error: 'Webhook processing failed' });
    }
  }

  // Register webhook route
  fastify.post('/api/v1/github/webhook', handleGitHubWebhook);
}