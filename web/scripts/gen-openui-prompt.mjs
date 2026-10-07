// Generates the base OpenUI Lang system prompt (syntax + all chat components +
// examples) from the SAME library the frontend renders with, and writes it where
// the server reads it. This keeps the server free of the heavy react-ui dependency
// while guaranteeing the prompt matches the renderer. Re-run when react-ui updates:
//   npm run gen:prompt   (from web/)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openuiChatLibrary, openuiChatPromptOptions } from "@openuidev/react-ui/genui-lib";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../server/prompts/openui-chat.system.txt");

const prompt = String(openuiChatLibrary.prompt(openuiChatPromptOptions));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, prompt, "utf8");
console.log(`wrote ${out} (${prompt.length} chars)`);
