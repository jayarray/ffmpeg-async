let LINUX = require('linux-commands-async.js');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

//------------------------------------------
// FORMATS

/**
 * List all formats.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function AllFormats() {
  return new Promise((resolve, reject) => {
    LOCAL_COMMAND.Execute('ffmpeg', ['-formats']).then(output => {
      if (output.stderr && !output.stderr.startsWith('ffmpeg')) {
        reject(`Failed to get all formats: ${output.stderr}`);
        return;
      }

      let parts = output.stdout.split('--');

      // string
      let left = parts[0].trim();
      let string = left.split('File formats:')[1].trim();

      // dict
      let dict = {
        D: { index: 0, string: 'Demuxing supported' },
        E: { index: 1, string: 'Muxing supported' },
      };

      // codecs
      let right = parts[1].trim();

      let formats = [];
      formats.sort((a, b) => {
        return a - b;
      });

      let lines = right.split('\n');
      lines.forEach(line => {
        let lTrimmed = line.trim();
        let cParts = lTrimmed.split(' ').filter(p => p.trim() != '');

        let types = [];
        let cSupported = cParts[0].trim();
        for (let i = 0; i < cSupported.length; ++i) {
          let char = cSupported[i];
          let t = ({ char: char, string: dict[char].string });
          types.push(t);
        }

        let cName = cParts[1].trim();

        let cString = cParts.slice(2).join(' ');

        formats.push({ name: cName, string: cString, types: types });
      });
      resolve(formats);
    }).catch(error => `Failed to get all formats: ${error}`);
  });
}

/**
 * List all formats that can be used as input.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function InputFormats() {
  return new Promise((resolve, reject) => {
    AllFormats().then(formats => {
      resolve(formats.filter(f => f.char == 'D'));
    }).catch(error => `Failed to get input formats: ${error}`);
  });
}

/**
 * List all formats that can be used as output.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function OutputFormats() {
  return new Promise((resolve, reject) => {
    AllFormats.then(formats => {
      resolve(formats.filter(f => f.char == 'E'));
    }).catch(fataerror => `Failed to get output formats: ${error}`);
  });
}

//------------------------------------
// EXPORTS

exports.AllFormats = AllFormats;
exports.InputFormats = InputFormats;
exports.OutputFormats = OutputFormats;