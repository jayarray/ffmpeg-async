
let FILESYSTEM = require('./filesystem-async.js');
let FFPROBE = require('./ffprobe.js');
var PATH = require('path');
var CHILD_PROCESS = require('child_process');

//-----------------------------------
// ERROR CATCHING

function fatalFail(error) {
  console.log(error);
  process.exit(-1);
}

//-----------------------------------
// SAVING DATA (to string)

class SavedData {
  constructor(thing) {
    this.value = '';
    thing.on('data', this.callback_.bind(this));
  }

  callback_(data) {
    this.value += data.toString();
  }
}

//-----------------------------------
// EXECUTE

function execute(cmd, args) {
  let childProcess = CHILD_PROCESS.spawn(cmd, args);
  let errors = new SavedData(childProcess.stderr);
  let outputs = new SavedData(childProcess.stdout);

  return new Promise(resolve => {
    childProcess.on('close', exitCode => {
      resolve({
        stderr: errors.value,
        stdout: outputs.value,
        exitCode: exitCode
      });
    });
  });
}

//----------------------------------------
// ENCODERS
class Encoders {
  static all() {
    return new Promise(resolve => {
      execute('ffmpeg', ['-encoders']).then(results => {
        if (results.stderr && !results.stderr.startsWith('ffmpeg')) {
          resolve({ codecs: null, error: results.stderr });
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
    return new Promise(resolve => {
      Encoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Encoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Encoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Encoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Encoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Encoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Encoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Encoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      execute('ffmpeg', ['-decoders']).then(results => {
        if (results.stderr && !results.stderr.startsWith('ffmpeg')) {
          resolve({ codecs: null, error: results.stderr });
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
    return new Promise(resolve => {
      Decoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Decoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Decoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Decoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Decoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Decoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Decoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Decoders.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      execute('ffmpeg', ['-codecs']).then(results => {
        if (results.stderr && !results.stderr.startsWith('ffmpeg')) {
          resolve({ codecs: null, error: results.stderr });
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
    return new Promise(resolve => {
      Codecs.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Codecs.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Codecs.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Codecs.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Codecs.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Codecs.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Codecs.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Codecs.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      Codecs.all().then(results => {
        if (results.error) {
          resolve({ codecs: null, error: results.error });
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
    return new Promise(resolve => {
      execute('ffmpeg', ['-formats']).then(results => {
        if (results.stderr && !results.stderr.startsWith('ffmpeg')) {
          resolve({ formats: null, error: results.stderr });
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
    return new Promise(resolve => {
      Formats.all().then(results => {
        if (results.error) {
          resolve({ inputs: null, error: results.error });
          return;
        }
        resolve({ inputs: results.formats.filter(f => f.char == 'D'), error: null });
      }).catch(fatalFail);
    });
  }

  static outputs() {
    return new Promise(resolve => {
      Formats.all().then(results => {
        if (results.error) {
          resolve({ inputs: null, error: results.error });
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
    let args = `-i ${src} ${dest}`.split(' ');
    execute('ffmpeg', args).then(result => {
      if (results.stderr) {
        resolve({ success: false, error: results.stderr });
        return;
      }
      resolve({ success: true, error: null });
    }).catch(fatalFail);
  }
}

//----------------------------------------
// DURATION

class Duration {
  static seconds(src) {
    return FFPROBE.duration_in_seconds(src);
  }

  static string(src) {
    return FFPROBE.duration_string(src);
  }
}

//----------------------------------------
// AUDIO

class Audio {
  static supported_formats() {
    return new Promise(resolve => {
      Codecs.audio().then(results => {
        if (results.error) {
          resolve({ formats: null, error: results.error });
          return;
        }
        resolve({ formats: results.formats, error: null });
      }).catch(fatalFail);
    });
  }

  static trim(src, start, end, dest) {
    return new Promise(resolve => {
      let args = `-i ${src} -ss ${start} -to ${end} -c copy ${dest}`.split(' ');
      execute('ffmpeg', args).then(results => {
        if (results.stderr) {
          resolve({ success: false, error: results.stderr });
          return;
        }
        resolve({ success: true, error: null });
      }).catch(fatalFail);
    });
  }

  static merge(sources, dest) {  // audio files only
    return new Promise(resolve => {
      // Create file with all video paths
      let currDir = FILESYSTEM.Path.parent_dir(dest);
      let tempFilepath = path.join(currDir, 'audio_input_list.txt');

      let lines = [];
      audioPaths.forEach(p => lines.push("file " + "'" + p + "'"));

      FILESYSTEM.File.create(tempFilepath, lines.join('\n')).then(results => {
        if (results.error) {
          resolve({ success: false, error: results.error });
          return;
        }

        // Build & run command
        let args = `-f concat -safe 0 -i ${tempFilepath} -acodec copy ${dest}`.split(' ');
        execute('ffmpeg', args).then(results => {
          if (results.stderr) {
            resolve({ success: false, error: results.stderr });
            return;
          }
          resolve({ success: true, error: null });

          // clean up temp file
          FILESYSTEM.Remove.file(tempFilepath).then(values => { }).catch(fatalFail);
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }

  static overlay(sources, dest) {
    return new Promise(resolve => {
      // Create file with all video paths
      let currDir = FILESYSTEM.Path.parent_dir(dest);
      let tempFilepath = path.join(currDir, 'audio_input_list.txt');

      let lines = [];
      audioPaths.forEach(p => lines.push("file " + "'" + p + "'"));

      FILESYSTEM.File.create(tempFilepath, lines.join('\n')).then(results => {
        if (results.error) {
          resolve({ success: false, error: results.error });
          return;
        }

        // Build & run command
        let args = `-f concat -safe 0 -i ${tempFilepath} -filter_complex amerge -ac 2 -c:a libmp3lame -q:a 4 ${dest}`.split(' ');
        execute('ffmpeg', args).then(results => {
          if (results.stderr) {
            resolve({ success: false, error: results.stderr });
            return;
          }
          resolve({ success: true, error: null });

          // clean up temp file
          FILESYSTEM.Remove.file(tempFilepath).then(values => { }).catch(fatalFail);
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }
}

//----------------------------------------
// VIDEO

class Video {
  static supported_formats() {
    return new Promise(resolve => {
      Codecs.video().then(results => {
        if (results.error) {
          resolve({ formats: null, error: results.error });
          return;
        }
        resolve({ formats: results.formats, error: null });
      }).catch(fatalFail);
    });
  }

  static estimated_frames(src, fps) {  // fps = frames per second
    return new Promise(resolve => {
      Duration.duration(src).then(results => {
        if (results.error) {
          resolve({ count: null, error: results.error });
          return;
        }
        resolve({ count: results.seconds * fps, error: null });
      }).catch(fatalFail);
    });
  }

  static trim(src, start, end, dest) {
    return new Promise(resolve => {
      let args = `-ss ${start} -i ${src} -to ${end} -c copy ${dest}`.split(' ');
      execute('ffmpeg', args).then(results => {
        if (results.stderr) {
          resolve({ success: false, error: results.stderr });
          return;
        }
        resolve({ success: true, error: null });
      }).catch(fatalFail);
    });
  }

  static merge() {  // rename to "MERGE"
    // TO DO
  }

  static add_audio(videoSrc, audioSrc, dest) {
    // TO DO
  }

  static replace_audio(videoSrc, audioSrc, dest) {
    // TO DO
  }

  static create(fps, imgSeqFormatStr, audioPaths, dest) {
    // TO DO
  }

  static extract_audio(src, dest) {
    return Convert.convert(src, dest);
  }

  static extract_video(src, dest) {
    return new Promise(resolve => {
      let args = `-i ${src} -c copy -an ${dest}`.split(' ');
      execute('ffmpeg', args).then(results => {
        if (results.stderr) {
          resolve({ success: false, error: results.stderr });
          return;
        }
        resolve({ success: true, error: null });
      }).catch(fatalFail);
    });
  }

  static extract_images(src, destFormatStr, frameStartNumber, fps) {
    return new Promise(resolve => {
      let args = `-i ${src}`;
      if (frameStartNumber)
        args += ` -start_number ${frameStartNumber}`;
      args += ` -vf fps=${fps} ${dest}`;
      args = args.split(' ');

      execute('ffmpeg', args).then(results => {
        if (results.stderr) {
          resolve({ success: false, error: results.stderr });
          return;
        }
        resolve({ success: true, error: null });
      }).catch(fatalFail);
    });
  }

  static change_speed(src, speed, avoidDroppingFrames, dest) {
    return new Promise(resolve => {
      // SLOW: speed > 1
      // FAST: 0 < speed <= 1

      let args = `-i ${src}`;

      let speedInverse = Math.inv(speed);
      speedInverse = parseInt(speedInverse);

      if (avoidDroppingFrames) {
        args += ` -r ${speedInverse}`;
      }
      args += ` -filter:v "setpts=${speedInverse}" ${dest}`;
      args = args.split(' ');

      execute('ffmpeg', args).then(results => {
        if (result.stderr) {
          resolve({ success: false, error: results.stderr });
          return;
        }
        resolve({ success: true, error: null });
      }).catch(fatalFail);
    });

  }

  static smooth_out(src, dest) {
    return new Promise(resolve => {
      let args = `-i ${src} -filter "minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120'" ${dest}`.split(' ');
      execute('ffmpeg', args).then(results => {
        if (results.stderr) {
          resolve({ success: false, error: results.stderr });
          return;
        }
        resolve({ success: true, error: null });
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