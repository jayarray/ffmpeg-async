let LINUX = require('linux-commands-async.js');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

let FFPROBE = require('ffprobe-async.js');
let CODECS = require('./codecs.js');

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
// AUDIO

/**
 * @returns {Promise<Array<{name: string, string: string, types: Array<{char: string, string: string}>}>>} Returns a promise. If it resolves, it returns an array of objects. Otherwise, it returns an error.
 */
function SupportedFormats() {
  return new Promise((resolve, reject) => {
    CODECS.AudioCodecs().then(codecs => {
      resolve(codecs);
    }).catch(error => `Failed to get supported formats: ${error}`);
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
    return Promise.reject(`Failed to trim audio: source is ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to trim audio: destination is ${error}`);

  error = TimeStringError(start);
  if (error)
    return Promise.reject(`Failed to trim audio: start time is ${error}`);

  let startTrimmed = start.trim();
  error = TimeStringValidator(startTrimmed);
  if (!error.isValid)
    return Promise.reject(`Failed to trim audio: ${error}`);

  error = TimeStringError(end);
  if (error)
    return Promise.reject(`Failed to trim audio: end time is ${error}`);

  let endTrimmed = end.trim();
  error = TimeStringValidator(endTrimmed);
  if (!error.isValid)
    return Promise.reject(`Failed to trim audio: ${error}`);

  return new Promise((resolve, reject) => {
    FFPROBE.CodecTypes(src).then(types => {
      if (types.length == 1 && types.includes('audio')) {
        let args = ['-i', src, '-ss', startTrimmed, '-to', endTrimmed, '-c', 'copy', dest];
        FILESYSTEM.Execute.local('ffmpeg', args).then(output => {
          if (output.stderr) {
            reject(`Failed to trim audio: ${output.stderr}`);
            return;
          }
          resolve();
        }).catch(error => `Failed to trim audio: ${error}`);
        return;
      }
      reject(`Failed to trim audio: source is not an audio file type`);
    }).catch(error => `Failed to trim audio: ${error}`);
  });
}

/**
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Concat(sources, dest) {  // audio files only
  if (Array.isArray(sources)) {
    let allAreStrings = true;
    for (let i = 0; i < sources.length; ++i) {
      if (typeof sources[i] != 'string') {
        allAreStrings = false; break;
      }
    }

    if (!allAreStrings)
      return Promise.reject(`Failed to concatenate audio sources: sources must all be strings`);
  }

  let error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to concatenate audio sources: destination is ${error}`);

  return new Promise((resolve, reject) => {
    error = StringValidator(dest);
    if (error) {
      reject(`Failed to concatenate audio sources: destination is ${error}`);
      return;
    }

    // Create file with all video paths
    let currDir = LINUX.Path.ParentDir(dest);
    let tempFilepath = path.join(currDir, 'audio_input_list.txt');

    let lines = [];
    sources.forEach(s => lines.push(`file '${s}'`));

    LINUX.File.Create(tempFilepath, lines.join('\n')).then(results => {
      // Build & run command
      let args = ['-f', 'concat', '-safe', 0, '-i', tempFilepath, '-acodec', 'copy', destTrimmed];
      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        if (output.stderr) {
          reject(`Failed to concatenate audio sources: ${output.stderr}`);
          return;
        }
        resolve();

        // clean up temp file
        LINUX.File.Remove(tempFilepath).then(success => { }).catch(error => `Failed to concatenate audio sources: ${error}`);
      }).catch(error => `Failed to concatenate audio sources: ${error}`);
    }).catch(error => `Failed to concatenate audio sources: ${error}`);
  });
}

/**
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Overlay(sources, dest) {
  if (Array.isArray(sources)) {
    let allAreStrings = true;
    for (let i = 0; i < sources.length; ++i) {
      if (typeof sources[i] != 'string') {
        allAreStrings = false; break;
      }
    }

    if (!allAreStrings)
      return Promise.reject(`Failed to concatenate audio sources: sources must all be strings`);
  }

  let error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to concatenate audio sources: destination is ${error}`);

  return new Promise((resolve, reject) => {
    // Create file with all video paths
    let currDir = LINUX.Path.ParentDir(dest);
    let tempFilepath = path.join(currDir, 'audio_input_list.txt');

    let lines = [];
    sources.forEach(s => lines.push(`file '${s}'`));

    LINUX.File.Create(tempFilepath, lines.join('\n')).then(results => {
      // Build & run command
      let args = ['-f', 'concat', '-safe', 0, '-i', tempFilepath, '-filter_complex', 'amerge', '-ac', 2, '-c:a', 'libmp3lame', '-q:a', 4, destTrimmed];
      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        if (output.stderr) {
          reject(`Failed to overlay audio sources: ${output.stderr}`);
          return;
        }
        resolve();

        // clean up temp file
        LINUX.File.Remove(tempFilepath).then(values => { }).catch(error => `Failed to concatenate audio sources: ${error}`);
      }).catch(error => `Failed to concatenate audio sources: ${error}`);
    }).catch(error => `Failed to concatenate audio sources: ${error}`);
  });
}

/**
 * @param {string} src Source
 * @param {number} speed Speed (between 0.5 and 2.0)
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ChangeSpeed(src, speed, dest) {  // 0.5 (slower) < speed < 2.0 (faster)
  return new Promise((resolve, reject) => {
    let error = StringValidator(src);
    if (error)
      return Promise.reject(`Failed to change speed: source is ${error}`);

    error = StringValidator(dest);
    if (error)
      return Promise.reject(`Failed to change speed: destination is ${error}`);

    if (isNaN(speed))
      return Promise.reject(`Failed to change speed: speed is not a number`);

    let boundSpeed = 0;
    if (speed < 0.5)
      boundSpeed = 0.5;
    else if (speed > 2.0)
      boundSpeed = 2.0;
    else
      boundSpeed = speed;

    let args = ['-i', src, '-filter:a', `"atempo=${boundSpeed}"`, '-vn', dest];
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to change speed: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to change speed: ${error}`);
  });
}

//--------------------------------------------
// EXPORTS

exports.SupportedFormats = SupportedFormats;
exports.Trim = Trim;
exports.Concat = Concat;
exports.Overlay = Overlay;
exports.ChangeSpeed = ChangeSpeed;