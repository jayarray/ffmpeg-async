let LINUX = require('linux-commands-async.js');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

//----------------------------------------
// CODECS

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function AllCodecs() {
  return new Promise((resolve, reject) => {
    LOCAL_COMMAND.Execute('ffmpeg', ['-codecs']).then(output => {
      if (output.stderr && !output.stderr.startsWith('ffmpeg')) {
        reject(`Failed to get all codecs: ${output.stderr}`);
        return;
      }

      let parts = output.stdout.split('-------');

      // string
      let left = parts[0].trim();
      let string = left.split('Codecs:')[1].trim();

      // dict
      let dict = {
        D: { index: 0, string: 'Decoding supported' },
        E: { index: 1, string: 'Encoding supported' },
        V: { index: 2, string: 'Video codec' },
        A: { index: 2, string: 'Audio codec' },
        S: {
          2: { index: 2, string: 'Subtitle codec' },
          5: { index: 5, string: 'Lossless compression' }
        },
        I: { index: 3, string: 'Intra frame-only codec' },
        L: { index: 4, string: 'Lossy compression' },
      };

      // codecs
      let right = parts[1].trim();

      let codecs = [];
      codecs.sort((a, b) => {
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
        codecs.push({ name: cName, string: cString, types: types });
      });
      resolve(codecs);
    }).catch(error => `Failed to get all codecs: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function DecodingCodecs() {
  return new Promise((resolve, reject) => {
    AllCodecs.then(codecs => {
      let ret = [];
      codecs.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'D')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get decoding codecs: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function EncodingCodecs() {
  return new Promise((resolve, reject) => {
    AllCodecs.then(codecs => {
      let ret = [];
      codecs.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'E')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get encoding codecs: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function EncodingDecodingCodecs() {
  return new Promise((resolve, reject) => {
    AllCodecs.then(codecs => {
      let ret = [];
      codecs.forEach(codec => {
        if (codec.types.E != undefined && codec.types.D != undefined) {
          ret.push(codec);
        }
      });
      resolve(ret);
    }).catch(error => `Failed to get codecs that can both encode and decode: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function AudioCodecs() {
  return new Promise((resolve, reject) => {
    AllCodecs().then(codecs => {
      let ret = [];
      codecs.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'A')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get audio codecs: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function VideoCodecs() {
  return new Promise((resolve, reject) => {
    AllCodecs().then(codecs => {
      let ret = [];
      codecs.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'V')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get video codecs: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function SubtitleCodecs() {
  return new Promise((resolve, reject) => {
    AllCodecs().then(codecs => {
      let ret = [];
      codecs.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'S' && type.string == 'Subtitle codec')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get subtitle codecs: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function IntraFrameOnlyCodecs() {
  return new Promise((resolve, reject) => {
    AllCodecs().then(codecs => {
      let ret = [];
      codecs.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'I')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get intra-frame only codecs: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function LossyCompressionCodecs() {
  return new Promise((resolve, reject) => {
    AllCodecs().then(codecs => {
      let ret = [];
      codecs.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'L')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get lossy compression codecs: ${error}`);
  });
}

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function LosslessCompression() {
  return new Promise((resolve, reject) => {
    AllCodecs().then(codecs => {
      let ret = [];
      codecs.forEach(codec => {
        codec.types.forEach(type => {
          if (type.char == 'S' && type.string == 'Lossless compression')
            ret.push(codec);
        });
      });
      resolve(ret);
    }).catch(error => `Failed to get lossless compression codecs: ${error}`);
  });
}

//---------------------------------------------
// EXPORTS

exports.AllCodecs = AllCodecs;
exports.DecodingCodecs = DecodingCodecs;
exports.EncodingCodecs = EncodingCodecs;
exports.EncodingDecodingCodecs = EncodingDecodingCodecs;
exports.AudioCodecs = AudioCodecs;
exports.VideoCodecs = VideoCodecs;
exports.SubtitleCodecs = SubtitleCodecs;
exports.IntraFrameOnlyCodecs = IntraFrameOnlyCodecs;
exports.LossyCompressionCodecs = LossyCompressionCodecs;
exports.LosslessCompression = LosslessCompression;