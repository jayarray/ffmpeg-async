let LINUX = require('linux-commands-async.js');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

let DURATION = require('./duration.js');
let CODECS = require('./codecs.js');

let CONVERT = require('./convert.js');

let path = require('path');

//------------------------------------
// TIME STRING ERROR

function StringValidator(string) {
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

function SourcesValidator(sources) {
  if (sources === undefined)
    return 'sources is undefined';

  if (sources == null)
    return 'sources is null';

  if (Array.isArray(sources)) {
    let allAreStrings = true;
    for (let i = 0; i < sources.length; ++i) {
      if (typeof sources[i] != 'string') {
        allAreStrings = false; break;
      }
    }

    if (!allAreStrings)
      return 'sources contains a non-string element'
  }

  return null;
}

function TimeStringValidator(string) {
  let error = StringValidator(string);
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

//----------------------------------------
// VIDEO

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function SupportedFormats() {
  return new Promise((resolve, reject) => {
    CODECS.VideoCodecs().then(codecs => {
      resolve(codecs);
    }).catch(error => `Failed to get supported formats: ${error}`);
  });
}

/**
 * @param {string} src Source
 * @param {number} fps Frames per second
 * @returns {Promise<number>} Returns a promise. If it resolves, it returns a number. Otherwise, it returns an error.
 */
function EstimatedFrames(src, fps) {
  let error = Source.error(src);
  if (error)
    return Promise.reject({ count: null, error: `SRC_ERROR: ${error}` });

  if (isNaN(fps))
    return Promise.reject({ success: false, error: 'FPS_ERROR: Fps is not a number' });

  return new Promise((resolve, reject) => {
    DURATION.InSeconds(src).then(seconds => {
      resolve(Math.floor(seconds * fps));
    }).catch(error => `Failed to get estimated frames: ${error}`);
  });
}

/**
 * @param {string} src Source
 * @param {string} start Start time string
 * @param {string} end End time string
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Trim(src, start, end, dest) {
  let error = StringValidator(src);
  if (error)
    return Promise.reject(`Failed to trim video: source is ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to trim video: destination is ${error}`);

  error = TimeStringError(start);
  if (error)
    return Promise.reject(`Failed to trim video: start time is ${error}`);

  let startTrimmed = start.trim();
  error = TimeStringValidator(startTrimmed);
  if (!error.isValid)
    return Promise.reject(`Failed to trim video: ${error}`);

  error = TimeStringError(end);
  if (error)
    return Promise.reject(`Failed to trim video: end time is ${error}`);

  let endTrimmed = end.trim();
  error = TimeStringValidator(endTrimmed);
  if (!error.isValid)
    return Promise.reject(`Failed to trim video: ${error}`);

  return new Promise((resolve, reject) => {
    let args = ['-ss', startTrimmed, '-i', src, '-to', endTrimmed, '-c', 'copy', dest];
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to trim video: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to trim video: ${error}`);
  });
}

/**
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Concat(sources, dest) { // videos only! no re-encoding
  let error = SourcesValidator(sources);
  if (error)
    return Promise.reject(`Failed to concatenate video sources: ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to concatenate video sources: destination is ${error}`);

  return new Promise((resolve, reject) => {
    let args = ['-i', `'concat:${sources.join('|')}'`, '-codec', 'copy', dest];
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to concatenate video sources: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(`Failed to concatenate video sources: ${error}`);
  });
}

/**
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ConcatNoAudio(sources, dest) {  // will re-encode
  let error = SourcesValidator(sources);
  if (error)
    return Promise.reject(`Failed to concatenate video sources: ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to concatenate video sources: destination is ${error}`);

  return new Promise((resolve, reject) => {
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

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to concat video sources: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to concat video sources: ${error}`);
  });
}

/**
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ConcatReencode(sources, dest) {
  let error = SourcesValidator(sources);
  if (error)
    return Promise.reject(`Failed to concatenate video sources: ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to concatenate video sources: destination is ${error}`);

  return new Promise((resolve, reject) => {
    let args = [];

    // Source args
    sources.forEach(src => args.push('-i', src));

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

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to concatenate video sources: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to concatenate video sources: ${error}`);
  });
}

/**
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ConcatDemuxer(sources, dest) {
  let error = SourcesValidator(sources);
  if (error)
    return Promise.reject(`Failed to concatenate video sources: ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to concatenate video sources: destination is ${error}`);

  return new Promise((resolve, reject) => {
    let currDir = LINUX.Path.ParentDir(dest);
    let tempFilepath = path.join(currDir, 'video_input_list.txt');

    let lines = [];
    sources.forEach(s => lines.push(`file '${s}'`));

    LINUX.File.create(tempFilepath, lines.join('\n')).then(results => {
      // Build & run command
      let args = ['-f', 'concat', '-i', tempFilepath, '-c', 'copy', destTrimmed];
      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        if (output.stderr) {
          reject(`Failed to concatenate video sources: ${output.stderr}`);
          return;
        }
        resolve();

        // clean up temp file
        FILESYSTEM.File.Remove(tempFilepath, LOCAL_COMMAND).then(values => { }).catch(error => `Failed to concatenate video sources: ${error}`);
      }).catch(error => `Failed to concatenate video sources: ${error}`);
    }).catch(error => `Failed to concatenate video sources: ${error}`);
  });
}

/**
 * @param {string} videoSrc Video source
 * @param {string} audioSrc Audio source
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function AddAudio(videoSrc, audioSrc, dest) {
  return new Promise((resolve, reject) => {
    let error = StringValidator(videoSrc);
    if (error)
      return Promise.reject(`Failed to add audio: video source is ${error}`);

    error = StringValidator(audioSrc);
    if (error)
      return Promise.reject(`Failed to add audio: audio source is ${error}`);

    error = StringValidator(dest);
    if (error)
      return Promise.reject(`Failed to add audio: destination is ${error}`);

    return new Promise((resolve, reject) => {
      let args = ['-i', videoSrc, '-i', audioSrc, '-codec', 'copy', '-shortest', dest];
      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        if (output.stderr) {
          reject(`Failed to add audio: ${output.stderr}`);
          return;
        }
        resolve();
      }).catch(error => `Failed to add audio: ${error}`)
    });
  });
}

/**
 * @param {string} videoSrc Video source
 * @param {string} audioSrc Audio source
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ReplaceAudio(videoSrc, audioSrc, dest) {
  let error = StringValidator(videoSrc);
  if (error)
    return Promise.reject(`Failed to add audio: video source is ${error}`);

  error = StringValidator(audioSrc);
  if (error)
    return Promise.reject(`Failed to add audio: audio source is ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to add audio: destination is ${error}`);

  return new Promise((resolve, reject) => {
    let args = ['-i', videoSrc, '-i', audioSrc, '-c:v', 'copy', '-map', '0:v:0', '-map', '1:a:0', '-shortest', dest];
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to replace audio: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to replace audio: ${error}`)
  }).catch(error => `Failed to replace audio: ${error}`);
}

/**
 * @param {number} fps Frames per second
 * @param {string} imgSeqFormatStr Image sequence format string (Example: name_1001.png => name_%04d.png)
 * @param {Array<string>} audioPaths List of audio sources
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Create(fps, imgSeqFormatStr, audioPaths, dest) {
  let error = SourcesValidator(audioPaths);
  if (error)
    return Promise.reject(`Failed to create video: ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to create video: destination is ${error}`);

  if (isNaN(fps))
    return Promise.reject(`Failed to create video: fps is not a number`);

  return new Promise((resolve, reject) => {
    if (audioPaths.length == 1) {
      let args = ['-r', fps, '-i', imgSeqFormatStr, '-i', audioPaths[0], '-vcodec', 'libx264', -'shortest', '-y', dest];
      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        if (output.stderr) {
          reject(`Failed to create video: ${output.stderr}`);
          return;
        }
        resolve();
      }).catch(error => `Failed to create video: ${error}`);
    }
    else if (audioPaths.length > 1) {
      let currDir = LINUX.Path.ParentDir(dest);
      let tempFilepath = path.join(currDir, 'video_input_list.txt');

      let lines = [];
      audioPaths.forEach(path => lines.push(`file '${path}'`));

      LINUX.File.Create(tempFilepath, lines.join('\n')).then(success => {
        let args = ['-r', fps, '-i', imgSeqFormatStr, '-f', 'concat', '-safe', 0, '-i', tempFilepath, '-vcodec', 'libx264', '-r', fps, '-shortest', '-y', dest];
        FILESYSTEM.Execute('ffmpeg', args).then(output => {
          if (output.stderr) {
            reject(error => `Failed to create video: ${error}`);
            return;
          }
          resolve();
        }).catch(error => `Failed to create video: ${error}`);
      }).catch(error => `Failed to create video: ${error}`);
    }
    else {
      let args = ['-r', fps, '-i', imgSeqFormatStr, '-vcodec', 'libx264', '-r', fps, '-y', dest];
      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        if (output.stderr) {
          reject(`Failed to create video: ${output.stderr}`);
          return;
        }
        resolve();
      }).catch(error => `Failed to create video: ${error}`);
    }
  });
}

/**
 * @param {string} src Source
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ExtractAudio(src, dest) {
  return CONVERT.Convert(src, dest);
}

/**
 * @param {string} src Source
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ExtractVideo(src, dest) {
  let error = StringValidator(src);
  if (error)
    return Promise.reject(`Failed to extract video: source is ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to extract video: destination is ${error}`);

  return new Promise((resolve, reject) => {
    let args = ['-i', src, '-c', 'copy', '-an', dest];
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to extract video: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to extract video: ${error}`);
  });
}

/**
 * @param {string} src Source
 * @param {string} destformatStr Destination format string (Example: name_1001.png => name_%04d.png)
 * @param {number} frameStartNumber Frame number starts here.
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ExtractImages(src, destFormatStr, frameStartNumber, fps) {
  let error = StringValidator(src);
  if (error)
    return Promise.reject(`Failed to extract images: source is ${error}`);

  if (isNaN(frameStartNumber))
    return Promise.reject(`Failed to extract images: frame start number is not a number`);

  return new Promise((resolve, reject) => {
    let args = ['-i', src];
    if (frameStartNumber)
      args.push('-start_number', frameStartNumber);
    args.push('-vf', `fps=${fps}`, dest);

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to extract images: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to extract images: ${error}`);
  });
}

/**
 * @param {string} src Source
 * @param {number} speed Speed
 * @param {boolean} avoidDroppingFrames Assign as true if you wish to avoid dropping frames (smoother look).
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ChangeSpeed(src, speed, avoidDroppingFrames, dest) {
  let error = StringValidator(src);
  if (error)
    return Promise.reject(`Failed to change speed: source is ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to change speed: destination is ${error}`);

  if (isNaN(speed))
    return Promise.reject(`Failed to change speed: speed is not a number`);

  return new Promise((resolve, reject) => {
    // SLOW: speed > 1
    // FAST: 0 < speed <= 1
    let speedInverse = 1 / speed;
    let args = ['-i', src];

    if (avoidDroppingFrames)
      args.push('-r', speedInverse);
    args.push('-filter:v' `"setpts=${speed}*PTS"`, dest);

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to change speed: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to change speed: ${error}`);
  });

}

/**
 * @param {string} src Source
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function SmoothOut(src, dest) {
  let error = StringValidator(src);
  if (error)
    return Promise.reject(`Failed to smooth out video: source is ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to smooth out video: destination is ${error}`);

  return new Promise((resolve, reject) => {
    let args = ['-i', src, '-filter', `"minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120'"`, dest];
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to smooth out video: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to smooth out video: ${error}`);
  });
}

//---------------------------------------
// EXPORTS

exports.SupportedFormats = SupportedFormats;
exports.EstimatedFrames = EstimatedFrames;
exports.Trim = Trim;
exports.Concat = Concat;
exports.ConcatNoAudio = ConcatNoAudio;
exports.ConcatReencode = ConcatReencode;
exports.ConcatDemuxer = ConcatDemuxer;
exports.AddAudio = AddAudio;
exports.ReplaceAudio = ReplaceAudio;
exports.Create = Create;
exports.ExtractAudio = ExtractAudio;
exports.ExtractVideo = ExtractVideo;
exports.ExtractImages = ExtractImages;
exports.ChangeSpeed = ChangeSpeed;
exports.SmoothOut = SmoothOut;