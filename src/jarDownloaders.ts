import ora from "ora";
import {
  FabricMetaVersion,
  ModrinthProject,
  ModrinthVersion,
  MojangFullVersion,
  PaperBuild,
  PaperVersionList,
} from "./responseTypes.js";
import { fetchJson, downloadFile } from "./fetching.js";
import path from "node:path";

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
        `https://api.modrinth.com/v2/project/${modId}/version?loaders=["fabric"]&game_versions=["${gameVersion}"]`
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
