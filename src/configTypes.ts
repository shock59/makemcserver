export type ModPreset =
  | {
      default?: boolean;
      mods: string | string[];
    }
  | string;

export type Config = {
  defaultMods?: string[];
  modPresets?: Record<string, ModPreset>;
  javaPaths?: Record<"default" | `${number}`, string>;
};
