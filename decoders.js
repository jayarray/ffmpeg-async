let LINUX = require('linux-commands-async.js');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

//----------------------------------------
// DECODERS

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function AllDecoders() {
  return new Promise((resolve, reject) => {
    LOCAL_COMMAND.Execute('ffmpeg', ['-decoders']).then(output => {
      if (output.stderr && !output.stderr.startsWith('ffmpeg')) {
        reject(`Failed to get all decoders: ${output.stderr}`);
        return;
      }

      let parts = output.stdout.split('------');

      // string
      let left = parts[0].trim();
      let string = left.split('Decoders:')[1].trim();

      // dict
      let dict = {
        V: { index: 0, string: 'Video' },
        A: { index: 0, string: 'Audio' },
        S: {
          0: { index: 2, string: 'Subtitle' },
          2: { index: 5, string: 'Slice-level multithreading' }
        },
        F: { index: 1, string: 'Frame-level multithreading' },
        X: { index: 3, string: 'Codec is experimental' },
        B: { index: 4, string: 'Supports draw_horiz_band' },
        D: { index: 5, string: 'Supports direct rendering method 1' },
      };

      // codecs
      let right = parts[1].trim();

      let decoders = [];
      decoders.sort((a, b) => {
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
          let t = null;
          if (char != '.') {
            if (char == 'S')
              t = { char: char, string: dict[char][`${i}`].string };
            else
              t = ({ char: char, string: dict[char].string });
            types.push(t);
          }
        }

        let cName = cParts[1].trim();

        let cString = cParts.slice(2).join(' ');

        decoders.push({ name: cName, string: cString, types: types });
      });
      resolve(decoders);
    }).catch(error => `Failed to get all decoders: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function VideoDecoders() {
  return new Promise((resolve, reject) => {
    AllDecoders().then(decoders => {
      let ret = [];
      decoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'V')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get video decoders: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function AudioDecoders() {
  return new Promise((resolve, reject) => {
    AllDecoders().then(decoders => {
      let ret = [];
      decoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'A')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get audio decoders: ${error}`);
  });
}

/**
* @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
*/
function SubtitleDecoders() {
  return new Promise((resolve, reject) => {
    AllDecoders().then(decoders => {
      let ret = [];
      decoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'S' && type.string == 'Subtitle')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get subtitle decoders: ${error}`);
  });
}

/**
* @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
*/
function FrameLevelMultithreadingDecoders() {
  return new Promise((resolve, reject) => {
    AllDecoders().then(decoders => {
      let ret = [];
      decoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'F')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get frame-level multithreading decoders: ${error}`);
  });
}

/**
* @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
*/
function SliceLevelMultithreadingDecoders() {
  return new Promise((resolve, reject) => {
    AllDecoders().then(decoders => {
      let ret = [];
      decoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'S' && type.string == 'Slice-level multithreading')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get slice-level multithreading decoders: ${error}`);
  });
}

/**
* @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
*/
function ExperimentalDecoders() {
  return new Promise((resolve, reject) => {
    AllDecoders().then(decoders => {
      let ret = [];
      decoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'X')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get experimental decoders: ${error}`);
  });
}

/**
* @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
*/
function DrawHorizBandDecoders() {
  return new Promise((resolve, reject) => {
    AllDecoders().then(decoders => {
      let ret = [];
      decoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'B')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get draw horiz band decoders: ${error}`);
  });
}

/**
* @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
*/
function DirectRenderingMethod1() {
  return new Promise((resolve, reject) => {
    AllDecoders().then(decoders => {
      let ret = [];
      decoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'D')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get direct rendering method 1 decoders: ${error}`);
  });
}

//------------------------------------
// EXPORTS

exports.AllDecoders = AllDecoders;
exports.VideoDecoders = VideoDecoders;
exports.AudioDecoders = AudioDecoders;
exports.SubtitleDecoders = SubtitleDecoders;
exports.FrameLevelMultithreadingDecoders = FrameLevelMultithreadingDecoders;
exports.SliceLevelMultithreadingDecoders = SliceLevelMultithreadingDecoders;
exports.ExperimentalDecoders = ExperimentalDecoders;
exports.DrawHorizBandDecoders = DrawHorizBandDecoders;
exports.DirectRenderingMethod1 = DirectRenderingMethod1;