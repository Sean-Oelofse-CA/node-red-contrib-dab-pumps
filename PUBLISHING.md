# Publishing this to GitHub (and npm)

Everything here is ready to push. Replace `YOUR_USERNAME` throughout with your
GitHub username first (it appears in `package.json`).

## 1. Create the repo on GitHub
- Go to https://github.com/new
- Name: `node-red-contrib-dab-pumps`
- Leave it **empty** (no README/license — this folder already has them)
- Create repository

## 2. Push this folder
From inside this folder:

```bash
git init
git add .
git commit -m "Initial commit: DAB Pumps nodes for Node-RED"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/node-red-contrib-dab-pumps.git
git push -u origin main
```

## 3. (Optional) Tag a release
```bash
git tag v0.1.0
git push origin v0.1.0
```

## 4. (Optional) Publish to npm so it shows in the Node-RED palette manager
Requires a free npmjs.com account. `node-red-contrib-*` names are auto-discovered
by the Node-RED "Manage palette" search.

```bash
npm login
npm publish --access public
```

After this, anyone can install it from Node-RED's palette by searching
"dab-pumps", or via `npm install node-red-contrib-dab-pumps`.

## Notes
- Bump `version` in `package.json` before each `npm publish`.
- To let people install straight from GitHub without npm:
  `npm install YOUR_USERNAME/node-red-contrib-dab-pumps`
