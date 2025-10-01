import ora, { Ora } from "ora";
import {
  FabricMetaVersion,
  ModrinthProject,
  ModrinthVersion,
  MojangFullVersion,
  MavenVersionList,
  PaperBuild,
  PaperVersionList,
} from "./responseTypes.js";
import { fetchJson, downloadFile } from "./fetching.js";
import path from "node:path";
import { promisify } from "node:util";
import { spawn, SpawnOptionsWithoutStdio } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import { Modloader } from "./configTypes.js";

const asyncSpawn = (cmd: string, args: SpawnOptionsWithoutStdio) =>
  new Promise<string>((resolve, reject) => {
    const cp = spawn(cmd, args);
    const error: string[] = [];
    const stdout: string[] = [];
    cp.stdout.on("data", (data) => {
      stdout.push(data.toString());
    });

    cp.on("error", (e) => {
      error.push(e.toString());
    });

    cp.on("close", () => {
      if (error.length) reject(error.join(""));
      else resolve(stdout.join(""));
    });
  });

async function installForge(
  directory: string,
  javaPath: string,
  softwareName: string,
  spinner: Ora
) {
  spinner.text = `Running ${softwareName} server installer`;
  await asyncSpawn(
    `cd ${directory} && "${javaPath}" -jar forge-installer.jar --install${
      softwareName == "Neoforge" ? "-server" : "Server"
    } .`,
    { shell: true }
  );

  spinner.text = `Finishing ${softwareName} server installation`;
  await fs.rm(path.join(directory, "forge-installer.jar"));

  const windows = os.type() == "Windows_NT";
  let runFile = await fs.readFile(
    path.join(directory, `run.${windows ? "bat" : "sh"}`),
    "utf-8"
  );
  runFile = runFile.replace("java", `${javaPath}`);
  const startScriptPath = path.join(
    directory,
    `start.${windows ? "cmd" : "sh"}`
  );
  await fs.writeFile(startScriptPath, runFile);
  if (!windows) {
    await fs.chmod(startScriptPath, "755");
  }
  await fs.rm(path.join(directory, `run.sh`));
  await fs.rm(path.join(directory, `run.bat`));

  spinner.succeed();
}

export async function downloadFabricJar(
  minecraftVersion: string,
  directory: string
) {
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

  spinner.text = "Downloading Fabric server";
  const jarUrl = `https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}/${loaderVersion}/${installerVersion}/server/jar`;
  await downloadFile(jarUrl, directory, "server.jar");
  spinner.succeed();
  return true;
}

export async function downloadForgeJar(
  minecraftVersion: string,
  directory: string,
  javaPath: string
) {
  const spinner = ora("Fetching Forge information").start();

  const forgeVersionList: MavenVersionList = await fetchJson(
    "https://maven.minecraftforge.net/api/maven/versions/releases/net%2Fminecraftforge%2Fforge"
  );
  const versions = forgeVersionList.versions.map((v) => {
    const split = v.split("-");
    return {
      minecraftVersion: split[0],
      forgeVersion: v,
    };
  });

  const version = versions.find((v) => v.minecraftVersion == minecraftVersion);
  if (!version) {
    spinner.fail("Forge is not supported on this version");
    return false;
  }

  spinner.text = "Downloading Forge server installer";
  const jarUrl = `https://maven.minecraftforge.net/releases/net/minecraftforge/forge/${version.forgeVersion}/forge-${version.forgeVersion}-installer.jar`;
  await downloadFile(jarUrl, directory, "forge-installer.jar");

  await installForge(directory, javaPath, "Forge", spinner);
  return true;
}

export async function downloadPaperJar(
  minecraftVersion: string,
  directory: string
) {
  const spinner = ora("Fetching Paper information").start();

  const paperVersionList: PaperVersionList = await fetchJson(
    "https://fill.papermc.io/v3/projects/paper"
  );
  const supportedMinecraftVersions = Object.values(
    paperVersionList.versions
  ).flat();
  if (!supportedMinecraftVersions.map((v) => v).includes(minecraftVersion)) {
    spinner.fail("Paper is not supported on this version");
    return false;
  }

  const builds: PaperBuild[] = await fetchJson(
    `https://fill.papermc.io/v3/projects/paper/versions/${minecraftVersion}/builds`
  );
  const build = builds.toSorted((a, b) =>
    a.channel == "STABLE" && b.channel == "ALPHA"
      ? -1
      : a.channel == "ALPHA" && b.channel == "STABLE"
      ? 1
      : 0
  )[0];

  spinner.text = "Downloading Paper server";
  const jarUrl = build.downloads["server:default"].url;
  await downloadFile(jarUrl, directory, "server.jar");
  spinner.succeed();
  return true;
}

export async function downloadNeoForgeJar(
  minecraftVersion: string,
  directory: string,
  javaPath: string
) {
  const spinner = ora("Fetching NeoForge information").start();

  const neoforgeVersionList: MavenVersionList = await fetchJson(
    "https://maven.neoforged.net/api/maven/versions/releases/net%2Fneoforged%2Fneoforge"
  );
  const versions = neoforgeVersionList.versions.map((v) => {
    const split = v.split(".");
    return {
      minecraftVersion: `1.${split[0]}.${split[1]}`,
      neoForgeVersion: v,
    };
  });

  const version = versions.find((v) => v.minecraftVersion == minecraftVersion);
  if (!version) {
    spinner.fail("NeoForge is not supported on this version");
    return false;
  }

  spinner.text = "Downloading NeoForge server installer";
  const jarUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version.neoForgeVersion}/neoforge-${version.neoForgeVersion}-installer.jar`;
  await downloadFile(jarUrl, directory, "forge-installer.jar");

  await installForge(directory, javaPath, "NeoForge", spinner);
  return true;
}

export async function downloadVanillaJar(
  version: MojangFullVersion,
  directory: string
) {
  const spinner = ora("Downloading vanilla server").start();
  if (!version.downloads.server) {
    spinner.fail("There is no server jar for this version");
    return false;
  }
  await downloadFile(version.downloads.server.url, directory, "server.jar");
  spinner.succeed();
  return true;
}

export async function downloadMods(
  modIds: string[],
  gameVersion: string,
  modloader: Modloader,
  directory: string
) {
  for (const modId of modIds) {
    const spinner = ora(`Fetching mod id ${modId}`).start();

    const project: ModrinthProject = await fetchJson(
      encodeURI(`https://api.modrinth.com/v2/project/${modId}`)
    );
    const modName = project.title;
    if (!project.game_versions.includes(gameVersion)) {
      spinner.fail(`Mod ${modName} is not available for this version`);
      continue;
    }
    spinner.text = `Fetching mod ${modName}`;

    const versions: ModrinthVersion[] = await fetchJson(
      encodeURI(
        `https://api.modrinth.com/v2/project/${modId}/version?loaders=["${modloader}"]&game_versions=["${gameVersion}"]`
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
    await downloadFile(file.url, directory, file.filename);

    spinner.succeed();
  }
}
