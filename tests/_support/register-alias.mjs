// Loaded through `node --import` by the `npm test` script so unit tests can
// exercise modules under src/ that import through the `@/` path alias.
import { register } from "node:module";

register("./resolve-alias.mjs", import.meta.url);
