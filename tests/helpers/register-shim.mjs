// Entry point: node --experimental-strip-types --import ./tests/helpers/register-shim.mjs
import { register } from "node:module";
register("./node-shim.mjs", import.meta.url);
