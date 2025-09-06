export type FabricMetaVersion = {
  version: string;
};

export type ModrinthProject = {
  title: string;
  game_versions: string[];
};
export type ModrinthVersion = {
  id: string;
  version_type: "release" | "beta" | "alpha";
  files: { filename: string; url: string }[];
};

export type MojangVersion = {
  id: string;
  url: string;
};
export type MojangFullVersion = {
  downloads: {
    server?: {
      url: string;
    };
  };
  javaVersion: {
    majorVersion: number;
  };
};
