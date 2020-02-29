import { sequenceT } from "fp-ts/lib/Apply";
import { array, map, reduce } from "fp-ts/lib/Array";
import * as E from "fp-ts/lib/Either";
import { toError } from "fp-ts/lib/Either";
import { flow } from "fp-ts/lib/function";
import * as IOE from "fp-ts/lib/IOEither";
import { IOEither } from "fp-ts/lib/IOEither";
import * as O from "fp-ts/lib/Option";
import { Option } from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import { TaskEither, taskEither } from "fp-ts/lib/TaskEither";
import { existsSync, readFile } from "fs";
import * as glob from "glob";
import * as path from "path";
import { ConfigSpec, customConfig, defaultConfig } from "./config";
import hacss from "./hacss";

const resolvePath = (p: string): IOEither<Error, string> => pipe(
  IOE.tryCatch(() => process.cwd(), toError),
  IOE.map(d => path.join(d, p)),
  IOE.filterOrElse(
    p => existsSync(p),
    p => new Error(`Does not exist: ${p}`)
  )
);

const loadConfig: (path: string) => IOEither<Error, ConfigSpec> = flow(
  path => IOE.tryCatch(() => require(path), toError),
  IOE.chain(flow(customConfig, E.mapLeft(toError), IOE.fromEither))
);

const globT: ((pattern: string) => TaskEither<Error, string[]>) =
  TE.taskify(glob);

const readFileUTF8T: (path: string) => TaskEither<Error, string> = flow(
  TE.taskify(readFile),
  TE.map((b: Buffer) => b.toString()),
  TE.mapLeft(toError)
);

export type BuildArgs = {
  config: Option<string>;
  sources: string;
};

export const build = (args: BuildArgs): TaskEither<Error, string> => {
  const config: IOEither<Error, ConfigSpec> = pipe(
    args.config,
    O.map(flow(IOE.right, IOE.chain(resolvePath), IOE.chain(loadConfig))),
    O.getOrElse(() =>
      pipe(
        resolvePath("hacss.config.js"),
        IOE.chain(loadConfig),
        IOE.alt(() => IOE.right(defaultConfig))
      )
    )
  );

  const sources: TaskEither<Error, string> = pipe(
    globT(args.sources),
    TE.chain(flow(map(readFileUTF8T), array.sequence(TE.taskEither))),
    TE.map(reduce("", (a, b) => a + "\n" + b))
  );

  return pipe(
    sequenceT(taskEither)(
      sources,
      TE.fromIOEither(config)
    ),
    TE.map(([ sources, config ]) => hacss(sources, config))
  );

};
