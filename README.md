# Bam AI

A single-page exhibition for Bam AI. WebGL strokes draw themselves on, sweep, and settle. Scroll moves the camera through five plates.

## Develop

```bash
npm install
npm run dev
```

The dev server is mounted at `/bam-ai-gallery/`.

## Build

```bash
npm run build
npm run preview
```

## Deploy

Pushes to `main` run `.github/workflows/pages.yml` and publish to GitHub Pages:

https://velhetica.github.io/bam-ai-gallery/

GitHub Pages on a private repository requires a plan that includes Pages. If the deploy job fails for that reason, the workflow is still the right setup once the repository is public or Pages is enabled.
