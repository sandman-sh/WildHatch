# Verify WildHatch with Kane CLI

WildHatch uses Kane CLI to exercise the browser UI against a running game. The test verifies the wallet gate on Normal mode, joins the Supabase-backed island as a guest, and checks the actual practice-orb inventory.

Install and authenticate once.

```sh
npm install -g @testmuai/kane-cli
kane-cli login
```

Start WildHatch with `npm run dev` and run the verification from another terminal.

```sh
npm run test:kane
```

The runner uses the local `WEB_PORT` setting. Set `KANE_BASE_URL` to run against a preview deployment. The final Kane verdict controls the command's exit status.

Codex reads `.testmuai/wildhatch/latest.json` and the linked local evidence. The runner saves a copy of Kane's Markdown report when available. If a step fails, Codex uses the evidence to identify the cause and reruns the same browser test after the fix. Kane can replay recorded steps on subsequent runs.

The first browser run reached the island and flagged the missing **Guest Mode** indicator. The game had set the label, and the HUD stylesheet hid it. Codex used the failure screenshot to locate the rule and made the label visible for guests. The same test then passed all three checks.

[Guest expedition test](../tests/kane/guest_expedition_test.md) · [Kane CLI test files](https://www.testmuai.com/docs/kane-cli-testmd)
