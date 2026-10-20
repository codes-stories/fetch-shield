import { writeFileSync } from "node:fs";

const esmPackageJson = new URL("../dist/esm/package.json", import.meta.url);
const cjsPackageJson = new URL("../dist/cjs/package.json", import.meta.url);

writeFileSync(
  esmPackageJson,
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
);
writeFileSync(
  cjsPackageJson,
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
);
