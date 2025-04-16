/**
 * Frontend wrapper for the shared Git repository URL validation
 * This imports the shared validation logic from src/shared/validation/git-url-validation.ts
 */

// Import the shared validation functions
import {
	convertGitHubWebUrl as sharedConvertGitHubWebUrl,
	isValidGitRepositoryUrl as sharedIsValidGitRepositoryUrl,
} from "../../../src/shared/validation/git-url-validation"

// Re-export the shared validation functions
export const convertGitHubWebUrl = sharedConvertGitHubWebUrl
export const isValidGitRepositoryUrl = sharedIsValidGitRepositoryUrl
