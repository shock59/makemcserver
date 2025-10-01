import { Config } from "./configTypes.js";

const defaultConfig: Config = {
  defaultMods: { fabric: ["P7dR8mSH"] },
  modPresets: {
    fabric: {
      Optimization: {
        default: true,
        mods: [
          "gvQqBUqZ",
          "uXXizFIs",
          "NRjRiSSD",
          "fQEb0iXm",
          "VSNURh3q",
          "KuNKN7d2",
        ],
      },
      spark: { default: true, mods: "l6YH9Als" },
      "No Chat Reports": "qQyHxfxd",
      "Simple Voice Chat": "9eGKb6K1",
    },
    paper: {
      FreedomChat: "MubyTbnA",
      "Simple Voice Chat": "9eGKb6K1",
      WorldEdit: "1u6JkXh5",
      ViaVersion: "P1OZGk5p",
      LuckPerms: "Vebnzrzj",
    },
    neoforge: {
      spark: { default: true, mods: "l6YH9Als" },
      "No Chat Reports": "qQyHxfxd",
      "Simple Voice Chat": "9eGKb6K1",
    },
    forge: {
      spark: { default: true, mods: "l6YH9Als" },
      "No Chat Reports": "qQyHxfxd",
      "Simple Voice Chat": "9eGKb6K1",
    },
  },
};
export default defaultConfig;
