import { cp, readFile, rm, writeFile } from "node:fs/promises";

const source = new URL("../public/", import.meta.url);
const output = new URL("../dist/vercel/", import.meta.url);
const sourcePage = new URL("myuang.html", source);
const html = await readFile(sourcePage, "utf8");
const documentElement = '<html lang="id">';

if (!html.includes(documentElement)) {
  throw new Error("Cannot enable browser storage on the MyUang page.");
}

await rm(output, { recursive: true, force: true });
await cp(source, output, { recursive: true });
await writeFile(
  new URL("myuang.html", output),
  html.replace(documentElement, '<html lang="id" data-portable="true">'),
);
