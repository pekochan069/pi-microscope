import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { createMicroscopeHandler } from "./command.ts";
import { FffFinderService } from "./finder.ts";

export default function (pi: ExtensionAPI) {
  let finder: FffFinderService | undefined;

  pi.registerCommand("microscope", {
    description: "Select a repository file and append it as an @file reference",
    handler: async (args, ctx) => {
      finder ??= new FffFinderService(ctx.cwd);
      await createMicroscopeHandler({ finder })(args, ctx);
    },
  });

  pi.on("session_shutdown", () => {
    finder?.destroy();
  });
}
