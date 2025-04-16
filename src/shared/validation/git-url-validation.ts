/**
 * Shared validation utilities for Git repository URLs
 * This module is used by both the frontend and backend
 */

/**
 * Regular expression patterns for validating Git repository URLs
 */
export const GIT_URL_PATTERNS = {
	// GitHub web URL with /tree/ or /blob/ paths
	// Captures username, repo name, branch, and subdirectory path
	GITHUB_WEB_URL: /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/(tree|blob)\/([^/]+)(?:\/(.*))?$/,

	// HTTPS pattern (GitHub, GitLab, Bitbucket, etc.)
	// Examples:
	// - https://github.com/username/repo
	// - https://github.com/username/repo.git
	// - https://gitlab.com/username/repo
	// - https://bitbucket.org/username/repo
	HTTPS: /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org|dev\.azure\.com)\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/,

	// SSH pattern
	// Examples:
	// - git@github.com:username/repo.git
	// - git@gitlab.com:username/repo.git
	SSH: /^git@(github\.com|gitlab\.com|bitbucket\.org):([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(\.git)?$/,

	// Git protocol pattern
	// Examples:
	// - git://github.com/username/repo.git
	GIT_PROTOCOL: /^git:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/,
}

/**
 * Converts a GitHub web URL to a valid Git repository URL and extracts the subdirectory path
 * @param url The URL to convert
 * @returns An object with the valid Git repository URL and subdirectory path, or null if not a GitHub web URL
 */
export function convertGitHubWebUrl(url: string): { validUrl: string; subdir?: string } | null {
	// Trim the URL to remove any leading/trailing whitespace
	const trimmedUrl = url.trim()

	// Check if this is a GitHub web URL with /tree/ or /blob/
	const match = trimmedUrl.match(GIT_URL_PATTERNS.GITHUB_WEB_URL)

	if (match) {
		// Extract the username, repo name, branch, and subdirectory path
		const [, username, repo, , , subdir] = match
		// Convert to a valid Git repository URL
		return {
			validUrl: `https://github.com/${username}/${repo}.git`,
			subdir,
		}
	}

	return null
}

/**
 * Checks if a URL is a valid Git repository URL
 * @param url The URL to validate
 * @returns True if the URL is a valid Git repository URL or a GitHub web URL that can be converted, false otherwise
 */
export function isValidGitRepositoryUrl(url: string): boolean {
	// Trim the URL to remove any leading/trailing whitespace
	const trimmedUrl = url.trim()

	// Check if this is a GitHub web URL that can be converted
	if (convertGitHubWebUrl(trimmedUrl) !== null) {
		return true
	}

	// Check against standard Git URL patterns
	return (
		GIT_URL_PATTERNS.HTTPS.test(trimmedUrl) ||
		GIT_URL_PATTERNS.SSH.test(trimmedUrl) ||
		GIT_URL_PATTERNS.GIT_PROTOCOL.test(trimmedUrl)
	)
}
