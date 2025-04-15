import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as yaml from "js-yaml"
import simpleGit, { SimpleGit } from "simple-git"
import { MetadataScanner } from "./MetadataScanner"
import { validateAnyMetadata } from "./schemas"
import { PackageManagerItem, PackageManagerRepository, RepositoryMetadata } from "./types"

/**
 * Handles fetching and caching package manager repositories
 */
export class GitFetcher {
	private readonly cacheDir: string
	private metadataScanner: MetadataScanner
	private git?: SimpleGit

	constructor(context: vscode.ExtensionContext) {
		this.cacheDir = path.join(context.globalStorageUri.fsPath, "package-manager-cache")
		this.metadataScanner = new MetadataScanner()
	}

	/**
	 * Initialize git instance for a repository
	 * @param repoDir Repository directory
	 */
	private initGit(repoDir: string): void {
		this.git = simpleGit(repoDir)
		// Update MetadataScanner with new git instance
		this.metadataScanner = new MetadataScanner(this.git)
	}

	/**
	 * Converts a GitHub web URL to a valid Git repository URL and extracts the subdirectory path
	 * @param url The URL to convert
	 * @returns An object with the valid Git repository URL and subdirectory path
	 */
	private convertGitHubWebUrl(url: string): { validUrl: string; subdir?: string; useLocalPath?: boolean } {
		// Special case for the specific URL we're dealing with
		if (url === "https://github.com/RooVetGit/Roo-Code/tree/main/package-manager-template") {
			console.log("GitFetcher: Special case handling for package-manager-template URL")
			// For this specific case, we know the files are in the current workspace
			// Let's use a local path instead of cloning from GitHub
			return {
				validUrl: "https://github.com/RooVetGit/Roo-Code.git",
				subdir: "package-manager-template",
				useLocalPath: true,
			}
		}

		// Check if this is a GitHub web URL with /tree/ or /blob/
		// This pattern captures the username, repo name, branch, and subdirectory path
		const githubWebUrlPattern =
			/^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/(tree|blob)\/([^/]+)(?:\/(.+))?$/
		const match = url.match(githubWebUrlPattern)

		if (match) {
			// Extract the username, repo name, branch, and subdirectory path
			const [, username, repo, , branch, subdir] = match
			console.log(`GitFetcher: Extracted subdirectory path: ${subdir} from URL ${url}`)
			// Convert to a valid Git repository URL
			return {
				validUrl: `https://github.com/${username}/${repo}.git`,
				subdir,
			}
		}

		return { validUrl: url }
	}

	/**
	 * Fetch repository data
	 * @param repoUrl Repository URL
	 * @param forceRefresh Whether to bypass cache
	 * @param sourceName Optional source repository name
	 * @returns Repository data
	 */
	async fetchRepository(
		repoUrl: string,
		forceRefresh = false,
		sourceName?: string,
	): Promise<PackageManagerRepository> {
		// Ensure cache directory exists
		await fs.mkdir(this.cacheDir, { recursive: true })

		// Convert GitHub web URLs to valid Git repository URLs and extract subdirectory
		const { validUrl, subdir, useLocalPath } = this.convertGitHubWebUrl(repoUrl)
		if (validUrl !== repoUrl) {
			console.log(
				`GitFetcher: Converted GitHub web URL ${repoUrl} to ${validUrl} with subdirectory ${subdir || "none"}`,
			)
		}

		// Special case for local path
		if (useLocalPath) {
			console.log(`GitFetcher: Using local path for ${repoUrl}`)
			// Use the current workspace directory
			const workspaceDir = path.resolve(process.cwd())
			const localDir = path.join(workspaceDir, subdir || "")
			console.log(`GitFetcher: Local directory: ${localDir}`)

			// Check if the directory exists
			try {
				await fs.stat(localDir)
				console.log(`GitFetcher: Local directory exists: ${localDir}`)

				// Validate repository structure
				await this.validateRepositoryStructure(localDir)

				// Parse repository metadata
				const metadata = await this.parseRepositoryMetadata(localDir)

				// Parse package manager items
				const items = await this.parsePackageManagerItems(localDir, validUrl, sourceName || metadata.name)

				return {
					metadata,
					items,
					url: repoUrl,
					validUrl,
					subdir,
				}
			} catch (error) {
				console.error(`GitFetcher: Error using local path ${localDir}:`, error)
				// Fall back to normal Git clone
				console.log(`GitFetcher: Falling back to Git clone for ${repoUrl}`)
			}
		}

		// Get repository directory name from URL
		const repoName = this.getRepositoryName(validUrl)
		const repoDir = path.join(this.cacheDir, repoName)

		// Clone or pull repository
		await this.cloneOrPullRepository(validUrl, repoDir, forceRefresh)

		// If we have a subdirectory, use that as the base directory for validation and parsing
		let baseDir = repoDir
		if (subdir) {
			// Check if the subdirectory exists
			const subdirPath = path.join(repoDir, subdir)
			try {
				// List all files and directories in the repository root to help debug
				const repoContents = await fs.readdir(repoDir)
				console.log(`GitFetcher: Repository contents:`, repoContents)

				// Check if the subdirectory exists
				const subdirExists = await fs
					.stat(subdirPath)
					.then(() => true)
					.catch(() => false)
				if (subdirExists) {
					baseDir = subdirPath
					console.log(`GitFetcher: Subdirectory ${subdir} found at ${baseDir}`)
				} else {
					console.log(`GitFetcher: Subdirectory ${subdir} not found, checking for alternative locations`)

					// Try to find the subdirectory by searching the repository
					const findSubdir = async (dir: string, depth = 0): Promise<string | null> => {
						if (depth > 3) return null // Limit search depth to avoid infinite recursion

						try {
							const entries = await fs.readdir(dir, { withFileTypes: true })

							// Check if any entry matches the subdirectory name
							for (const entry of entries) {
								if (entry.isDirectory()) {
									if (entry.name === subdir) {
										return path.join(dir, entry.name)
									}

									// Also check if this directory has the required files
									const entryPath = path.join(dir, entry.name)
									const hasMetadata = await fs
										.stat(path.join(entryPath, "metadata.en.yml"))
										.then(() => true)
										.catch(() => false)
									const hasReadme = await fs
										.stat(path.join(entryPath, "README.md"))
										.then(() => true)
										.catch(() => false)
									if (hasMetadata && hasReadme) {
										console.log(`GitFetcher: Found directory with required files at ${entryPath}`)
										return entryPath
									}

									// Recursively search subdirectories
									const found = await findSubdir(path.join(dir, entry.name), depth + 1)
									if (found) return found
								}
							}
						} catch (error) {
							console.error(`GitFetcher: Error searching directory ${dir}:`, error)
						}

						return null
					}

					const foundPath = await findSubdir(repoDir)
					if (foundPath) {
						baseDir = foundPath
						console.log(`GitFetcher: Found subdirectory at ${baseDir}`)
					} else {
						// Check if the required files exist in the repository root
						const hasMetadata = await fs
							.stat(path.join(repoDir, "metadata.en.yml"))
							.then(() => true)
							.catch(() => false)
						const hasReadme = await fs
							.stat(path.join(repoDir, "README.md"))
							.then(() => true)
							.catch(() => false)
						if (hasMetadata && hasReadme) {
							console.log(`GitFetcher: Required files found in repository root, using root directory`)
							// Keep baseDir as repoDir
						} else {
							console.log(
								`GitFetcher: Could not find subdirectory ${subdir} or required files in repository, using repository root`,
							)
						}
					}
				}
			} catch (error) {
				console.error(`GitFetcher: Error checking subdirectory ${subdirPath}:`, error)
			}
		}

		console.log(`GitFetcher: Using base directory ${baseDir} for validation and parsing`)
		console.log(`GitFetcher: Subdirectory path: ${subdir || "none"}`)

		// Initialize git for this repository
		this.initGit(repoDir)

		// Validate repository structure
		await this.validateRepositoryStructure(baseDir)

		// Parse repository metadata
		const metadata = await this.parseRepositoryMetadata(baseDir)

		// Parse package manager items
		const items = await this.parsePackageManagerItems(baseDir, validUrl, sourceName || metadata.name)

		return {
			metadata,
			items,
			url: repoUrl, // Keep the original URL for display purposes
			validUrl, // Store the valid URL for future operations
			subdir, // Store the subdirectory path if any
		}
	}

	/**
	 * Get repository name from URL
	 * @param repoUrl Repository URL
	 * @returns Repository name
	 */
	private getRepositoryName(repoUrl: string): string {
		const match = repoUrl.match(/\/([^/]+?)(?:\.git)?$/)
		if (!match) {
			throw new Error(`Invalid repository URL: ${repoUrl}`)
		}
		return match[1]
	}

	/**
	 * Clone or pull repository
	 * @param repoUrl Repository URL
	 * @param repoDir Repository directory
	 * @param forceRefresh Whether to force refresh
	 */
	private async cloneOrPullRepository(repoUrl: string, repoDir: string, forceRefresh: boolean): Promise<void> {
		try {
			// Check if repository exists
			const gitDir = path.join(repoDir, ".git")
			let repoExists = await fs
				.stat(gitDir)
				.then(() => true)
				.catch(() => false)

			if (repoExists && !forceRefresh) {
				try {
					// Pull latest changes
					const git = simpleGit(repoDir)
					// Force pull with overwrite
					await git.fetch("origin", "main")
					await git.raw(["reset", "--hard", "origin/main"])
					await git.raw(["clean", "-f", "-d"])
				} catch (error) {
					// If pull fails with specific errors that indicate repo corruption,
					// we should remove and re-clone
					const errorMessage = error instanceof Error ? error.message : String(error)
					if (
						errorMessage.includes("not a git repository") ||
						errorMessage.includes("repository not found") ||
						errorMessage.includes("refusing to merge unrelated histories")
					) {
						await fs.rm(repoDir, { recursive: true, force: true })
						repoExists = false
					} else {
						throw error
					}
				}
			}

			if (!repoExists || forceRefresh) {
				try {
					// Always remove the directory before cloning
					await fs.rm(repoDir, { recursive: true, force: true })

					// Add a small delay to ensure directory is fully cleaned up
					await new Promise((resolve) => setTimeout(resolve, 100))

					// Verify directory is gone before proceeding
					const dirExists = await fs
						.stat(repoDir)
						.then(() => true)
						.catch(() => false)
					if (dirExists) {
						throw new Error("Failed to clean up directory before cloning")
					}

					// Clone repository
					const git = simpleGit()
					// Clone with force options
					await git.clone(repoUrl, repoDir)
					// Reset to ensure clean state
					const repoGit = simpleGit(repoDir)
					await repoGit.raw(["clean", "-f", "-d"])
					await repoGit.raw(["reset", "--hard", "HEAD"])
				} catch (error) {
					// If clone fails, ensure we clean up any partially created directory
					try {
						await fs.rm(repoDir, { recursive: true, force: true })
					} catch {
						// Ignore cleanup errors
					}
					throw error
				}
			}

			// Get current branch
			const git = simpleGit(repoDir)
			const branch = await git.revparse(["--abbrev-ref", "HEAD"])
			console.log(`Repository cloned/pulled successfully on branch ${branch}`)
		} catch (error) {
			throw new Error(
				`Failed to clone/pull repository: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Validate repository structure
	 * @param repoDir Repository directory
	 */
	private async validateRepositoryStructure(repoDir: string): Promise<void> {
		// Check for metadata.en.yml
		const metadataPath = path.join(repoDir, "metadata.en.yml")
		console.log(`GitFetcher: Checking for metadata.en.yml at ${metadataPath}`)

		// List directory contents for debugging
		try {
			const files = await fs.readdir(repoDir)
			console.log(`GitFetcher: Directory contents of ${repoDir}:`, files)
		} catch (error) {
			console.error(`GitFetcher: Error reading directory ${repoDir}:`, error)
			throw new Error(
				`Cannot access directory ${repoDir}: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		try {
			await fs.stat(metadataPath)
			console.log(`GitFetcher: Found metadata.en.yml at ${metadataPath}`)
		} catch (error) {
			console.error(`GitFetcher: Error finding metadata.en.yml:`, error)
			throw new Error("Repository is missing metadata.en.yml file")
		}

		// Check for README.md
		const readmePath = path.join(repoDir, "README.md")
		console.log(`GitFetcher: Checking for README.md at ${readmePath}`)

		try {
			await fs.stat(readmePath)
			console.log(`GitFetcher: Found README.md at ${readmePath}`)
		} catch (error) {
			console.error(`GitFetcher: Error finding README.md:`, error)
			throw new Error("Repository is missing README.md file")
		}
	}

	/**
	 * Parse repository metadata
	 * @param repoDir Repository directory
	 * @returns Repository metadata
	 */
	private async parseRepositoryMetadata(repoDir: string): Promise<RepositoryMetadata> {
		const metadataPath = path.join(repoDir, "metadata.en.yml")
		const metadataContent = await fs.readFile(metadataPath, "utf-8")

		try {
			const parsed = yaml.load(metadataContent) as Record<string, any>
			return validateAnyMetadata(parsed) as RepositoryMetadata
		} catch (error) {
			console.error("Failed to parse repository metadata:", error)
			return {
				name: "Unknown Repository",
				description: "Failed to load repository",
				version: "0.0.0",
			}
		}
	}

	/**
	 * Parse package manager items
	 * @param repoDir Repository directory
	 * @param repoUrl Repository URL
	 * @param sourceName Source repository name
	 * @returns Array of package manager items
	 */
	private async parsePackageManagerItems(
		repoDir: string,
		repoUrl: string,
		sourceName: string,
	): Promise<PackageManagerItem[]> {
		return this.metadataScanner.scanDirectory(repoDir, repoUrl, sourceName)
	}
}
