import ora from "ora";
import prompts from "prompts";
import path from "node:path";
import fs from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import generateServerProperties from "./generateServerProperties.js";
import { parse } from "yaml";
import envPaths from "env-paths";
import { Config } from "./configTypes.js";
import { MojangFullVersion, MojangVersion } from "./responseTypes.js";
import defaultConfig from "./defaultConfig.js";
import { cwd } from "node:process";
import { fetchJson, downloadFile } from "./fetching.js";
import {
  downloadFabricJar,
  downloadForgeJar,
  downloadMods,
  downloadNeoForgeJar,
  downloadPaperJar,
  downloadVanillaJar,
} from "./jarDownloaders.js";

const windows = os.type() == "Windows_NT";

const config: Config = await (async () => {
  for (const configFileLocation of [
    path.resolve("makemcserver.yml"),
    path.join(envPaths("makemcserver").config, "makemcserver.yml"),
    path.join(os.homedir(), ".makemcserver.yml"),
  ]) {
    if (!fs.existsSync(configFileLocation)) continue;
    const yaml = await readFile(configFileLocation, { encoding: "utf-8" });
    return parse(yaml);
  }

  return defaultConfig;
})();

const spinner = ora("Fetching version list").start();
const versionManifest: {
  latest: { release: string };
  versions: MojangVersion[];
} = await fetchJson(
  "https://launchermeta.mojang.com/mc/game/version_manifest.json"
);
spinner.succeed();

const questions: prompts.PromptObject<string>[] = [
  {
    type: "text",
    name: "directory",
    message: "Folder name",
    initial: ".",
  },
  {
    type: "autocomplete",
    name: "version",
    message: "Minecraft version",
    choices: versionManifest.versions.map((version) => ({ title: version.id })),
    initial: versionManifest.latest.release,
  },
  {
    type: "select",
    name: "software",
    message: "Server software",
    choices: [
      { title: "Fabric", value: "fabric", selected: true },
      { title: "Paper", value: "paper" },
      { title: "NeoForge", value: "neoforge" },
      { title: "Forge", value: "forge" },
      { title: "Vanilla", value: "vanilla" },
    ],
  },
  {
    type: (prev) => (prev == "vanilla" ? null : "multiselect"),
    name: "mods",
    message: "Extra mods",
    choices: (prev) =>
      config.modPresets
        ? Object.keys(config.modPresets[prev]).map((presetName) => ({
            title: presetName,
            value: presetName,
            selected: (() => {
              const modPreset = config.modPresets[prev][presetName];
              if (typeof modPreset == "string") return false;
              return !!modPreset.default;
            })(),
          }))
        : [],
    instructions: false,
  },
  {
    type: "number",
    name: "port",
    message: "Port number",
    initial: 25565,
    validate: (value) => value == "" || (value >= 1 && value <= 65535),
  },
  {
    type: "multiselect",
    name: "properties",
    message: "Extra options",
    choices: [
      { title: "Enable whitelist", value: "whitelist", selected: true },
      {
        title: "Disable spawn protection",
        value: "noSpawnProtection",
      },
      {
        title: "Disable enforce secure profiles",
        value: "noSecureProfiles",
      },
      {
        title: "Offline mode",
        value: "offlineMode",
        description:
          "WARNING: Offline mode is insecure and should only be used for testing",
      },
      { title: "Hide online players", value: "hideOnlinePlayers" },
    ],
    instructions: false,
  },
  {
    type: "confirm",
    name: "eula",
    message: "Agree to the Minecraft EULA (https://aka.ms/MinecraftEULA)?",
    initial: false,
  },
];
let details = await prompts(questions);

console.log("\nSetting up the server...");

const mojangSpinner = ora(`Fetching ${details.version} information`).start();
const fullVersionInformation: MojangFullVersion = await fetchJson(
  versionManifest.versions.find((version) => version.id == details.version)!.url
);
const javaVersion = fullVersionInformation.javaVersion.majorVersion;
const javaPath =
  config.javaPaths?.[`${javaVersion}`] ?? config.javaPaths?.default ?? "java";
mojangSpinner.succeed();

const directory = path.resolve(cwd(), details.directory);
const modsDirectory = path.resolve(directory, "mods");
if (!fs.existsSync(directory)) await mkdir(directory);
if (!fs.existsSync(modsDirectory)) await mkdir(modsDirectory);

const moddedSoftwareDownloaded =
  details.software == "fabric"
    ? await downloadFabricJar(details.version, directory)
    : details.software == "paper"
    ? await downloadPaperJar(details.version, directory)
    : details.software == "neoforge"
    ? await downloadNeoForgeJar(details.version, directory, javaPath)
    : details.software == "forge"
    ? await downloadForgeJar(details.version, directory, javaPath)
    : false;

if (moddedSoftwareDownloaded) {
  const modIds: string[] = [
    ...(config.defaultMods[details.software] ?? []),
    ...(config.modPresets && config.modPresets[details.software]
      ? Object.keys(config.modPresets[details.software])
          .filter((presetName) => details.mods.includes(presetName))
          .flatMap((presetName) => {
            const modPreset = config.modPresets[details.software]![presetName];
            if (typeof modPreset == "string") return [modPreset];
            else return modPreset.mods;
          })
      : []),
  ];
  await downloadMods(modIds, details.version, details.software, directory);
} else {
  const downloadedVanillaJar = await downloadVanillaJar(
    fullVersionInformation,
    directory
  );
  if (!downloadedVanillaJar) process.exit();
}

const fileSpinner = ora("Writing extra files").start();
await writeFile(
  path.resolve(directory, "server.properties"),
  generateServerProperties(details.port, details.properties)
);

if (!["neoforge", "forge"].includes(details.software)) {
  const startScriptPath = path.resolve(
    directory,
    `start.${windows ? "cmd" : "sh"}`
  );
  await writeFile(
    startScriptPath,
    `${javaPath} -Xmx2G -jar server.jar nogui${windows ? "\nPAUSE" : ""}`
  );
  if (!windows) {
    await chmod(startScriptPath, "755");
  }
}

if (details.eula) {
  await writeFile(path.resolve(directory, "eula.txt"), "eula=true");
}
fileSpinner.succeed();

console.log(`Server created at ${path.relative(cwd(), directory)}`);
