// Shared helpers for committing to content/events/ via the GitHub Contents API.
// Target branch is always caller-supplied (from env.GITHUB_BRANCH) rather than
// hardcoded, so a Preview deployment can never accidentally write to main.
const GITHUB_OWNER = 'lama-austin';
const GITHUB_REPO = 'lamaaustin-website';

export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function yamlString(str) {
  return `"${String(str).replace(/"/g, '\\"')}"`;
}

export function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export async function githubListDir(env, path, branch) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${branch}`,
    { headers: githubHeaders(env) }
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list ${path} returned ${res.status}`);
  return res.json();
}

export async function githubPutFile(env, path, content, message, sha, branch) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...githubHeaders(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: base64Encode(content),
        branch,
        ...(sha ? { sha } : {}),
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub PUT ${path} returned ${res.status}`);
  }
  return res.json();
}

export async function githubDeleteFile(env, path, sha, message, branch) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'DELETE',
      headers: { ...githubHeaders(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha, branch }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub DELETE ${path} returned ${res.status}`);
  }
}

function githubHeaders(env) {
  return {
    Authorization: `token ${env.GITHUB_TOKEN}`,
    'User-Agent': 'lama-austin-groupme-bot',
    Accept: 'application/vnd.github+json',
  };
}
