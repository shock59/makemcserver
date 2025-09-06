import ora from "ora";
import prompts from "prompts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { ReadableStream } from "node:stream/web";
import os from "node:os";
import generateServerProperties from "./generateServerProperties.js";
import { parse } from "yaml";
import envPaths from "env-paths";
import { Config } from "./configTypes.js";
import {
  FabricMetaVersion,
  ModrinthProject,
  ModrinthVersion,
  MojangFullVersion,
  MojangVersion,
} from "./responseTypes.js";
import defaultConfig from "./defaultConfig.js";

type FetchInput = string | URL | globalThis.Request;

async function fetchJson(input: FetchInput) {
  return await (
    await fetch(input, {
      headers: {
        "User-Agent": "shock59/makemcserver/development",
      },
    })
  ).json();
}

async function downloadFile(
  url: FetchInput,
  mainDirectory: string,
  relativeDestination: string
) {
  const res = await fetch(url);
  const destination = path.resolve(mainDirectory, relativeDestination);
  const fileStream = fs.createWriteStream(destination);
  const readable = Readable.fromWeb(res.body as ReadableStream);
  await finished(readable.pipe(fileStream));
}

async function downloadFabricJar(minecraftVersion: string, directory: string) {
  const spinner = ora("Fetching Fabric information").start();

  const supportedMinecraftVersions: FabricMetaVersion[] = await fetchJson(
    "https://meta.fabricmc.net/v2/versions/game"
  );
  if (
    !supportedMinecraftVersions.map((v) => v.version).includes(minecraftVersion)
  ) {
    spinner.fail("Fabric is not supported on this version");
    return false;
  }

  const loaderVersions: FabricMetaVersion[] = await fetchJson(
    "https://meta.fabricmc.net/v2/versions/loader"
  );
  const loaderVersion = loaderVersions[0].version;

  const installerVersions: FabricMetaVersion[] = await fetchJson(
    "https://meta.fabricmc.net/v2/versions/installer"
  );
  const installerVersion = installerVersions[0].version;

  spinner.text = "Downloading Fabric";
  const jarUrl = `https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}/${loaderVersion}/${installerVersion}/server/jar`;
  await downloadFile(jarUrl, directory, "fabric.jar");
  spinner.succeed();
  return true;
}

async function downloadMods(modIds: string[], directory: string) {
  for (const modId of modIds) {
    const spinner = ora(`Fetching mod id ${modId}`).start();

    const project: ModrinthProject = await fetchJson(
      encodeURI(`https://api.modrinth.com/v2/project/${modId}`)
    );
    const modName = project.title;
    if (!project.game_versions.includes(details.version)) {
      spinner.fail(`Mod ${modName} is not available for this version`);
      continue;
    }
    spinner.text = `Fetching mod ${modName}`;

    const versions: ModrinthVersion[] = await fetchJson(
      encodeURI(
        `https://api.modrinth.com/v2/project/${modId}/version?loaders=["fabric"]&game_versions=["${details.version}"]`
      )
    );

    if (versions.length == 0) {
      spinner.fail(`Mod ${modName} is not available for this version`);
      continue;
    }

    versions.sort((a, b) => {
      switch (a.version_type) {
        case "release":
          return b.version_type == "release" ? 0 : -1;
        case "beta":
          return b.version_type == "alpha"
            ? -1
            : b.version_type == "beta"
            ? 0
            : 1;
        case "alpha":
          return b.version_type == "alpha" ? 0 : 1;
      }
    });
    const file = versions[0].files[0];

    spinner.text = `Downloading mod ${modName}`;
    await downloadFile(file.url, directory, path.join("mods", file.filename));

    spinner.succeed();
  }
}

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
    type: "number",
    name: "port",
    message: "Port number",
    initial: 25565,
    validate: (value) => value == "" || (value >= 1 && value <= 65535),
  },
  {
    type: "multiselect",
    name: "mods",
    message: "Extra mods",
    choices: config.modPresets
      ? Object.keys(config.modPresets).map((presetName) => ({
          title: presetName,
          value: presetName,
          selected: (() => {
            const modPreset = config.modPresets![presetName];
            if (typeof modPreset == "string") return false;
            return !!modPreset.default;
          })(),
        }))
      : [],
    instructions: false,
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
mojangSpinner.succeed();

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  details.directory
);
const modsDirectory = path.resolve(directory, "mods");
if (!fs.existsSync(directory)) await mkdir(directory);
if (!fs.existsSync(modsDirectory)) await mkdir(modsDirectory);

const fabricDownloaded = await downloadFabricJar(details.version, directory);

if (fabricDownloaded) {
  const modIds: string[] = [
    ...(config.defaultMods ?? []),
    ...(config.modPresets
      ? Object.keys(config.modPresets)
          .filter((presetName) => details.mods.includes(presetName))
          .flatMap((presetName) => {
            const modPreset = config.modPresets![presetName];
            if (typeof modPreset == "string") return [modPreset];
            else return modPreset.mods;
          })
      : []),
  ];
  await downloadMods(modIds, directory);
}

const fileSpinner = ora("Writing extra files").start();
await writeFile(
  path.resolve(directory, "server.properties"),
  generateServerProperties(details.port, details.properties)
);

const javaPath =
  config.javaPaths?.[`${javaVersion}`] ?? config.javaPaths?.default ?? "java";
const startScriptPath = path.resolve(
  directory,
  `start.${windows ? "cmd" : "sh"}`
);
await writeFile(
  startScriptPath,
  `${javaPath} -Xmx2G -jar fabric.jar nogui${windows ? "\nPAUSE" : ""}`
);
if (!windows) {
  await chmod(startScriptPath, "755");
}

if (details.eula) {
  await writeFile(path.resolve(directory, "eula.txt"), "eula=true");
}
fileSpinner.succeed();

console.log(
  `Server created at ${path.relative(
    path.dirname(fileURLToPath(import.meta.url)),
    directory
  )}`
);
