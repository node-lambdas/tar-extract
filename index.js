import { lambda } from '@node-lambdas/core';
import { Console } from 'console';
import * as GlobToRegExp from 'glob-to-regexp';
import * as TarStream from 'tar-stream';
import { createUnzip } from 'zlib';

const { extract } = TarStream.default;
const globToRegExp = GlobToRegExp.default;

function getMatcher(input) {
  let matcher = () => true;

  if (input.options.patterns) {
    const patterns = input.options.patterns.split(',').map((pattern) => globToRegExp(pattern));
    matcher = (file) => patterns.some((pattern) => pattern.test(file));
  }

  if (input.options.extensions) {
    const extensions = input.options.extensions.split(',');
    matcher = (file) => extensions.some((extension) => file.endsWith('.' + extension));
  }

  return matcher;
}

function escapeDoubleQuotes(string) {
  return string.replace(/"/g, '\\"');
}

export default lambda({
  version: 2,
  actions: {
    extract: {
      default: true,
      options: {
        patterns: 'string',
        extension: 'string',
      },
      description: [
        'Extract files from a tar stream and output the results as a JSON array',
        'The file content will be converted to a hexadecimal string.',
        'Each entry has name, size, and content (if --content option is provided).',
        'Filter by extensions (e.g. --extensions=md,js,html) or with file match patterns (e.g. --patterns="**/*.txt,**/*.md")',
      ].join('\n'),

      handler: (input, output) => {
        const withContent = input.options.content;
        output.write('[');

        const onError = (error) => {
          Console.error(error);
          output.reject(error);
        };

        const matcher = getMatcher(input);
        const pushHex = (buffer) => output.write(buffer.toString('hex'));
        const stream = extract();
        let isFirst = true;

        stream.on('entry', async (header, body, next) => {
          const resume = () => {
            body.on('end', () => next());
            body.resume();
          };

          const { type, name, size } = header;

          if (type !== 'file' || !matcher(name)) {
            resume();
            return;
          }

          if (!isFirst) {
            output.write(',\n');
          }

          output.write('{\n  "name": "' + escapeDoubleQuotes(name) + '",\n  "size": ' + size);

          if (withContent) {
            output.write(',\n  "content": "');

            body.on('error', onError);
            body.on('data', pushHex);
            body.on('end', (chunk) => {
              chunk && pushHex(chunk);
              output.write('"\n}');
              next();
            });
          } else {
            output.write('\n}');
            resume();
          }

          isFirst = false;
        });

        stream.on('finish', () => output.end(']'));
        stream.on('error', onError);

        input.pipe(createUnzip()).pipe(stream);
      },
    },
  },
});
