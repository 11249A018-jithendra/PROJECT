const readline = require('readline');

// Prompt that shows * for each character typed (or pasted) instead of the
// password itself. Backspace works; Ctrl+C cancels.
const askHidden = (question) =>
  new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      // Piped input: read one line.
      const rl = readline.createInterface({ input: stdin });
      rl.once('line', (line) => { rl.close(); process.stdout.write('\n'); resolve(line); });
      return;
    }
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      // Drop terminal control sequences, e.g. the [200~ ... [201~ markers some
      // terminals wrap around pasted text.
      chunk = chunk.replace(/\x1b\[[0-9;]*[~A-Za-z]/g, '');
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(1); }
        if (ch === '\b' || ch === '\u007f') {
          if (value.length) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
        } else if (ch >= ' ') {
          value += ch;
          process.stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });

module.exports = { askHidden };
