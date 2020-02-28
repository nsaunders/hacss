"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Apply_1 = require("fp-ts/lib/Apply");
const Array_1 = require("fp-ts/lib/Array");
const E = require("fp-ts/lib/Either");
const Either_1 = require("fp-ts/lib/Either");
const function_1 = require("fp-ts/lib/function");
const IOE = require("fp-ts/lib/IOEither");
const O = require("fp-ts/lib/Option");
const pipeable_1 = require("fp-ts/lib/pipeable");
const TE = require("fp-ts/lib/TaskEither");
const TaskEither_1 = require("fp-ts/lib/TaskEither");
const fs_1 = require("fs");
const glob = require("glob");
const path = require("path");
const config_1 = require("./config");
const hacss_1 = require("./hacss");
const resolvePath = (p) => pipeable_1.pipe(IOE.tryCatch(() => process.cwd(), Either_1.toError), IOE.map(d => path.join(d, p)), IOE.filterOrElse(p => fs_1.existsSync(p), p => new Error(`Does not exist: ${p}`)));
const loadConfig = function_1.flow(path => IOE.tryCatch(() => require(path), Either_1.toError), IOE.chain(function_1.flow(config_1.customConfig, E.mapLeft(Either_1.toError), IOE.fromEither)));
const globT = TE.taskify(glob);
const readFileUTF8T = function_1.flow(TE.taskify(fs_1.readFile), TE.map((b) => b.toString()), TE.mapLeft(Either_1.toError));
const createWriteStreamSafe = (f) => IOE.tryCatch(() => fs_1.createWriteStream(f), Either_1.toError);
exports.build = (args) => {
    const config = pipeable_1.pipe(args.config, O.map(function_1.flow(IOE.right, IOE.chain(resolvePath), IOE.chain(loadConfig))), O.getOrElse(() => pipeable_1.pipe(resolvePath("hacss.config.js"), IOE.chain(loadConfig), IOE.alt(() => IOE.right(config_1.defaultConfig)))));
    const sources = pipeable_1.pipe(globT(args.sources), TE.chain(function_1.flow(Array_1.map(readFileUTF8T), Array_1.array.sequence(TE.taskEither))), TE.map(Array_1.reduce("", (a, b) => a + "\n" + b)));
    const outputStream = pipeable_1.pipe(args.output, O.map(function_1.flow(IOE.right, IOE.chain(resolvePath), IOE.chain(createWriteStreamSafe))), O.getOrElse(() => IOE.right(process.stdout)));
    return pipeable_1.pipe(Apply_1.sequenceT(TaskEither_1.taskEither)(sources, TE.fromIOEither(config), TE.fromIOEither(outputStream)), TE.map(([sources, config, output]) => { output.write(hacss_1.default(sources, config)); }));
};
