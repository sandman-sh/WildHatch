import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseEnv, promisify } from "node:util";

const spec = "tests/kane/guest_expedition_test.md";
const output = ".testmuai/wildhatch";
const report = {
  test: spec,
  status: "running",
  startedAt: new Date().toISOString(),
  steps: [],
};
await mkdir(output, { recursive: true });
const save = () =>
  writeFile(
    join(output, "latest.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
await save();

async function appUrl() {
  const localEnv = await readFile(".env", "utf8")
    .then(parseEnv)
    .catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return {};
    });
  const port = process.env.WEB_PORT || localEnv.WEB_PORT || "5173";
  const url = new URL(
    process.env.KANE_BASE_URL || "http://127.0.0.1:" + port + "/",
  );
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error(
      "KANE_BASE_URL must be an HTTP or HTTPS game URL without credentials or a query.",
    );
  try {
    const api = await fetch(new URL("/api/session", url), {
      signal: AbortSignal.timeout(10000),
    });
    if (!api.ok || !Object.hasOwn(await api.json(), "wallet")) throw Error();
  } catch {
    throw Error(
      "WildHatch and its game API must be running. Start them with npm run dev.",
    );
  }
  return url.href;
}

async function run() {
  const url = await appUrl();
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith("WILDHATCH_") && key !== "SUPABASE_SERVICE_ROLE_KEY",
    ),
  );
  let cli;
  try {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [process.env.npm_execpath, "root", "--global"],
      { env },
    );
    const directory = join(stdout.trim(), "@testmuai", "kane-cli");
    const manifest = JSON.parse(
      await readFile(join(directory, "package.json"), "utf8"),
    );
    cli = join(directory, manifest.bin["kane-cli"]);
  } catch {
    throw Error(
      "Install Kane CLI with npm install -g @testmuai/kane-cli, then run kane-cli login.",
    );
  }

  const child = spawn(
    process.execPath,
    [
      cli,
      "testmd",
      "run",
      spec,
      "--agent",
      "--headless",
      "--timeout",
      "150",
      "--url",
      url,
    ],
    { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  const done = new Promise((resolve) => {
    child.once("error", () => resolve(2));
    child.once("close", (code) => resolve(code ?? 2));
  });
  const diagnostics = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => diagnostics.push(chunk));
  const events = [];
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    events.push(line);
    if (event.type === "test_md_step_start") {
      report.steps.push({
        number: event.step_index,
        name: event.heading,
        status: "running",
      });
      console.log("Kane · " + event.heading);
    } else if (event.type === "test_md_step_end") {
      const step = report.steps.find(
        (entry) => entry.number === event.step_index,
      );
      if (step) step.status = event.status ?? "unknown";
    } else if (event.type === "test_md_summary") {
      if (event.upload?.performed)
        report.cloudUpload = event.upload.succeeded === true;
      if (event.share_url) report.evidenceUrl = event.share_url;
    } else if (event.type === "test_md_done") {
      report.status = String(event.overall_status ?? "unknown").toLowerCase();
      report.sessionId = event.session_id;
      if (event.share_url) report.evidenceUrl = event.share_url;
    }
  }
  report.exitCode = await done;
  await writeFile(join(output, "latest.ndjson"), events.join("\n") + "\n");
  await writeFile(join(output, "latest.stderr.log"), diagnostics.join(""));
  const evidence = diagnostics.join("").match(/([a-f0-9-]+\.evidence)\b/i);
  if (evidence)
    report.evidencePack = join(".testmuai", "evidence", evidence[1]);
  if (report.sessionId) {
    for (const directory of [
      "tests/kane/output-guest_expedition",
      "tests/kane/output-guest_expedition.staging",
    ]) {
      const result = await readFile(join(directory, "Result.md"), "utf8").catch(
        () => "",
      );
      if (!result.split(/\r?\n/).includes("session_id: " + report.sessionId))
        continue;
      report.resultPath = join(output, "latest-result.md");
      await writeFile(report.resultPath, result);
      break;
    }
  }
  if (report.status === "running") report.status = "incomplete";
  if (report.exitCode !== 0 || report.status !== "passed") {
    process.exitCode = report.exitCode || 1;
  }
  console.log("Kane verdict · " + report.status);
  if (report.evidenceUrl) console.log("Evidence · " + report.evidenceUrl);
  if (report.evidencePack)
    console.log("Local evidence · " + report.evidencePack);
  console.log("Agent report · " + join(output, "latest.json"));
}

try {
  await run();
} catch (error) {
  report.status = "setup-error";
  process.exitCode = 2;
  console.error(error.message);
}
await save();
