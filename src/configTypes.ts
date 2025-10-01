export type Modloader = "fabric" | "paper" | "neoforge" | "forge";

export type ModPreset =
  | {
      default?: boolean;
      mods: string | string[];
    }
  | string;

export type Config = {
  defaultMods?: { [K in Modloader]?: string[] };
  modPresets?: { [K in Modloader]?: Record<string, ModPreset> };
  javaPaths?: Record<"default" | `${number}`, string>;
};
