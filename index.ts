import ora from "ora";
import prompts from "prompts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { ReadableStream } from "node:stream/web";
import os from "node:os";
import generateServerProperties from "./generateServerProperties";

type FetchInput = string | URL | globalThis.Request;
type FabricMetaVersion = {
  version: string;
};
type ModrinthVersion = {
  id: string;
  version_type: "release" | "beta" | "alpha";
  files: { filename: string; url: string }[];
};

async function fetchJson(input: FetchInput, init: RequestInit = {}) {
  return await (await fetch(input, init)).json();
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
    const spinner = ora(`Fetching mod ${modId}`).start();

    const versions: ModrinthVersion[] = await fetchJson(
      encodeURI(
        `https://api.modrinth.com/v2/project/${modId}/version?loaders=["fabric"]&game_versions=["${details.version}"]`
      ),
      {
        headers: {
          "User-Agent": "shock59/makemcserver/development",
        },
      }
    );

    if (versions.length == 0) {
      spinner.fail(`Mod ${modId} is not available for this version`);
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

    spinner.text = `Downloading mod ${modId}`;
    await downloadFile(file.url, directory, path.join("mods", file.filename));

    spinner.succeed();
  }
}

const spinner = ora("Fetching version information").start();
const versionManifest: {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: {
    id: string;
  }[];
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
    choices: [
      { title: "Optimisations", value: "optimization", selected: true },
      { title: "spark", value: "spark", selected: true },
      { title: "No Chat Reports", value: "noChatReports" },
      { title: "Simple Voice Chat", value: "voicechat" },
    ],
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

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  details.directory
);
const modsDirectory = path.resolve(directory, "mods");
if (!fs.existsSync(directory)) await mkdir(directory);
if (!fs.existsSync(modsDirectory)) await mkdir(modsDirectory);

const fabricDownloaded = await downloadFabricJar(details.version, directory);

if (fabricDownloaded) {
  const modIds = [
    "P7dR8mSH", // Fabric API  https://modrinth.com/project/gvQqBUqZ
    ...(details.mods.includes("optimization")
      ? [
          "gvQqBUqZ", // Lithium          https://modrinth.com/project/gvQqBUqZ
          "uXXizFIs", // FerriteCore      https://modrinth.com/project/uXXizFIs
          "NRjRiSSD", // Memory Leak Fix  https://modrinth.com/project/NRjRiSSD
          "fQEb0iXm", // Krypton          https://modrinth.com/project/fQEb0iXm
          "VSNURh3q", // C2ME             https://modrinth.com/project/VSNURh3q
          "KuNKN7d2", // Noisium          https://modrinth.com/project/KuNKN7d2
        ]
      : []),
    ...(details.mods.includes("spark") ? ["l6YH9Als"] : []), // spark  https://modrinth.com/project/l6YH9Als
    ...(details.mods.includes("noChatReports") ? ["qQyHxfxd"] : []), // No Chat Reports  https://modrinth.com/project/qQyHxfxd
    ...(details.mods.includes("voicechat") ? ["9eGKb6K1"] : []), // Simple Voice Chat  https://modrinth.com/project/9eGKb6K1
  ];
  await downloadMods(modIds, directory);
}

const fileSpinner = ora("Writing extra files").start();
await writeFile(
  path.resolve(directory, "server.properties"),
  generateServerProperties(details.port, details.properties)
);

const windows = os.type() == "Windows_NT";
const startScriptPath = path.resolve(
  directory,
  `start.${windows ? "cmd" : "sh"}`
);
await writeFile(
  startScriptPath,
  `java -Xmx2G -jar fabric.jar nogui${windows ? "\nPAUSE" : ""}`
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
