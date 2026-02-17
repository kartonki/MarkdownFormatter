# MarkdownFormatter
AI-Powered Markdown Formatter Intelligent formatting tool that cleans and structures markdown documents with AI assistance. Features auto-detection of code blocks, smart indentation, and consistent styling across large documentation projects.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Run coverage:

```bash
npm run coverage
```

## Refactor for testability (Issue #3)

- `src/services/ai.js` contains prompt construction and API request logic.
- `src/utils/diff.js` and `src/utils/clipboard.js` hold pure utility logic.
- `src/components/*` contains reusable presentational UI components.
- `src/MarkdownFormatter.jsx` is the container component that composes state and behavior.
- `tests/*` includes unit tests and UI interaction tests.
