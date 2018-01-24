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
}

//----------------------------------------
// AUDIO

class Audio {
  static supported_formats() {
    return new Promise(resolve => {

    });
  }

  static duration(src) {  // in seconds
    let cmd = 'ffprobe';
    let argStr = '-i ' + filepath + ' -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -sexagesimal';
    let args = argsStr.split(' ');
    let output = execute(cmd, args);

    if (output.stdout.trim()) {
      let parts = out.stdout.trim().split(':');

      let hours = parseInt(parts[0]);
      let minutes = parseInt(parts[1]);

      let secondsParts = parts[2].split('.');
      let seconds = parseInt(secondsParts[0]);
      //let microseconds = parseInt(secondsParts[1]);

      return (hours * 3600) + (minutes * 60) + (seconds);
    }
    return null;
  }

  static convert(src, dest) {
    // TO DO
  }

  static trim(src, start, end, dest) {
    // TO DO
  }

  static merge() {  // rename to "MERGE"
    // TO DO
  }

  static overlap() {
    // TO DO
  }
}

//----------------------------------------
// VIDEO

class Video {
  static supported_formats() {
    // TO DO
  }

  static duration(src) {  // in seconds
    // TO DO
  }

  static estimated_frames(src, fps) {  // fps = frames per second
    // TO DO
  }

  static convert(src, dest) {
    // TO DO
  }

  static trim(src, start, end, dest) {
    // TO DO
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
    // TO DO
  }

  static extract_video(src, dest) {
    // TO DO
  }

  static extract_images(src, destFormatStr, frameStartNumber, fps) {
    // TO DO
  }

  static change_speed(src, speed, avoidDroppingFrames, dest) {
    // TO DO
  }

  static smooth_out(src, dest) {
    // TO DO
  }
}

//-----------------------------------
// EXPORTS

exports.Codecs = Codecs;
exports.Formats = Formats;
exports.Info = Info;
exports.Audio = Audio;
exports.Video = Video;

//-------------------------------------
// TEST

formats().then(results => {
  console.log(`FORMATS:\n\n${JSON.stringify(results.formats)}`);
});