export type ModPreset =
  | {
      default?: boolean;
      mods: string | string[];
    }
  | string;

export type Config = {
  defaultMods?: string[];
  modPresets?: Record<string, ModPreset>;
  javaPaths: Record<"default" | `${number}`, string>;
};

const a: Config = {
  defaultMods: ["P7dR8mSH"],
  modPresets: {
    Optimization: { default: true, mods: ["a"] },
    spark: { default: true, mods: "l6YH9Als" },
    "No Chat Reports": "qQyHxfxd",
    "Simple Voice Chat": "9eGKb6K1",
  },
  javaPaths: {
    "8": "/usr/lib/jvm/java-8-openjdk/jre/bin/java",
    "17": "/home/sam/.local/share/PrismLauncher/java/java-runtime-gamma/bin/java",
    "21": "/home/sam/.jdks/temurin-21.0.5/bin/java",
    default: "java",
  },
};
