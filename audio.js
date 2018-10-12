let LINUX = require('linux-commands-async');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

let FFPROBE = require('ffprobe-async');
let CODECS = require('./codecs.js');
let TIMESTAMP = require('./timestamp.js');

let path = require('path');

//------------------------------------
// ERROR CHECKS

function NumberValidator(number) {
  if (number === undefined)
    return 'Number is undefined';
  else if (number == null)
    return 'Number is null';
  else if (typeof number != 'number')
    return 'not a number';
  else
    return null;
}

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

function ContainsErrorKeyword(error) {
  return error.indexOf('No such file or directory') != -1 ||
    error.indexOf('Unrecognized') != -1 ||
    error.indexOf('Error splitting the argument list') != -1 ||
    error.indexOf('Invalid argument') != -1 ||
    error.indexOf('Error ') != -1;
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
        let startTimestamp = new TIMESTAMP.Timestamp(startTrimmed);
        let endTimestamp = new TIMESTAMP.Timestamp(endTrimmed);
        let durationTimestamp = TIMESTAMP.Difference(startTimestamp, endTimestamp);

        let args = ['-i', src, '-ss', startTimestamp.string(), '-t', durationTimestamp.string(), '-c', 'copy', '-y', dest];
        LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
          let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
          if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
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
 * @param {boolean} enableReencoding Set as true to re-encode output. Otherwise, set to false.
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Concat(sources, dest, enableReencoding) {  // audio files only
  let error = SourcesValidator(sources);
  if (error)
    return Promise.reject(`Failed to concatenate audio sources: ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to concatenate audio sources: destination is ${error}`);

  return new Promise((resolve, reject) => {
    if (enableReencoding) {
      let args = [];

      // Add inputs
      sources.forEach(src => args.push(`-i`, src));

      // Add filter
      args.push('-filter_complex');

      let filterStr = '';
      sources.forEach((src, i) => filterStr += `[${i}:a]`);
      filterStr += `concat=n=${sources.length}:v=0:a=1`;
      args.push(filterStr);

      args.push('-y', dest);

      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
        if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
          reject(`Failed to concatenate audio sources: ${output.stderr}`);
          return;
        }
        resolve();

        // clean up temp file
        LINUX.File.Remove(tempFilepath, LOCAL_COMMAND).then(success => { }).catch(error => `Failed to concatenate audio sources: ${error}`);
      }).catch(error => `Failed to concatenate audio sources: ${error}`);
    }
    else {
      // Create file with all video paths
      let currDir = LINUX.Path.ParentDir(dest);
      let tempFilepath = path.join(currDir, 'audio_input_list.txt');

      let lines = [];
      sources.forEach(s => lines.push(`file '${s}'`));

      LINUX.File.Create(tempFilepath, lines.join('\n'), LOCAL_COMMAND).then(results => {
        // Build & run command
        let args = ['-f', 'concat', '-safe', 0, '-i', tempFilepath, '-acodec', 'copy', dest];
        LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
          let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
          if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
            reject(`Failed to concatenate audio sources: ${output.stderr}`);
            return;
          }
          resolve();

          // clean up temp file
          LINUX.File.Remove(tempFilepath, LOCAL_COMMAND).then(success => { }).catch(error => `Failed to concatenate audio sources: ${error}`);
        }).catch(error => `Failed to concatenate audio sources: ${error}`);
      }).catch(error => `Failed to concatenate audio sources: ${error}`);
    }
  });
}

/**
 * Overlay audio files. (All audio overlaps)
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @param {string} durationType Duration type. Can be one of the following values: 'longest', 'shortest', 'first'.
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Overlay(sources, dest, durationType) {
  let error = SourcesValidator(sources);
  if (error)
    return Promise.reject(`Failed to overlay audio sources: ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to concatenate audio sources: destination is ${error}`);

  error = StringValidator(durationType);
  if (error)
    return Promise.reject(`Failed to concatenate audio sources: duration type is ${error}`);

  return new Promise((resolve, reject) => {
    let args = [];

    // Add inputs
    sources.forEach(src => args.push('-i', src));

    // Add filter
    args.push('-filter_complex');

    let filterStr = '';
    sources.forEach((src, i) => filterStr += `[${i}:0]`);

    filterStr += ` amix=inputs=${sources.length}:duration=${durationType}`;
    args.push(filterStr);

    // Add rest of args
    args.push('-c:a', 'libmp3lame', '-y', dest);

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) {
        reject(`Failed to overlay audio sources: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to concatenate audio sources: ${error}`);
  });
}

/**
 * Change audio speed.
 * @param {string} src Source
 * @param {number} speed Speed. Values between 0.5 and 1.0 (non-inclusive) will slow it down. Values between 1.0 (non-inclusive) and 2.0 (inclusive) will speed it up. Assign as 1 to leave as is.
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ChangeSpeed(src, speed, dest) {
  return new Promise((resolve, reject) => {
    let error = StringValidator(src);
    if (error)
      return Promise.reject(`Failed to change speed: source is ${error}`);

    error = StringValidator(dest);
    if (error)
      return Promise.reject(`Failed to change speed: destination is ${error}`);

    error = NumberValidator(speed);
    if (error)
      return Promise.reject(`Failed to change speed: speed is ${error}`);

    let args = ['-i', src, '-filter:a', `atempo=${speed}`, '-vn', '-y', dest];
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) {
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