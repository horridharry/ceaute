// `node --import ./scripts/local/loader/register.mjs …` — see hooks.mjs.
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
