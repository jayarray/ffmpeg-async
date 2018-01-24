let PATH = require('path');
let CHILD_PROCESS = require('child_process');

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

//------------------------------------
// FUNCTIONS

function codec_types(src) { // returns audio, video, or both
  return new Promise(resolve => {
    let args = `-v error -show_entries stream=codec_type -of default=nw=1 ${src}`.split(' '); // If fails, put double-quotes around src
    execute('ffprobe', args).then(results => {
      if (results.stderr) {
        resolve({ types: null, error: results.stderr });
        return;
      }

      let types = [];

      let lines = results.stdout;
      lines.forEach(line => {
        if (line.includes('audio'))
          types.push('audio');
        else if (line.includes('video'))
          types.push('video');
      });
      resolve({ types: types, error: null });
    }).catch(fatalFail);
  });
}

function is_video(src) {
  return new Promise(resolve => {
    codec_types(src).then(results => {
      if (results.error) {
        resolve({ isVideo: null, error: results.error });
        return;
      }
      resolve({ isVideo: results.types.includes('video'), error: results.error });
    }).catch(fatalFail);
  });
}

function is_audio(src) {
  return new Promise(resolve => {
    codec_types(src).then(results => {
      if (results.error) {
        resolve({ isVideo: null, error: results.error });
        return;
      }
      resolve({
        isAudio: results.types.includes('audio') && !results.types.includes('video'),
        error: results.error
      });
    }).catch(fatalFail);
  });
}

function duration_string(src) {
  return new Promise(resolve => {
    let args = `-i ${src} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -sexagesimal`.split(' ');
    execute('ffprobe', args).then(results => {
      if (results.stderr) {
        resolve({ seconds: null, error: results.stderr });
        return;
      }
      resolve({ string: results.stdout.trim(), error: null });
    }).catch(fatalFail);
  });
}

function duration_in_seconds(src) {  // in seconds
  return new Promise(resolve => {
    duration_string(src).then(results => {
      if (results.error) {
        resolve({ seconds: null, error: results.error });
        return;
      }

      if (results.string.trim() && results.string.split(':').length == 3) {
        let parts = results.stdout.trim().split(':');
        let hours = parseInt(parts[0]);
        let minutes = parseInt(parts[1]);
        let secondsParts = parts[2].split('.');
        let seconds = parseInt(secondsParts[0]);
        resolve({ seconds: (hours * 3600) + (minutes * 60) + (seconds), error: null });
        return;
      }
      resolve({ seconds: null, error: null }); // No string returned
    }).catch(fatalFail);
  });
}

function info(src) {
  return new Promise(resolve => {
    let args = `-v quiet -print_format json -show_format -show_streams ${src}`.split(' '); // If fails, put double-quotes around src
    execute('ffprobe', args).then(results => {
      if (results.stderr) {
        resolve({ info: null, error: results.stderr });
        return;
      }
      resolve({ info: JSON.parse(results.stdout), error: null }); // returns { "streams": {...}, "formats": {...} }
    }).catch(fatalFail);
  });
}


//------------------------------------
// EXPORTS

exports.codec_types = codec_types;
exports.is_video = is_video;
exports.is_audio = is_audio;
exports.duration_string = duration_string;
exports.duration_in_seconds = duration_in_seconds;
exports.info = info;