import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";

import { matchesKey } from "@earendil-works/pi-tui";

import { createMicroscopeHandler } from "./command.ts";
import { loadMicroscopeOptions } from "./config.ts";
import { FffFinderService } from "./finder.ts";
import { GitChangedService } from "./git.ts";

export default function (pi: ExtensionAPI) {
  let finder: FffFinderService | undefined;
  let gitChanged: GitChangedService | undefined;
  let isPickerOpen = false;
  let unsubscribeTerminalInput: (() => void) | undefined;

  const startupOptions = loadMicroscopeOptions().options;

  const openMicroscope = async (args: string, ctx: ExtensionContext) => {
    if (isPickerOpen) return;
    isPickerOpen = true;
    try {
      const loaded = loadMicroscopeOptions(ctx.cwd);
      for (const warning of loaded.warnings) ctx.ui.notify(warning, "warning");

      finder ??= new FffFinderService(ctx.cwd, undefined, undefined, loaded.options.pageSize);
      gitChanged ??= new GitChangedService(ctx.cwd);
      await createMicroscopeHandler({
        finder,
        gitChanged,
        options: loaded.options,
        basePath: ctx.cwd,
      })(args, ctx as never);
    } finally {
      isPickerOpen = false;
    }
  };

  pi.registerCommand("microscope", {
    description: "Select repository files and append them as @file references",
    handler: async (args, ctx) => {
      await openMicroscope(args, ctx);
    },
  });

  if (startupOptions.shortcut !== false) {
    pi.registerShortcut(startupOptions.shortcut, {
      description: "Open pi-microscope",
      handler: async (ctx) => {
        await openMicroscope("", ctx);
      },
    });
  }

  pi.on("session_start", (_event, ctx) => {
    unsubscribeTerminalInput?.();
    const loaded = loadMicroscopeOptions(ctx.cwd);
    if (loaded.options.shortcut === false) return;

    unsubscribeTerminalInput = ctx.ui.onTerminalInput((data) => {
      if (isPickerOpen || !matchesKey(data, loaded.options.shortcut as KeyId)) return undefined;
      void openMicroscope("", ctx);
      return { consume: true };
    });
  });

  pi.on("session_shutdown", () => {
    unsubscribeTerminalInput?.();
    unsubscribeTerminalInput = undefined;
    finder?.destroy();
  });
}
