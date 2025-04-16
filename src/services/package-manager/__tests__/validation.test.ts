import { isValidGitRepositoryUrl, convertGitHubWebUrl } from "../../../shared/validation/git-url-validation"

describe("Git Repository URL Validation", () => {
	describe("convertGitHubWebUrl", () => {
		it("should convert GitHub web URLs with /tree/ paths", () => {
			const url = "https://github.com/RooVetGit/Roo-Code-Packages/tree/main/"
			const result = convertGitHubWebUrl(url)

			expect(result).not.toBeNull()
			expect(result?.validUrl).toBe("https://github.com/RooVetGit/Roo-Code-Packages.git")
			expect(result?.subdir).toBe("") // Empty path after /tree/main/
		})

		it("should convert GitHub web URLs with /tree/ paths and subdirectories", () => {
			const url = "https://github.com/RooVetGit/Roo-Code-Packages/tree/main/packages"
			const result = convertGitHubWebUrl(url)

			expect(result).not.toBeNull()
			expect(result?.validUrl).toBe("https://github.com/RooVetGit/Roo-Code-Packages.git")
			expect(result?.subdir).toBe("packages")
		})

		it("should convert GitHub web URLs with /blob/ paths", () => {
			const url = "https://github.com/RooVetGit/Roo-Code-Packages/blob/main/README.md"
			const result = convertGitHubWebUrl(url)

			expect(result).not.toBeNull()
			expect(result?.validUrl).toBe("https://github.com/RooVetGit/Roo-Code-Packages.git")
			expect(result?.subdir).toBe("README.md")
		})

		it("should return null for non-GitHub web URLs", () => {
			const url = "https://github.com/RooVetGit/Roo-Code-Packages"
			const result = convertGitHubWebUrl(url)

			expect(result).toBeNull()
		})
	})

	describe("isValidGitRepositoryUrl", () => {
		it("should validate GitHub web URLs with /tree/ paths", () => {
			const url = "https://github.com/RooVetGit/Roo-Code-Packages/tree/main/"
			expect(isValidGitRepositoryUrl(url)).toBe(true)
		})

		it("should validate GitHub web URLs with /tree/ paths and subdirectories", () => {
			const url = "https://github.com/RooVetGit/Roo-Code-Packages/tree/main/packages"
			expect(isValidGitRepositoryUrl(url)).toBe(true)
		})

		it("should validate GitHub web URLs with /blob/ paths", () => {
			const url = "https://github.com/RooVetGit/Roo-Code-Packages/blob/main/README.md"
			expect(isValidGitRepositoryUrl(url)).toBe(true)
		})

		it("should validate standard GitHub repository URLs", () => {
			expect(isValidGitRepositoryUrl("https://github.com/RooVetGit/Roo-Code-Packages")).toBe(true)
			expect(isValidGitRepositoryUrl("https://github.com/RooVetGit/Roo-Code-Packages.git")).toBe(true)
		})

		it("should validate SSH repository URLs", () => {
			expect(isValidGitRepositoryUrl("git@github.com:RooVetGit/Roo-Code-Packages.git")).toBe(true)
		})

		it("should validate Git protocol URLs", () => {
			expect(isValidGitRepositoryUrl("git://github.com/RooVetGit/Roo-Code-Packages.git")).toBe(true)
		})

		it("should reject invalid URLs", () => {
			expect(isValidGitRepositoryUrl("not-a-url")).toBe(false)
			expect(isValidGitRepositoryUrl("https://example.com")).toBe(false)
			expect(isValidGitRepositoryUrl("https://github.com")).toBe(false)
		})
	})
})
