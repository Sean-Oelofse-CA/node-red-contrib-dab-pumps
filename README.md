# node-red-contrib-dab-pumps

Node-RED nodes for DAB Pumps using the DConnect / DAB Live cloud API.

This package provides Node-RED nodes for DAB Pump devices such as EsyBox, EsyBox Mini/Max, and DConnect Box.

The node can poll live status from the DAB cloud and also send simple write commands to a selected device when you pass a message with `msg.command = "write"`.

## Install in Node-RED

### From the Node-RED palette manager
1. Open Node-RED.
2. Open the menu and choose Manage palette.
3. Go to the Install tab.
4. Search for "dab pumps" or "node-red-contrib-dab-pumps".
5. Click Install and restart Node-RED.

### From the command line
If you are running Node-RED in its usual user directory, run:

```bash
cd ~/.node-red
npm install node-red-contrib-dab-pumps
```

Then restart Node-RED.

### From this GitHub repository
If you want to install directly from GitHub:

```bash
cd ~/.node-red
npm install git+https://github.com/Sean-Oelofse-CA/node-red-contrib-dab-pumps.git
```

Then restart Node-RED.

## Usage
After installation, the node will appear in the Node-RED editor palette and can be configured with your DAB pump credentials and device details.

## Repository
- GitHub: https://github.com/Sean-Oelofse-CA/node-red-contrib-dab-pumps
- npm package: https://www.npmjs.com/package/node-red-contrib-dab-pumps
