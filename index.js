import { lambda, fetch, Console, Format } from '@node-lambdas/core';

const zipUrl = (repo) => `https://codeload.github.com/${repo}/zip/master`;
const tarUrl = (repo) => `https://codeload.github.com/${repo}/legacy.tar.gz/master`;
const MACOS_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36';

async function handle(url, output) {
  Console.log('GET', url);

  try {
    const response = await fetch(url, { headers: { 'User-Agent': MACOS_CHROME } });
    response.pipe(output);
  } catch (error) {
    Console.error(error);
    output.reject(error.message);
  }
}

export default lambda({
  version: 2,
  actions: {
    zip: {
      default: true,
      input: Format.Text,
      description: 'Download a GitHub repository as a zip file.\nInput has the format of "org/repo"',
      handler: (input, output) => handle(zipUrl(input.body), output),
    },
    tar: {
      input: Format.Text,
      description: 'Download a GitHub repository as a tarball (.tgz) file.\nInput has the format of "org/repo"',
      handler: (input, output) => handle(tarUrl(input.body), output),
    },
  },
});
