import ora from "ora";
import prompts from "prompts";

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
spinner.stop();

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
