import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const APK_OUTPUT_RELATIVE_PATH = "app/build/outputs/apk/debug/app-debug.apk";

async function runCommand(cmd, args, cwd) {
  await execFileAsync(cmd, args, {
    cwd,
    maxBuffer: 1024 * 1024 * 32
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { zipBase64, mapId = "VIBE_APP" } = req.body || {};
  if (!zipBase64) {
    return res.status(400).json({ error: "Missing zipBase64 payload." });
  }

  const shellRoot = process.env.APK_SHELL_DIR;
  if (!shellRoot) {
    return res.status(500).json({ error: "APK_SHELL_DIR is not configured on the server." });
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "logichub-apk-"));
  const projectZipPath = path.join(tempRoot, `${mapId}.zip`);
  const unpackedWebPath = path.join(tempRoot, "web-assets");
  const shellWorkPath = path.join(tempRoot, "capacitor-shell");
  const androidAssetsPublicPath = path.join(shellWorkPath, "android", "app", "src", "main", "assets", "public");

  try {
    await fs.writeFile(projectZipPath, Buffer.from(zipBase64, "base64"));
    await fs.mkdir(unpackedWebPath, { recursive: true });

    // Assemble web assets from uploaded ZIP.
    await runCommand("unzip", ["-q", projectZipPath, "-d", unpackedWebPath], tempRoot);

    // Clone shell workspace into temp dir.
    await runCommand("cp", ["-R", shellRoot, shellWorkPath], tempRoot);

    // Inject assembled web assets before capacitor/gradle build.
    await fs.rm(androidAssetsPublicPath, { recursive: true, force: true });
    await fs.mkdir(androidAssetsPublicPath, { recursive: true });
    await runCommand("cp", ["-R", `${unpackedWebPath}/.`, androidAssetsPublicPath], tempRoot);

    // Keep Capacitor + Gradle pipeline order deterministic.
    await runCommand("npx", ["cap", "copy", "android"], shellWorkPath);
    await runCommand("./gradlew", ["assembleDebug"], path.join(shellWorkPath, "android"));

    const apkPath = path.join(shellWorkPath, "android", APK_OUTPUT_RELATIVE_PATH);
    const apkBuffer = await fs.readFile(apkPath);
    const apkSize = apkBuffer.byteLength;

    if (apkSize < 500 * 1024) {
      return res.status(500).json({ error: "APK build output is under 500KB and considered invalid." });
    }

    return res.status(200).json({
      success: true,
      apkBase64: apkBuffer.toString("base64"),
      sizeBytes: apkSize
    });
  } catch (error) {
    console.error("APK build pipeline failed:", error);
    return res.status(500).json({ error: `APK build failed: ${error.message}` });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}
