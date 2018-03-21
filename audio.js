let LINUX = require('linux-commands-async');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

let FFPROBE = require('ffprobe-async');
let CODECS = require('./codecs.js');
let TIMESTAMP = require('./timestamp.js');

let path = require('path');

//------------------------------------
// ERROR CHECKS

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

//----------------------------------------
// AUDIO

/**
 * List all supported audio formats.
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
 * Trim an audio file given a start and end time.
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

  error = TIMESTAMP.TimestampValidator(start);
  if (error)
    return Promise.reject(`Failed to trim audio: start time error: ${error}`);

  let startTrimmed = start.trim();
  error = TIMESTAMP.TimestampValidator(startTrimmed);
  if (error)
    return Promise.reject(`Failed to trim audio: start time error: ${error}`);

  error = TIMESTAMP.TimestampValidator(end);
  if (error)
    return Promise.reject(`Failed to trim audio: end error: ${error}`);

  let endTrimmed = end.trim();
  error = TIMESTAMP.TimestampValidator(endTrimmed);
  if (error)
    return Promise.reject(`Failed to trim audio: end time error: ${error}`);

  return new Promise((resolve, reject) => {
    FFPROBE.CodecTypes(src).then(types => {
      if (types.length == 1 && types.includes('audio')) {
        let args = ['-i', src, '-ss', startTrimmed, '-to', endTrimmed, '-c', 'copy', dest];
        LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
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
 * Concatenate audio files in the order listed.
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Concat(sources, dest) {  // audio files only
  let error = SourcesValidator(sources);
  if (error)
    return Promise.reject(`Failed to concatenate audio sources: ${error}`);

  error = StringValidator(dest);
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
        LINUX.File.Remove(tempFilepath, LOCAL_COMMAND).then(success => { }).catch(error => `Failed to concatenate audio sources: ${error}`);
      }).catch(error => `Failed to concatenate audio sources: ${error}`);
    }).catch(error => `Failed to concatenate audio sources: ${error}`);
  });
}

/**
 * Overlay audio files. (All audio overlaps)
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Overlay(sources, dest) {
  let error = SourcesValidator(sources);
  if (error)
    return Promise.reject(`Failed to overlay audio sources: ${error}`);

  error = StringValidator(dest);
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
        LINUX.File.Remove(tempFilepath, LOCAL_COMMAND).then(values => { }).catch(error => `Failed to concatenate audio sources: ${error}`);
      }).catch(error => `Failed to concatenate audio sources: ${error}`);
    }).catch(error => `Failed to concatenate audio sources: ${error}`);
  });
}

/**
 * Change audio speed.
 * @param {string} src Source
 * @param {number} speed Speed.
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