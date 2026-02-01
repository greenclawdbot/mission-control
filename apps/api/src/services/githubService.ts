import { exec } from 'child_process';
import { promisify } from 'util';

export interface GitHubRepo {
  name: string;
  owner: string;
  description?: string;
  private: boolean;
  language: string;
  default_branch: string;
  clone_url: string;
  ssh_url?: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url?: string;
}

const execAsync = promisify(exec);

export class GitHubService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getUserRepos(): Promise<GitHubRepo[]> {
    const { stdout } = await execAsync('gh repo list --limit 50 --json');
    const repos = JSON.parse(stdout);
    return repos.map((repo: { name?: string; owner?: { login?: string }; description?: string; private?: boolean; language?: string; default_branch?: string; clone_url?: string; ssh_url?: string }) => ({
      name: repo.name,
      owner: repo.owner?.login || 'unknown',
      description: repo.description || undefined,
      private: repo.private || false,
      language: repo.language || undefined,
      default_branch: repo.default_branch || 'main',
      clone_url: repo.clone_url || '',
      ssh_url: repo.ssh_url || undefined
    }));
  }

  async getRepoIssues(fullName: string): Promise<GitHubIssue[]> {
    const [owner, ...repoNameParts] = fullName.split('/');
    const repoName = repoNameParts.join('/');
    const { stdout } = await execAsync(`gh api repos/${owner}/${repoName}/issues --limit 20 --json`);
    const issues = JSON.parse(stdout);
    return issues.map((issue: any) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      html_url: issue.html_url || undefined
    }));
  }

  async createIssue(owner: string, repoName: string, title: string, body?: string): Promise<{ number: number; html_url: string }> {
    const { stdout } = await execAsync(`gh api repos/${owner}/${repoName}/issues --field title="${title}" --field body="${body || ''}"`);
    const result = JSON.parse(stdout);
    return {
      number: result.number,
      html_url: result.html_url || ''
    };
  }

  async updateIssue(fullName: string, issueNumber: number, state: string): Promise<void> {
    const [owner, ...repoNameParts] = fullName.split('/');
    const repoName = repoNameParts.join('/');
    await execAsync(`gh api repos/${owner}/${repoName}/issues/${issueNumber} --field state=${state}`);
  }

  async addComment(fullName: string, issueNumber: number, comment: string): Promise<void> {
    const [owner, ...repoNameParts] = fullName.split('/');
    const repoName = repoNameParts.join('/');
    await execAsync(`gh api repos/${owner}/${repoName}/issues/${issueNumber}/comments --field body="${comment}"`);
  }

  async closeIssue(fullName: string, issueNumber: number, comment?: string): Promise<void> {
    const [owner, ...repoNameParts] = fullName.split('/');
    const repoName = repoNameParts.join('/');
    await execAsync(`gh api repos/${owner}/${repoName}/issues/${issueNumber} --field state=closed`);
    if (comment) {
      await this.addComment(fullName, issueNumber, comment);
    }
  }
}

// Global service instance
const githubService = new GitHubService(process.env.GITHUB_TOKEN || '');
export default githubService;