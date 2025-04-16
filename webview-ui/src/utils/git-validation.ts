/**
 * Frontend version of Git repository URL validation
 * This should be kept in sync with the backend validation in src/services/package-manager/validation.ts
 */

/**
 * Converts a GitHub web URL to a valid Git repository URL and extracts the subdirectory path
 * @param url The URL to convert
 * @returns An object with the valid Git repository URL and subdirectory path, or null if not a GitHub web URL
 */
export function convertGitHubWebUrl(url: string): { validUrl: string; subdir?: string } | null {
	// Trim the URL to remove any leading/trailing whitespace
	const trimmedUrl = url.trim()

	// Check if this is a GitHub web URL with /tree/ or /blob/
	// This pattern captures the username, repo name, branch, and subdirectory path
	const githubWebUrlPattern =
		/^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/(tree|blob)\/([^/]+)(?:\/(.*))?$/
	const match = trimmedUrl.match(githubWebUrlPattern)

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

	// HTTPS pattern (GitHub, GitLab, Bitbucket, etc.)
	// Examples:
	// - https://github.com/username/repo
	// - https://github.com/username/repo.git
	// - https://gitlab.com/username/repo
	// - https://bitbucket.org/username/repo
	const httpsPattern =
		/^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org|dev\.azure\.com)\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/

	// SSH pattern
	// Examples:
	// - git@github.com:username/repo.git
	// - git@gitlab.com:username/repo.git
	const sshPattern = /^git@(github\.com|gitlab\.com|bitbucket\.org):([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(\.git)?$/

	// Git protocol pattern
	// Examples:
	// - git://github.com/username/repo.git
	const gitProtocolPattern =
		/^git:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/

	return httpsPattern.test(trimmedUrl) || sshPattern.test(trimmedUrl) || gitProtocolPattern.test(trimmedUrl)
}
