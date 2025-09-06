# makemcserver

makemcserver is a CLI tool which can be used to easily set up a Minecraft server, useful if you need to quickly set up a server to run on your local PC without having to go into a web browser and manually download lots of files. It lets you choose any Minecraft version, and also installs the [Fabric mod loader](https://fabricmc.net/) when possible. Additionally, it allows you to install mods from [Modrinth](https://modrinth.com/) of your choice which you can specify in a config file.

## Configuration

The configuration is stored as a YAML file which can be in the following locations:
* `makemcserver.yml` in the current working directory
* On Linux: `XDG_CONFIG_HOME/makemcserver/makemcserver.yml` (usually this is `~/.config/makemcserver/makemcserver.yml`)
* On Windows: `%AppData%\makemcserver\Config\makemcserver.yml`
* On Mac: `~/Library/Preferences/makemcserver/makemcserver.yml`
* `.makemcserver.yml` in your home directory

It can be formatted like this (all three major sections are optional):
```yml
defaultMods:
  # A list of the mods which should always be installed on the server when possible, as their Modrinth IDs.
  # Example:
  - "P7dR8mSH" # Fabric API

modPresets:
  # A list of Modrinth mod IDs which you can choose to install each time you create a new server. This can be structured in a variety of ways.
  # Examples:
  "Optimization":
    default: true
    mods:
      - "gvQqBUqZ" # Lithium
      - "uXXizFIs" # FerriteCore
      - "NRjRiSSD" # Memory Leak Fix
      - "fQEb0iXm" # Krypton
      - "VSNURh3q" # C2ME
      - "KuNKN7d2" # Noisium
  "spark":
    default: true
    mods: "l6YH9Als"
  "No Chat Reports": "qQyHxfxd"
  "Simple Voice Chat": "9eGKb6K1"

javaPaths:
  # Paths to the Java runtime for different Java versions, as well as a fallback "default" option. makemcserver will automatically select the correct Java version from this list.
  # Examples:
  default: "java"
  8: "/usr/lib/jvm/java-8-openjdk/jre/bin/java"
```

To get the Modrinth ID for a mod, go to its page on the Modrinth website, click the three dots in the top right and click on "Copy ID".