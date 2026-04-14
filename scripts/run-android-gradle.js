import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const androidDir = resolve(repoRoot, "android");
const gradleWrapper = resolve(androidDir, "gradlew");
const javaHome = process.env.JAVA_HOME || "/home/merrik/.local/lib/jdk-21";
const androidSdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || "/home/merrik/Android/Sdk";
const localPath = [
  resolve(javaHome, "bin"),
  resolve(androidSdkRoot, "platform-tools"),
  resolve(androidSdkRoot, "cmdline-tools/latest/bin"),
  process.env.PATH || ""
].join(":");

if (!existsSync(gradleWrapper)) {
  console.error(`Missing Gradle wrapper at ${gradleWrapper}. Run 'npx cap add android' first.`);
  process.exit(1);
}
if (!existsSync(resolve(javaHome, "bin/java"))) {
  console.error(`Missing Java runtime at ${javaHome}. Install JDK 21 or set JAVA_HOME.`);
  process.exit(1);
}
if (!existsSync(resolve(androidSdkRoot, "platforms/android-36"))) {
  console.error(`Missing Android SDK platform 36 at ${androidSdkRoot}. Install the Android SDK or set ANDROID_SDK_ROOT.`);
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync(gradleWrapper, args.length > 0 ? args : ["help"], {
  cwd: androidDir,
  stdio: "inherit",
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_SDK_ROOT: androidSdkRoot,
    ANDROID_HOME: androidSdkRoot,
    PATH: localPath
  }
});

process.exit(result.status ?? 1);
