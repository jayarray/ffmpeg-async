
let FILESYSTEM = require('filesystem-async.js');
let FFPROBE = require('ffprobe-async.js');

//-----------------------------------
// ERROR CATCHING

function fatalFail(error) {
  console.log(error);
  process.exit(-1);
}

//------------------------------------
// TIME
class Time {
  static error(string) {
    if (string === undefined)
      return 'Time string is undefined';
    else if (string == null)
      return 'Time string is null';
    else if (string == '')
      return 'Time string is empty';
    else if (string.trim() == '')
      return 'Time string is whitespace';
    else
      return null;
  }

  static string_validation(string) {
    let error = Time.error(string);
    if (error) {
      return { isValid: false, error: error };
    }

    let sTrimmed = string.trim();
    let parts = sTrimmed.split(':');

    if (parts.length == 3) {
      let hours = parts[0].trim();

      // Check hours
      let hoursIsValid = null;
      if (hours.length == 1 && Number.isInteger(hours))
        hoursIsValid = true;
      else if (hours.length > 1 && hours.charAt(0) != '0' && Number.isInteger(hours.substring(1))) // HOURS does not need leading zeros
        hoursIsValid = true;
      else
        hoursIsValid = false;


      if (hoursIsValid) {
        let minutes = parts[1].trim();

        // Check minutes
        if (minutes.length == 2 && Number.isInteger(minutes) && Number.isInteger(hours.charAt(0)) && Number.isInteger(hours.charAt(1))) {
          let secondsStr = parts[2].trim();

          // Check seconds
          let containsMantissa = secondsStr.includes('.');

          let seconds = null;
          if (containsMantissa)
            seconds = seconds.split('.')[0];
          else
            seconds = secondsStr;

          if (seconds.length == 2 && Number.isInteger(seconds.charAt(0)) && Number.isInteger(seconds.charAt(1))) {
            if (containsMantissa) {
              let mantissa = seconds.split('.')[1];

              if (mantissa.length == 6) {
                let areAllInts = true;
                for (let i = 0; i < mantissa.length; ++i) {
                  if (!Number.isInteger(mantissa.charAt(i)))
                    areallInts = false;
                  break;
                }

                if (areAllInts)
                  return { isValid: true, error: null };
              }
            }
            return { isValid: true, error: null };
          }
        }
      }
      return { isValid: false, error: 'Time string is not formatted correctly. Must follow one of two formats: H:MM:SS or H:MM:SS.xxxxxx' };
    }
  }
}

//----------------------------------------
// SOURCE
class Source {
  static error(src) {
    if (src === undefined)
      return 'Source is undefined';
    else if (src == null)
      return 'Source is null';
    else if (src == '')
      return 'Source is empty';
    else if (src.trim() == '')
      return 'Source is whitespace';
    else
      return null;
  }

  static list_errors(sources) {
    return new Promise((resolve, reject) => {
      if (sources === undefined) {
        resolve(['Source list is undefined']);
        return
      }

      if (sources == null) {
        resolve(['Source list is null']);
        return;
      }

      if (!Array.isArray(sources)) {
        resolve(['Source list is not an array']);
        return;
      }

      if (sources.length == 0) {
        resolve(['Source list is empty']);
        return;

        // Validate sources
        let validation_errors = [];
        sources.forEach(src => {
          let error = source_error(src);
          if (error)
            validation_errors.push(`${error}: ${src}`);
        });

        if (validation_errors.length > 0) {
          resolve(validation_errors);
          return;
        }

        // Trim all source paths
        let srcsTrimmed = sources.map(src => src.trim());

        // Check existance
        let actions = srcsTrimmed.map(FILESYSTEM.Path.exists);
        Promise.all(actions).then(results => {
          let existance_errors = [];

          for (let i = 0; i < results.length; ++i) {
            let currResult = results[i];
            if (currResult.error)
              existance_errors.push(`${error}: ${srcsTrimmed[i]}`);
            else if (!currResult.exists)
              existance_errors.push(`Path does not exist: ${srcsTrimmed[i]}`);
          }

          if (existance_errors.length > 0) {
            resolve(existance_errors);
            return;
          }
          resolve(null);
        }).catch(fatalFail);
      }
    });
  }
}

//----------------------------------------
// ENCODERS
class Encoders {
  static all() {
    return new Promise((resolve, reject) => {
      FILESYSTEM.Execute.local('ffmpeg', ['-encoders']).then(results => {
        if (results.stderr && !results.stderr.startsWith('ffmpeg')) {
          reject({ codecs: null, error: `FFMPEG_ERROR: ${results.stderr}` });
          return;
        }

        let parts = results.stdout.split('------');

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

        let items = [];
        items.sort((a, b) => {
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

          items.push({ name: cName, string: cString });
        });
        resolve({ codecs: items, error: null });
      }).catch(fatalFail);
    });
  }

  static video() {
    return new Promise((resolve, reject) => {
      Encoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'V')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static audio() {
    return new Promise((resolve, reject) => {
      Encoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'A')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static subtitle() {
    return new Promise((resolve, reject) => {
      Encoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'S' && type.string == 'Subtitle')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static frame_level_multithreading() {
    return new Promise((resolve, reject) => {
      Encoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'F')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static slice_level_multithreading() {
    return new Promise((resolve, reject) => {
      Encoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'S' && type.string == 'Slice-level multithreading')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static experimental() {
    return new Promise((resolve, reject) => {
      Encoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'X')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static draw_horiz_band() {
    return new Promise((resolve, reject) => {
      Encoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'B')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static direct_rendering_method_1() {
    return new Promise((resolve, reject) => {
      Encoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'D')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }
}

//----------------------------------------
// DECODERS
class Decoders {
  static all() {
    return new Promise((resolve, reject) => {
      FILESYSTEM.Execute.local('ffmpeg', ['-decoders']).then(results => {
        if (results.stderr && !results.stderr.startsWith('ffmpeg')) {
          reject({ codecs: null, error: `FFMPEG_ERROR: ${results.stderr}` });
          return;
        }

        let parts = results.stdout.split('------');

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

        let items = [];
        items.sort((a, b) => {
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

          items.push({ name: cName, string: cString });
        });
        resolve({ codecs: items, error: null });
      }).catch(fatalFail);
    });
  }

  static video() {
    return new Promise((resolve, reject) => {
      Decoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'V')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static audio() {
    return new Promise((resolve, reject) => {
      Decoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'A')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static subtitle() {
    return new Promise((resolve, reject) => {
      Decoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'S' && type.string == 'Subtitle')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static frame_level_multithreading() {
    return new Promise((resolve, reject) => {
      Decoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'F')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static slice_level_multithreading() {
    return new Promise((resolve, reject) => {
      Decoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'S' && type.string == 'Slice-level multithreading')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static experimental() {
    return new Promise((resolve, reject) => {
      Decoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'X')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static draw_horiz_band() {
    return new Promise((resolve, reject) => {
      Decoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'B')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static direct_rendering_method_1() {
    return new Promise((resolve, reject) => {
      Decoders.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'D')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }
}

//----------------------------------------
// CODECS
class Codecs {
  static all() {
    return new Promise((resolve, reject) => {
      FILESYSTEM.Execute.local('ffmpeg', ['-codecs']).then(results => {
        if (results.stderr && !results.stderr.startsWith('ffmpeg')) {
          reject({ codecs: null, error: `FFMPEG_ERROR: ${results.stderr}` });
          return;
        }

        let parts = results.stdout.split('-------');

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

        let items = [];
        items.sort((a, b) => {
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
          items.push({ name: cName, string: cString, types: types });
        });
        resolve({ codecs: items, error: null });
      }).catch(fatalFail);
    });
  }

  static decoding() {
    return new Promise((resolve, reject) => {
      Codecs.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'D')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static encoding() {
    return new Promise((resolve, reject) => {
      Codecs.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'E')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static encoding_decoding() {
    return new Promise((resolve, reject) => {
      Codecs.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          if (codec.types.E != undefined && codec.types.D != undefined) {
            ret.push(codec);
          }
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static audio() {
    return new Promise((resolve, reject) => {
      Codecs.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'A')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static video() {
    return new Promise((resolve, reject) => {
      Codecs.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'V')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static subtitle() {
    return new Promise((resolve, reject) => {
      Codecs.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'S' && type.string == 'Subtitle codec')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static intra_frame_only() {
    return new Promise((resolve, reject) => {
      Codecs.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'I')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static lossy_compression() {
    return new Promise((resolve, reject) => {
      Codecs.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'L')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }

  static lossless_compression() {
    return new Promise((resolve, reject) => {
      Codecs.all().then(results => {
        if (results.error) {
          reject({ codecs: null, error: results.error });
          return;
        }

        let ret = [];
        results.codecs.forEach(codec => {
          codec.types.forEach(type => {
            if (type.char == 'S' && type.string == 'Lossless compression')
              ret.push(codec);
          });
        });
        resolve({ codecs: ret, error: results.error });
      }).catch(fatalFail);
    });
  }
}

//------------------------------------------
// FORMATS
class Formats {
  static all() {
    return new Promise((resolve, reject) => {
      FILESYSTEM.Execute.local('ffmpeg', ['-formats']).then(results => {
        if (results.stderr && !results.stderr.startsWith('ffmpeg')) {
          reject({ formats: null, error: `FFMPEG_ERROR: ${results.stderr}` });
          return;
        }

        let parts = results.stdout.split('--');

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

        let items = [];
        items.sort((a, b) => {
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

          items.push({ name: cName, string: cString });
        });
        resolve({ formats: items, error: null });
      }).catch(fatalFail);
    });
  }

  static inputs() {
    return new Promise((resolve, reject) => {
      Formats.all().then(results => {
        if (results.error) {
          reject({ inputs: null, error: results.error });
          return;
        }
        resolve({ inputs: results.formats.filter(f => f.char == 'D'), error: null });
      }).catch(fatalFail);
    });
  }

  static outputs() {
    return new Promise((resolve, reject) => {
      Formats.all().then(results => {
        if (results.error) {
          reject({ inputs: null, error: results.error });
          return;
        }
        resolve({ inputs: results.formats.filter(f => f.char == 'E'), error: null });
      }).catch(fatalFail);
    });
  }
}

//----------------------------------------
// CONVERT
class Convert {
  static convert(src, dest) {
    return new Promise((resolve, reject) => {
      let error = FILESYSTEM.Path.error(src);
      if (error) {
        reject({ success: false, error: `SRC_ERROR: ${error}` });
        return;
      }

      error = FILESYSTEM.Path.error(dest);
      if (error) {
        reject({ success: false, error: `DEST_ERROR: ${error}` });
        return;
      }

      let sTrimmed = src.trim();
      FILESYSTEM.Path.exists(sTrimmed).then(results => {
        if (results.error) {
          reject({ success: false, error: `SRC_ERROR: ${results.error}` });
          return;
        }

        if (!results.exists) {
          reject({ success: false, error: `SRC_ERROR: Path does not exist: ${sTrimmed}` });
          return;
        }

        let args = ['-i', sTrimmed, dest.trim()];
        FILESYSTEM.Execute.local('ffmpeg', args).then(values => {
          if (values.stderr) {
            reject({ success: false, error: `FFMPEG_ERROR: ${values.stderr}` });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }
}

//----------------------------------------
// DURATION

class Duration {
  static seconds(src) {
    return new Promise((resolve, reject) => {
      FFPROBE.duration_in_seconds(src.trim()).then(results => {
        if (results.error) {
          reject({ seconds: null, error: results.error });
          return;
        }
        resolve({ seconds: results.seconds, error: null });
      }).catch(fatalFail);
    });
  }

  static string(src) {
    return new Promise((resolve, reject) => {
      FFPROBE.duration_string(src.trim()).then(results => {
        if (results.error) {
          reject({ seconds: null, error: results.error });
          return;
        }
        resolve({ seconds: results.seconds, error: null });
      }).catch(fatalFail);
    });
  }

  static units(src) {
    return new Promise((resolve, reject) => {
      FFPROBE.duration_time_units(src.trim()).then(results => {
        if (results.error) {
          reject({ units: null, error: results.error });
          return;
        }
        resolve({ units: results.units, error: null });
      }).catch(fatalFail);
    });
  }
}

//----------------------------------------
// AUDIO
class Audio {
  static supported_formats() {
    return new Promise((resolve, reject) => {
      Codecs.audio().then(results => {
        if (results.error) {
          reject({ formats: null, error: results.error });
          return;
        }
        resolve({ formats: results.formats, error: null });
      }).catch(fatalFail);
    });
  }

  static trim(src, start, end, dest) {
    return new Promise((resolve, reject) => {
      let error = FILESYSTEM.Path.error(src);
      if (error) {
        reject({ success: false, error: `SRC_ERROR: ${error}` });
        return;
      }

      error = FILESYSTEM.Path.error(dest);
      if (error) {
        reject({ success: false, error: `DEST_ERROR: ${error}` });
        return;
      }

      error = Time.error(start);
      if (error) {
        reject({ success: false, error: `START_TIME_ERROR: ${error}` });
        return;
      }

      let startTrimmed = start.trim();
      error = Time.string_validation(startTrimmed);
      if (error) {
        reject({ success: false, error: `START_TIME_ERROR: ${error}` });
        return;
      }

      error = Time.error(end);
      if (error) {
        reject({ success: false, error: `END_TIME_ERROR: ${error}` });
        return;
      }

      let endTrimmed = end.trim();
      error = Time.string_validation(endTrimmed);
      if (error) {
        reject({ success: false, error: `END_TIME_ERROR: ${error}` });
        return;
      }

      let sTrimmed = src.trim();
      FILESYSTEM.Path.exists(sTrimmed).then(results => {
        if (results.error) {
          reject({ success: false, error: `SRC_ERROR: ${results.error}` });
          return;
        }

        if (!results.exists) {
          reject({ success: false, error: `SRC_ERROR: Path does not exist: ${sTrimmed}` });
          return;
        }

        FFPROBE.codec_types(sTrimmed).then(results => {
          if (results.error) {
            reject({ success: false, error: results.error });
            return;
          }

          if (results.types.length == 1 && results.types.includes('audio')) {
            let args = ['-i', sTrimmed, '-ss', startTrimmed, '-to', endTrimmed, '-c', 'copy', dest.trim()];
            FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
              if (results.stderr) {
                reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
                return;
              }
              resolve({ success: true, error: null });
            }).catch(fatalFail);
            return;
          }
          reject({ success: false, error: `SRC_ERROR: Source is not an audio file: ${sTrimmed}` });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }


  static concat(sources, dest) {  // audio files only
    return new Promise((resolve, reject) => {
      Source.list_errors(sources).then(errors => {
        if (errors) {
          reject({ success: false, error: `SOURCES_ERROR:\n${errors.join('\n')}` });
          return;
        }

        error = FILESYSTEM.Path.error(dest);
        if (error) {
          reject({ success: false, error: `DEST_ERROR: ${error}` });
          return;
        }

        let destTrimmed = dest.trim();
        let srcsTrimmed = sources.map(src => src.trim());

        // Create file with all video paths
        let currDir = FILESYSTEM.Path.parent_dir(destTrimmed);
        let tempFilepath = path.join(currDir, 'audio_input_list.txt');

        let lines = [];
        srcsTrimmed.forEach(s => lines.push(`file '${s}'`));

        FILESYSTEM.File.create(tempFilepath, lines.join('\n')).then(results => {
          if (results.error) {
            reject({ success: false, error: `INPUT_FILE_ERROR: ${results.error}` });
            return;
          }

          // Build & run command
          let args = ['-f', 'concat', '-safe', 0, '-i', tempFilepath, '-acodec', 'copy', destTrimmed];
          FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
            if (results.stderr) {
              reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
              return;
            }
            resolve({ success: true, error: null });

            // clean up temp file
            FILESYSTEM.Remove.file(tempFilepath).then(values => { }).catch(fatalFail);
          }).catch(fatalFail);
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static overlay(sources, dest) {
    return new Promise((resolve, reject) => {
      Source.list_errors(sources).then(errors => {
        if (errors) {
          reject({ success: false, error: `SOURCES_ERROR:\n${errors.join('\n')}` });
          return;
        }

        let error = FILESYSTEM.Path.error(dest);
        if (error) {
          reject({ success: false, error: `DEST_ERROR: ${error}` });
          return;
        }

        let destTrimmed = dest.trim();
        let srcsTrimmed = sources.map(src => src.trim());

        // Create file with all video paths
        let currDir = FILESYSTEM.Path.parent_dir(destTrimmed);
        let tempFilepath = path.join(currDir, 'audio_input_list.txt');

        let lines = [];
        srcsTrimmed.forEach(s => lines.push(`file '${s}'`));

        FILESYSTEM.File.create(tempFilepath, lines.join('\n')).then(results => {
          if (results.error) {
            reject({ success: false, error: `INPUT_FILE_ERROR: ${results.error}` });
            return;
          }

          // Build & run command
          let args = ['-f', 'concat', '-safe', 0, '-i', tempFilepath, '-filter_complex', 'amerge', '-ac', 2, '-c:a', 'libmp3lame', '-q:a', 4, destTrimmed];
          FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
            if (results.stderr) {
              reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
              return;
            }
            resolve({ success: true, error: null });

            // clean up temp file
            FILESYSTEM.Remove.file(tempFilepath).then(values => { }).catch(fatalFail);
          }).catch(fatalFail);
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static change_speed(src, speed, dest) {  // 0.5 (slower) < speed < 2.0 (faster)
    return new Promise((resolve, reject) => {
      let error = Source.error(src);
      if (error) {
        reject({ success: false, error: `SRC_ERROR: ${error}` });
        return;
      }

      error = FILESYSTEM.Path.error(dest);
      if (error) {
        reject({ success: false, error: `DEST_ERROR: ${error}` });
        return;
      }

      if (isNaN(speed)) {
        reject({ success: false, error: 'SPEED_ERROR: Speed is not a number' });
        return;
      }

      let boundSpeed = 0;
      if (speed < 0.5)
        boundSpeed = 0.5;
      else if (speed > 2.0)
        boundSpeed = 2.0;
      else
        boundSpeed = speed;

      let args = ['-i', src.trim(), '-filter:a', `"atempo=${boundSpeed}"`, '-vn', dest.trim()];
      FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
        if (results.stderr) {
          reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
          return;
        }
        resolve({ success: true, error: null });
      }).catch(fatalFail);
    });
  }
}

//----------------------------------------
// VIDEO

class Video {
  static supported_formats() {
    return new Promise((resolve, reject) => {
      Codecs.video().then(results => {
        if (results.error) {
          reject({ formats: null, error: results.error });
          return;
        }
        resolve({ formats: results.formats, error: null });
      }).catch(fatalFail);
    });
  }

  static estimated_frames(src, fps) {  // fps = frames per second
    return new Promise((resolve, reject) => {
      let error = Source.error(src);
      if (error) {
        reject({ count: null, error: `SRC_ERROR: ${error}` });
        return;
      }

      if (isNaN(fps)) {
        reject({ success: false, error: 'FPS_ERROR: Fps is not a number' });
        return;
      }

      let sTrimmed = src.trim();
      FILESYSTEM.Path.exists(sTrimmed).then(results => {
        if (results.error) {
          reject({ count: null, error: `SRC_ERROR: ${results.error}` });
          return;
        }

        if (!results.exists) {
          reject({ count: null, error: `SRC_ERROR: Source does not exist: ${sTrimmed}` });
          return;
        }

        Duration.seconds(sTrimmed).then(values => {
          if (values.error) {
            reject({ count: null, error: values.error });
            return;
          }
          resolve({ count: Math.floor(values.seconds * fps), error: null });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static trim(src, start, end, dest) {
    return new Promise((resolve, reject) => {
      let error = Source.error(src);
      if (error) {
        reject({ success: false, error: `SRC_ERROR: ${error}` });
        return;
      }

      error = FILESYSTEM.Path.error(dest);
      if (error) {
        reject({ success: false, error: `DEST_ERROR: ${error}` });
        return;
      }

      error = Time.error(start);
      if (error) {
        reject({ success: false, error: `START_TIME_ERROR: ${error}` });
        return;
      }

      let startTrimmed = start.trim();
      error = Time.string_validation(startTrimmed);
      if (error) {
        reject({ success: false, error: `START_TIME_ERROR: ${error}` });
        return;
      }

      error = Time.error(end);
      if (error) {
        reject({ success: false, error: `END_TIME_ERROR: ${error}` });
        return;
      }

      let endTrimmed = end.trim();
      error = Time.string_validation(endTrimmed);
      if (error) {
        reject({ success: false, error: `END_TIME_ERROR: ${error}` });
        return;
      }

      let sTrimmed = src.trim();
      FILESYSTEM.Path.exists(sTrimmed).then(results => {
        if (results.error) {
          reject({ count: null, error: `SRC_ERROR: ${results.error}` });
          return;
        }

        if (!results.exists) {
          reject({ count: null, error: `SRC_ERROR: Source does not exist: ${sTrimmed}` });
          return;
        }

        let args = ['-ss', startTrimmed, '-i', sTrimmed, '-to', endTrimmed, '-c', 'copy', dest.trim()];
        FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
          if (results.stderr) {
            reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static concat(sources, dest) { // videos only! no re-encoding
    return new Promise((resolve, reject) => {
      Source.list_errors(sources).then(errors => {
        if (errors) {
          reject({ success: false, error: `SOURCES_ERROR:\n${errors.join('\n')}` });
          return;
        }

        let error = FILESYSTEM.Path.error(dest);
        if (error) {
          reject({ success: false, error: `DEST_ERROR: ${error}` });
          return;
        }

        let srcsTrimmed = sources.map(src => src.trim());
        let args = ['-i', `'concat:${srcsTrimmed.join('|')}'`, '-codec', 'copy', dest.trim()];
        FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
          if (results.stderr) {
            reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);

      }).catch(fatalFail);
    });
  }

  static concat_no_audio(sources, dest) {  // will re-encode
    return new Promise((resolve, reject) => {
      Source.list_errors(sources).then(errors => {
        if (errors) {
          reject({ success: false, error: `SOURCES_ERROR:\n${errors.join('\n')}` });
          return;
        }

        let error = FILESYSTEM.Path.error(dest);
        if (error) {
          reject({ success: false, error: `DEST_ERROR: ${error}` });
          return;
        }

        let srcsTrimmed = sources.map(src => src.trim());
        let args = [];

        // Source args
        srcsTrimmed.forEach(src => args.push('-i', src));

        // Filter args (audio/ video stream args)
        args.push('-filter_complex');

        let filterStr = "'";
        for (let i = 0; i < sources.length; ++i) {
          if (i > 0)
            filterStr += ' ';
          filterStr += `[${i}:v:0]`;
        }

        // Concat & map string
        filterStr += ` concat=n=${sources.length}:v=1 [v]'`;
        args.push(filterStr);
        args.push('-map', "'[v]'", dest.trim());

        FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
          if (results.stderr) {
            reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static concat_reencode(sources, dest) {
    return new Promise((resolve, reject) => {
      Source.list_errors(sources).then(errors => {
        if (errors) {
          reject({ success: false, error: `SOURCES_ERROR:\n${errors.join('\n')}` });
          return;
        }

        let error = FILESYSTEM.Path.error(dest);
        if (error) {
          reject({ success: false, error: `DEST_ERROR: ${error}` });
          return;
        }

        let srcsTrimmed = sources.map(src => src.trim());
        let args = [];

        // Source args
        srcsTrimmed.forEach(src => args.push('-i', src));

        // Filter args (audio/ video stream args)
        args.push('-filter_complex');

        let filterStr = "'";
        for (let i = 0; i < sources.length; ++i) {
          if (i > 0)
            filterStr += ' ';

          let audioFilter = `[${i}:a:0]`;
          let videoFilter = `[${i}:v:0]`;
          filterStr += `${audioFilter} ${videoFilter}`;
        }

        // Concat & map string
        filterStr += ` concat=n=${sources.length}:v=1:a=1 [v] [a]'`;
        args.push(filterStr);
        args.push('-map', "'[v]'", '-map', "'[a]'", dest.trim());

        FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
          if (results.stderr) {
            reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static concat_demuxer(sources, dest) {
    return new Promise((resolve, reject) => {
      // Create file with all video paths
      Source.list_errors(sources).then(errors => {
        if (errors) {
          reject({ success: false, error: `SOURCES_ERRORS:\n${errors.join('\n')}` });
          return;
        }

        let error = FILESYSTEM.Path.error(dest);
        if (error) {
          reject({ success: false, error: `DEST_ERROR: ${error}` });
          return;
        }

        let destTrimmed = dest.trim();
        let srcsTrimmed = sources.map(src => src.trim());

        let currDir = FILESYSTEM.Path.parent_dir(destTrimmed);
        let tempFilepath = path.join(currDir, 'video_input_list.txt');

        let lines = [];
        srcsTrimmed.forEach(s => lines.push(`file '${s}'`));

        FILESYSTEM.File.create(tempFilepath, lines.join('\n')).then(results => {
          if (results.error) {
            reject({ success: false, error: `INPUT_FILE_ERROR: ${results.error}` });
            return;
          }

          // Build & run command
          let args = ['-f', 'concat', '-i', tempFilepath, '-c', 'copy', destTrimmed];
          FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
            if (results.stderr) {
              reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
              return;
            }
            resolve({ success: true, error: null });

            // clean up temp file
            FILESYSTEM.Remove.file(tempFilepath).then(values => { }).catch(fatalFail);
          }).catch(fatalFail);
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static add_audio(videoSrc, audioSrc, dest) {
    return new Promise((resolve, reject) => {
      let error = Source.error(videoSrc);
      if (error) {
        reject({ success: false, error: `VIDEO_SRC_ERROR: ${error}` });
        return;
      }

      error = Source.error(audioSrc);
      if (error) {
        reject({ success: false, error: `AUDIO_SRC_ERROR: ${error}` });
        return;
      }

      error = FILESYSTEM.Path.error(dest);
      if (error) {
        reject({ success: false, error: `DEST_ERROR: ${error}` });
        return;
      }

      let vTrimmed = videoSrc.trim();
      let aTrimmed = audioSrc.trim();

      FILESYSTEM.Path.exists(vTrimmed).then(results => {
        if (results.error) {
          reject({ success: false, error: `VIDEO_SRC_ERROR: ${results.error}` });
          return;
        }

        if (!results.exists) {
          reject({ success: false, error: `VIDEO_SRC_ERROR: Video source does not exist: ${vTrimmed}` });
          return;
        }

        FILESYSTEM.Path.exists(aTrimmed).then(values => {
          if (values.error) {
            reject({ success: false, error: `AUDIO_SRC_ERROR: ${results.error}` });
            return;
          }

          if (!values.exists) {
            reject({ success: false, error: `AUDIO_SRC_ERROR: Audio source does not exist: ${aTrimmed}` });
            return;
          }

          let args = ['-i', vTrimmed, '-i', aTrimmed, '-codec', 'copy', '-shortest', dest.trim()];
          FILESYSTEM.Execute.local('ffmpeg', args).then(output => {
            if (output.stderr) {
              reject({ success: false, error: `FFMPEG_ERROR: ${output.stderr}` });
              return;
            }
            resolve({ success: true, error: null });
          }).catch(fatalFail)
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static replace_audio(videoSrc, audioSrc, dest) {
    return new Promise((resolve, reject) => {
      let error = Source.error(videoSrc);
      if (error) {
        reject({ success: false, error: `VIDEO_SRC_ERROR: ${error}` });
        return;
      }

      error = Source.error(audioSrc);
      if (error) {
        reject({ success: false, error: `AUDIO_SRC_ERROR: ${error}` });
        return;
      }

      error = FILESYSTEM.Path.error(dest);
      if (error) {
        reject({ success: false, error: `DEST_ERROR: ${error}` });
        return;
      }

      let vTrimmed = videoSrc.trim();
      let aTrimmed = audioSrc.trim();

      FILESYSTEM.Path.exists(vTrimmed).then(results => {
        if (results.error) {
          reject({ success: false, error: `VIDEO_SRC_ERROR: ${results.error}` });
          return;
        }

        if (!results.exists) {
          reject({ success: false, error: `VIDEO_SRC_ERROR: Video source does not exist: ${vTrimmed}` });
          return;
        }

        FILESYSTEM.Path.exists(aTrimmed).then(values => {
          if (values.error) {
            reject({ success: false, error: `AUDIO_SRC_ERROR: ${results.error}` });
            return;
          }

          if (!values.exists) {
            reject({ success: false, error: `AUDIO_SRC_ERROR: Audio source does not exist: ${aTrimmed}` });
            return;
          }

          let args = ['-i', vTrimmed, '-i', aTrimmed, '-c:v', 'copy', '-map', '0:v:0', '-map', '1:a:0', '-shortest', dest.trim()];
          FILESYSTEM.Execute.local('ffmpeg', args).then(output => {
            if (output.stderr) {
              reject({ success: false, error: `FFMPEG_ERROR: ${output.stderr}` });
              return;
            }
            resolve({ success: true, error: null });
          }).catch(fatalFail)
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static create(fps, imgSeqFormatStr, audioPaths, dest) {
    return new Promise((resolve, reject) => {
      Source.list_errors(audioPaths).then(errors => {
        if (errors) {
          reject({ success: false, error: `AUDIO_PATHS_ERROR: ${errors.join('\n')}` });
          return;
        }

        let error = FILESYSTEM.Path.error(dest);
        if (error) {
          reject({ success: false, error: `DEST_ERROR: ${error}` });
          return;
        }

        if (isNaN(fps)) {
          reject({ success: false, error: 'FPS_ERROR: Fps is not a number' });
          return;
        }

        let apathsTrimmed = audioPaths.map(a => a.trim());
        let destTrimmed = dest.trim();

        if (apathsTrimmed.length == 1) {
          let args = ['-r', fps, '-i', imgSeqFormatStr, '-i', apathsTrimmed[0], '-vcodec', 'libx264', -'shortest', '-y', destTrimmed];
          FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
            if (results.stderr) {
              reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
              return;
            }
            resolve({ success: true, error: null });
          }).catch(fatalFail);
        }
        else if (apathsTrimmed.length > 1) {
          let currDir = FILESYSTEM.Path.parent_dir(destTrimmed);
          let tempFilepath = PATH.join(currDir, 'video_input_list.txt');

          let lines = [];
          apathsTrimmed.forEach(path => lines.push(`file '${path}'`));

          FILESYSTEM.File.create(tempFilepath, lines.join('\n')).then(values => {
            if (values.stderr) {
              resolve({ success: false, error: `INPUT_FILE_ERROR: ${values.stderr}` });
              return;
            }

            let args = ['-r', fps, '-i', imgSeqFormatStr, '-f', 'concat', '-safe', 0, '-i', tempFilepath, '-vcodec', 'libx264', '-r', fps, '-shortest', '-y', destTrimmed];
            FILESYSTEM.Execute.local('ffmpeg', args).then(output => {
              if (output.stderr) {
                reject({ success: false, error: `FFMPEG_ERROR: ${output.stderr}` });
                return;
              }
              resolve({ success: true, error: null });
            }).catch(fatalFail);
          }).catch(fatalFail);
        }
        else {
          let args = ['-r', fps, '-i', imgSeqFormatStr, '-vcodec', 'libx264', '-r', fps, '-y', destTrimmed];
          FILESYSTEM.Execute.local('ffmpeg', args).then(results => {
            if (results.stderr) {
              reject({ success: false, error: `FFMPEG_ERROR: ${results.stderr}` });
              return;
            }
            resolve({ success: true, error: null });
          }).catch(fatalFail);
        }
      }).catch(fatalFail);
    });
  }

  static extract_audio(src, dest) {
    return Convert.convert(src, dest);
  }

  static extract_video(src, dest) {
    return new Promise((resolve, reject) => {
      let error = Source.error(src);
      if (error) {
        reject({ sucess: false, error: `SRC_ERROR: ${error}` });
        return;
      }

      error = FILESYSTEM.Path.error(dest);
      if (error) {
        reject({ sucess: false, error: `DEST_ERROR: ${error}` });
        return;
      }

      let sTrimmed = src.trim();
      let dTrimmed = dest.trim();

      FILESYSTEM.Path.exists(sTrimmed).then(results => {
        if (results.error) {
          reject({ success: false, error: `SRC_ERROR: ${error}` });
          return;
        }

        if (!results.exists) {
          reject({ success: false, error: `SRC_ERROR: Source does not exist: ${sTrimmed}` });
          return;
        }

        let args = ['-i', sTrimmed, '-c', 'copy', '-an', dTrimmed];
        FILESYSTEM.Execute.local('ffmpeg', args).then(values => {
          if (values.stderr) {
            reject({ success: false, error: `FFMPEG_ERROR: ${values.stderr}` });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);
      });
    });
  }

  static extract_images(src, destFormatStr, frameStartNumber, fps) {
    return new Promise((resolve, reject) => {
      let error = Source.error(src);
      if (error) {
        reject({ success: false, error: `SRC_ERROR: ${error}` });
        return;
      }

      if (isNaN(frameStartNumber)) {
        reject({ success: false, error: 'FRAME_START_NUMBER_ERROR: Frame start number is not a number' });
        return;
      }

      let sTrimmed = src.trim();
      FILESYSTEM.Path.exists(sTrimmed).then(results => {
        if (results.error) {
          reject({ success: false, error: `SRC_ERROR: ${results.error}` });
          return;
        }

        if (!results.exists) {
          reject({ success: false, error: `SRC_ERROR: Source does not exist: ${results.error}` });
          return;
        }

        let args = ['-i', sTrimmed];
        if (frameStartNumber)
          args.push('-start_number', frameStartNumber);
        args.push('-vf', `fps=${fps}`, dTrimmed);

        FILESYSTEM.Execute.local('ffmpeg', args).then(values => {
          if (values.stderr) {
            reject({ success: false, error: `FFMPEG_ERROR: ${values.stderr}` });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static change_speed(src, speed, avoidDroppingFrames, dest) {
    return new Promise((resolve, reject) => {
      // SLOW: speed > 1
      // FAST: 0 < speed <= 1

      let error = Source.error(src);
      if (error) {
        reject({ success: false, error: `SRC_ERROR: ${error}` });
        return;
      }

      error = FILESYSTEM.Path.error(dest);
      if (error) {
        reject({ success: false, error: `DEST_ERROR: ${error}` });
        return;
      }

      if (isNaN(speed)) {
        reject({ success: false, error: 'SPEED_ERROR: Speed is not a number' });
        return;
      }

      let sTrimmed = src.trim();
      let speedInverse = 1 / speed;

      FILESYSTEM.Path.exists(sTrimmed).then(results => {
        if (results.error) {
          reject({ success: false, error: `SRC_ERROR: ${error}` });
          return;
        }

        if (!results.exists) {
          reject({ success: false, error: `SRC_ERROR: Source does not exist: ${sTrimmed}` });
          return;
        }

        let args = ['-i', sTrimmed];
        if (avoidDroppingFrames)
          args.push('-r', speedInverse);
        args.push('-filter:v' `"setpts=${speed}*PTS"`, dest.trim());

        FILESYSTEM.Execute.local('ffmpeg', args).then(output => {
          if (output.stderr) {
            reject({ success: false, error: `FFMPEG_ERROR: ${output.stderr}` });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });

  }

  static smooth_out(src, dest) {
    return new Promise((resolve, reject) => {
      let error = Source.error(src);
      if (error) {
        reject({ success: false, error: `SRC_ERROR: ${error}` });
        return;
      }

      error = FILESYSTEM.Path.error(dest);
      if (error) {
        reject({ success: false, error: `DEST_ERROR: ${error}` });
        return;
      }

      let sTrimmed = src.trim();

      FILESYSTEM.Path.exists(sTrimmed).then(results => {
        if (results.error) {
          reject({ success: false, error: `SRC_ERROR: ${error}` });
          return;
        }

        if (!results.exists) {
          reject({ success: false, error: `SRC_ERROR: Source does not exist: ${sTrimmed}` });
          return;
        }

        let args = ['-i', sTrimmed, '-filter', `"minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120'"`, dest.trim()];
        FILESYSTEM.Execute.local('ffmpeg', args).then(output => {
          if (output.stderr) {
            reject({ success: false, error: `FFMPEG_ERROR: ${output.stderr}` });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }
}

//-----------------------------------
// EXPORTS

exports.Encoders = Encoders;
exports.Decoders = Decoders;
exports.Codecs = Codecs;
exports.Formats = Formats;
exports.Convert = Convert;
exports.Audio = Audio;
exports.Video = Video;

//-------------------------------------
// TEST

formats().then(results => {
  console.log(`FORMATS:\n\n${JSON.stringify(results.formats)}`);
});