import React from "react"
import { render, screen } from "@testing-library/react"
import { TypeGroup } from "../TypeGroup"

describe("TypeGroup", () => {
	const mockItems = [
		{
			name: "Test Item 1",
			description: "Description 1",
			path: "test/path/1",
		},
		{
			name: "Test Item 2",
			description: "Description 2",
			path: "test/path/2",
		},
	]

	it("should render type header and items", () => {
		render(<TypeGroup type="mcp server" items={mockItems} />)

		expect(screen.getByText("MCP Servers")).toBeInTheDocument()
		expect(screen.getByText("Test Item 1")).toBeInTheDocument()
		expect(screen.getByText("Description 1", { exact: false })).toBeInTheDocument()
		expect(screen.getByText("Test Item 2")).toBeInTheDocument()
		expect(screen.getByText("Description 2", { exact: false })).toBeInTheDocument()
	})

	it("should format different types correctly", () => {
		const types = [
			{ input: "mode", expected: "Modes" },
			{ input: "mcp server", expected: "MCP Servers" },
			{ input: "prompt", expected: "Prompts" },
			{ input: "package", expected: "Packages" },
			{ input: "custom", expected: "Customs" },
		]

		types.forEach(({ input, expected }) => {
			const { unmount } = render(<TypeGroup type={input} items={mockItems} />)
			expect(screen.getByText(expected)).toBeInTheDocument()
			unmount()
		})
	})

	it("should handle items without descriptions", () => {
		const itemsWithoutDesc = [{ name: "Test Item", path: "test/path" }]

		render(<TypeGroup type="test" items={itemsWithoutDesc} />)
		expect(screen.getByText("Test Item")).toBeInTheDocument()
	})

	it("should not render when items array is empty", () => {
		const { container } = render(<TypeGroup type="test" items={[]} />)
		expect(container).toBeEmptyDOMElement()
	})

	it("should not render when items is undefined", () => {
		const { container } = render(<TypeGroup type="test" items={undefined as any} />)
		expect(container).toBeEmptyDOMElement()
	})

	it("should apply custom className", () => {
		const customClass = "custom-test-class"
		render(<TypeGroup type="test" items={mockItems} className={customClass} />)

		const container = screen.getByRole("heading").parentElement
		expect(container).toHaveClass(customClass)
	})

	it("should render items in a numbered list", () => {
		render(<TypeGroup type="test" items={mockItems} />)

		const list = screen.getByRole("list")
		expect(list).toHaveClass("list-decimal")
		expect(list.children).toHaveLength(2)
	})

	it("should show path as title attribute", () => {
		render(<TypeGroup type="test" items={mockItems} />)

		const items = screen.getAllByRole("listitem")
		expect(items[0]).toHaveAttribute("title", "test/path/1")
		expect(items[1]).toHaveAttribute("title", "test/path/2")
	})
})
