let LINUX = require('linux-commands-async');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

//----------------------------------------
// ENCODERS

/**
 * List all encoders.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function AllEncoders() {
  return new Promise((resolve, reject) => {
    LOCAL_COMMAND.Execute('ffmpeg', ['-encoders']).then(output => {
      if (output.stderr && !output.stderr.startsWith('ffmpeg')) {
        reject(`Failed to get all encoders: ${output.stderr}`);
        return;
      }

      let parts = output.stdout.split('------');

      // string
      let left = parts[0].trim();
      let string = left.split('Encoders:')[1].trim();

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

      let encoders = [];
      encoders.sort((a, b) => {
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
              t = { char: char, string: dict[char].string };
            types.push(t);
          }
        }

        let cName = cParts[1].trim();
        let cString = cParts.slice(2).join(' ');

        encoders.push({ name: cName, string: cString, types: types });
      });
      resolve(encoders);
    }).catch(error => `Failed to get all encoders: ${error}`);
  });
}

/**
 * List all video encoders.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function VideoEncoders() {
  return new Promise((resolve, reject) => {
    AllEncoders().then(encoders => {
      let ret = [];
      encoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'V')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get video encoders: ${error}`);
  });
}

/**
 * List all audio encoders.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function AuidoEncoders() {
  return new Promise((resolve, reject) => {
    AllEncoders().then(encoders => {
      let ret = [];
      encoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'A')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get audio encoders: ${error}`);
  });
}

/**
 * List all subtitle encoders.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function SubtitleEncoders() {
  return new Promise((resolve, reject) => {
    AllEncoders().then(encoders => {
      let ret = [];
      encoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'S' && type.string == 'Subtitle')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get subtitle encoders: ${error}`);
  });
}

/**
 * List all frame-level multithreading encoders.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function FrameLevelMultithreadingEncoders() {
  return new Promise((resolve, reject) => {
    AllEncoders().then(encoders => {
      let ret = [];
      encoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'F')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get frame-level multithreading encoders: ${error}`);
  });
}

/**
 * List all slice-level multithreading encoders.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function SliceLevelMultithreadingEncoders() {
  return new Promise((resolve, reject) => {
    AllEncoders().then(encoders => {
      let ret = [];
      encoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'S' && type.string == 'Slice-level multithreading')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get slice-level multithreading encoders: ${error}`);
  });
}

/**
 * List all experimental encoders.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function ExperimentalEncoders() {
  return new Promise((resolve, reject) => {
    AllEncoders().then(encoders => {
      let ret = [];
      encoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'X')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get experimental encoders: ${error}`);
  });
}

/**
 * List all draw horiz band encoders.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function DrawHorizBandEncoders() {
  return new Promise((resolve, reject) => {
    AllEncoders().then(encoders => {
      let ret = [];
      encoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'B')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get draw horiz band encoders: ${error}`);
  });
}

/**
 * List all direct rendering method 1 encoders.
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function DirectRenderingMethod1Encoders() {
  return new Promise((resolve, reject) => {
    AllEncoders().then(encoders => {
      let ret = [];
      encoders.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'D')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get direct rendering method 1 encoders: ${error}`);
  });
}

//-------------------------------------
// EXPORTS

exports.AllEncoders = AllEncoders;
exports.VideoEncoders = VideoEncoders;
exports.AuidoEncoders = AuidoEncoders;
exports.SubtitleEncoders = SubtitleEncoders;
exports.FrameLevelMultithreadingEncoders = FrameLevelMultithreadingEncoders;
exports.SliceLevelMultithreadingEncoders = SliceLevelMultithreadingEncoders;
exports.ExperimentalEncoders = ExperimentalEncoders;
exports.DrawHorizBandEncoders = DrawHorizBandEncoders;
exports.DirectRenderingMethod1Encoders = DirectRenderingMethod1Encoders;