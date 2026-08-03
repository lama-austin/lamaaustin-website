// Shared helpers for committing to content/events/ via the GitHub Contents API.
const GITHUB_OWNER = 'lama-austin';
const GITHUB_REPO = 'lamaaustin-website';
const GITHUB_BRANCH = 'main';

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

export async function githubListDir(env, path) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
    { headers: githubHeaders(env) }
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list ${path} returned ${res.status}`);
  return res.json();
}

export async function githubPutFile(env, path, content, message, sha) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...githubHeaders(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: base64Encode(content),
        branch: GITHUB_BRANCH,
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

export async function githubDeleteFile(env, path, sha, message) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'DELETE',
      headers: { ...githubHeaders(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha, branch: GITHUB_BRANCH }),
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
