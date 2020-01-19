#!/usr/bin/env node

const fs = require("fs");
const glob = require("glob");
const mkdirp = require("mkdirp");
const path = require("path");
const util = require("util");

const { name } = require("./package.json");
const buildCSS = require("./index.js");

const [globP, mkdirpP, readFileP, writeFileP] = [
  glob,
  mkdirp,
  fs.readFile,
  fs.writeFile,
].map(util.promisify);

const a = process.argv.slice(2);

const validArgs =
  [1, 3, 5].includes(a.length) &&
  !a[a.length - 1].startsWith("--") &&
  a.every(a => !a.startsWith("--") || ["--config", "--output"].includes(a));

if (!validArgs) {
  console.log(
    `Usage: ${name} --config <config-file> [--output <output-file>] <sources>`,
  );
} else {
  const options = {
    config: path.join(__dirname, "hacss.config.js"),
    output: null,
    sources: a[a.length - 1],
  };

  const configIx = a.indexOf("--config");

  if (configIx !== -1) {
    options.config = path.join(process.cwd(), a[configIx + 1]);
  }

  const outputIx = a.indexOf("--output");

  if (outputIx !== -1) {
    options.output = path.join(process.cwd(), a[outputIx + 1]);
  }

  const config = require("./config/index.js");
  if (fs.existsSync(options.config)) {
    const custom = require(options.config);
    config.rules = { ...config.rules, ...custom.rules };
    config.scopes = { ...config.scopes, ...custom.scopes };
    config.direction = custom.direction || config.direction;
  }

  globP(options.sources)
    .then(sources => Promise.all(sources.map(s => readFileP(s, "utf8"))))
    .then(sources => sources.join("\n"))
    .then(code => buildCSS(config, code))
    .then(css =>
      options.output
        ? mkdirpP(path.dirname(options.output)).then(() =>
            writeFileP(options.output, css),
          )
        : process.stdout.write(css),
    )
    .catch(err => console.error(err));
}
