import ora from "ora";
import prompts from "prompts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { ReadableStream } from "node:stream/web";

type ModrinthVersion = {
  id: string;
  version_type: "release" | "beta" | "alpha";
  files: { filename: string; url: string }[];
};

const spinner = ora("Fetching version information").start();
const versionManifest: {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: {
    id: string;
  }[];
} = await (
  await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json")
).json();
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
  },
  {
    type: "confirm",
    name: "value",
    message: "Agree to the Minecraft EULA?",
    initial: true,
  },
];
let details = await prompts(questions);

console.log("Setting up the server !!!");

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  details.directory
);

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

for (const modId of modIds) {
  const spinner = ora(`Fetching mod ${modId}`).start();

  const apiRes = await fetch(
    encodeURI(
      `https://api.modrinth.com/v2/project/${modId}/version?loaders=["fabric"]&game_versions=["${details.version}"]`
    ),
    {
      headers: {
        "User-Agent": "shock59/makemcserver/development",
      },
    }
  );
  const versions: ModrinthVersion[] = await apiRes.json();

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

  const fileRes = await fetch(file.url);
  const destination = path.resolve(directory, "mods", file.filename);
  const fileStream = fs.createWriteStream(destination);
  const readable = Readable.fromWeb(fileRes.body as ReadableStream);
  await finished(readable.pipe(fileStream));

  spinner.succeed();
}
