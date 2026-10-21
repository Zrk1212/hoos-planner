# Set up Hoos Planner

Hoos Planner works in Claude, ChatGPT or Codex. You only add a link to your AI's settings; nothing downloads (the optional Mac version at the bottom is the one exception).

## 1. Connect Hoos Planner (once)

Connector URL: `https://hoosplanner.zrk.ventures/api/mcp` (no sign-in).

**Claude** (claude.ai or the desktop app): open https://claude.ai/settings/connectors → **Add custom connector** → name `Hoos Planner`, paste the URL → **Add**.

**Claude Code**: paste this into Claude Code, click **Allow**, then quit and reopen it:

> Add the Hoos Planner connector for me by running this command, then tell me to restart Claude Code:
> claude mcp add --scope user --transport http hoos-planner https://hoosplanner.zrk.ventures/api/mcp

**Codex**: paste this into Codex, click **Allow**, then quit and reopen it:

> Add the Hoos Planner connector for me by running this command, then tell me to restart Codex:
> codex mcp add hoos-planner --url https://hoosplanner.zrk.ventures/api/mcp

**ChatGPT** (Plus or higher): Settings → **Apps & Connectors** → **Advanced settings** → turn on **Developer mode**. Then **Create** → name `Hoos Planner`, paste the URL, **No authentication**, tick **I trust this application**. In each new chat: **+** → **Developer mode** → Hoos Planner.

The first time your AI uses a Hoos Planner tool it asks permission. Allow it. The tools read UVA's public class list and save your plan to the Hoos Planner website. They can't see your SIS or NetBadge account.

## 2. Paste your first message

Open https://hoosplanner.zrk.ventures/schedule. The page gives you a first message with your own plan code. Paste it into a new chat in your AI app. Each time your AI changes your schedule, the page updates.

## 3. Describe your week

Try "No classes before 10, and keep my Fridays free" or "I'm applying to McIntire next fall. Am I on track?". When the week looks right, paste the class numbers into SIS under Add by class number. Hoos Planner never enrolls you.

## Advanced: the Mac version

The Mac version lets Claude read your own SIS cart and Stellic audit through your signed-in Chrome. Most students skip it. Paste this into Claude Code:

> Set up the full version of Hoos Planner for me on this Mac: https://hoosplanner.zrk.ventures
>
> 1. Run `curl -fsSL https://hoosplanner.zrk.ventures/install.sh | bash` and show me the output. If it lists anything to finish first (Node.js, git, Claude Code), install it for me and run the installer again.
> 2. Walk me through the two things only I can do: tick "Allow remote debugging" at chrome://inspect/#remote-debugging, and sign in to SIS and Stellic in Chrome myself. Never ask for my NetBadge password.
> 3. Restart so the hoos-planner tools load, then read my Stellic audit and SIS cart, tell me what I still owe for the College, McIntire and the School of Data Science, and save a draft plan so I can watch it on the Hoos Planner website.

The installer downloads the app to `~/hoos-planner`, installs Node dependencies and `browser-harness`, points the local server at the public catalog (no database keys on your machine), and registers the `hoos-planner` MCP server with Claude Code and the Claude desktop app. It never asks for or stores your NetBadge password, never presses Enroll, and changes your SIS cart only after a confirmation dialog on your own screen.
