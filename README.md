# Tagstr

A minimalistic [nostr](https://github.com/nostr-protocol) client focusing on hashtags, providing a sense of what's happening on the network.

## Technologies

- **SolidJS**: A JavaScript library for building user interfaces.
- **TypeScript**: A typed supersonic for JavaScript.
- **Bun**: A fast all-in-one JavaScript runtime.
- **TailwindCSS**: A utility-first CSS framework.
- **Vite**: A blazing fast frontend build tool.

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/joel-st/tagstr.git
   ```
2. **Install dependencies:**
   ```bash
   bun install
   ```
3. **Run the development server:**
   ```bash
   bun dev
   ```

## Deployment

The application is set up to deploy automatically to GitHub Pages when a new version is tagged with a version tag (e.g., `v1.0.0`). The deployment is handled by a GitHub Actions workflow defined in `.github/workflows/deploy.yml`.

### Creating a Release

To create a new release and deploy to GitHub Pages:

1. Tag your release:
   ```bash
   git tag v1.0.0  # Replace with the appropriate version
   git push origin v1.0.0
   ```

2. The GitHub Actions workflow will automatically build and deploy the tagged version.

3. Alternatively, you can manually trigger the workflow from the Actions tab in your GitHub repository.
