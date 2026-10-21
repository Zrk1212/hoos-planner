/**
 * Setup copy shared by the walkthrough, the empty Schedule/Cart/Requirements pages, public/install.md and the
 * README (keep those copies in sync).
 *  - Step 1 adds the remote connector: three clicks in claude.ai / ChatGPT, or a one-line prompt (agentSetupPrompt)
 *    that Claude Code / Codex runs for the student. Then they restart and paste firstMessage(code).
 *  - Advanced (Mac + Claude Code): macInstallPrompt installs the local server that can read SIS and Stellic.
 */
export const FALLBACK_ORIGIN = "https://hoosplanner.zrk.ventures";
export const CLAUDE_CONNECTORS_URL = "https://claude.ai/settings/connectors";
export const CONNECTOR_NAME = "Hoos Planner";
export const connectorUrl = (origin: string) => `${origin}/api/mcp`;

/** Terminal commands that add the remote connector; Claude Code and Codex run them for the student. */
export const claudeCodeCommand = (origin: string) => `claude mcp add --scope user --transport http hoos-planner ${connectorUrl(origin)}`;
export const codexCommand = (origin: string) => `codex mcp add hoos-planner --url ${connectorUrl(origin)}`;
/** The short prompt for apps that can run commands: one command, then "restart". */
export const agentSetupPrompt = (command: string, app: string) => `Add the Hoos Planner connector for me by running this command, then tell me to restart ${app}:\n${command}`;

/** What the student pastes into Claude once the connector is on. The code ties the chat to their open page. */
export const firstMessage = (code: string) => `Use Hoos Planner to help me build my Spring 2027 class schedule at UVA.

My plan code is ${code}. Call save_plan with this code every time my schedule changes, so I can watch it on the Hoos Planner website.

Ask me up to 3 short questions to start: what I've taken so far (I can paste my Stellic audit), which programs I'm aiming for, and what I want my week to look like.`;

export const macInstallPrompt = (origin: string) => `Set up the full version of Hoos Planner for me on this Mac: ${origin}

1. Run \`curl -fsSL ${origin}/install.sh | bash\` and show me the output. If it lists anything to finish first (Node.js, git, Claude Code), install it for me and run the installer again.
2. Walk me through the two things only I can do: tick "Allow remote debugging" at chrome://inspect/#remote-debugging, and sign in to SIS and Stellic in Chrome myself. Never ask for my NetBadge password.
3. Restart so the hoos-planner tools load, then read my Stellic audit and SIS cart, tell me what I still owe for the College, McIntire and the School of Data Science, and save a draft plan so I can watch it on the Hoos Planner website.`;
