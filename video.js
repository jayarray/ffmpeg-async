let LINUX = require('linux-commands-async');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

let DURATION = require('./duration.js');
let CODECS = require('./codecs.js');
let TIMESTAMP = require('./timestamp.js');
let CONVERT = require('./convert.js');

let path = require('path');

//------------------------------------
// TIME STRING ERROR

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
    return 'undefined';
  else if (string == null)
    return 'null';
  else if (string == '')
    return 'empty';
  else if (string.trim() == '')
    return 'whitespace';
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
// VIDEO

/**
 * List all supported video formats.
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
 * Calculate the number of frames in a video.
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
 * Trim a video given a start and end time.
 * @param {string} src Source
 * @param {string} start Start time string
 * @param {string} end End time string
 * @param {string} dest Destination
 * @param {boolean} enableReencode Set to true if re-encoding is desired. False otherwise.
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Trim(src, start, end, dest, enableReencode) {
  let error = StringValidator(src);
  if (error)
    return Promise.reject(`Failed to trim video: source is ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to trim video: destination is ${error}`);

  error = TIMESTAMP.TimestampValidator(start);
  if (error)
    return Promise.reject(`Failed to trim video: start time error: ${error}`);

  let startTrimmed = start.trim();
  error = TIMESTAMP.TimestampValidator(startTrimmed);
  if (error)
    return Promise.reject(`Failed to trim video: start time error: ${error}`);

  error = TIMESTAMP.TimestampValidator(end);
  if (error)
    return Promise.reject(`Failed to trim video: end time error: ${error}`);

  let endTrimmed = end.trim();
  error = TIMESTAMP.TimestampValidator(endTrimmed);
  if (error)
    return Promise.reject(`Failed to trim video: end time error: ${error}`);

  return new Promise((resolve, reject) => {
    let startTimestamp = new TIMESTAMP.Timestamp(startTrimmed);
    let endTimestamp = new TIMESTAMP.Timestamp(endTrimmed);
    let durationTimestamp = TIMESTAMP.Difference(startTimestamp, endTimestamp);

    let args = ['-ss', startTimestamp.string(), '-i', src, '-t', durationTimestamp.string()];
    if (!enableReencode)
      args.push('-c', 'copy');
    args.push(dest);

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);

      if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
        reject(`Failed to trim video: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to trim video: ${error}`);
  });
}

/**
 * Concatenate video files in the order listed (with re-encoding enabled to allow any types to be joined).
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Concat(sources, dest) {
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

    let filterStr = '';

    let avFilterLines = [];
    for (let i = 0; i < sources.length; ++i) {
      let videoFilter = `[${i}:v:0]`;
      let audioFilter = `[${i}:a:0]`;
      avFilterLines.push(`${videoFilter} ${audioFilter}`);
    }
    filterStr += avFilterLines.join(' ');

    // Concat & map string
    filterStr += ` concat=n=${sources.length}:v=1:a=1 [v] [a]`;
    args.push(filterStr);
    args.push('-map', '[v]', '-map', '[a]', dest);

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
        reject(`Failed to concatenate video sources: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to concatenate video sources: ${error}`);
  });
}

/**
 * Concatenate video files without any audio (with re-encoding enabled to allow any types to be joined).
 * @param {Array<string>} sources List of sources
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ConcatNoAudio(sources, dest) {
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

    let filterStr = '';

    let aFilterLines = [];
    sources.forEach((src, i) => aFilterLines.push(`[${i}:v:0]`))

    filterStr += aFilterLines.join(' ');

    // Concat & map string
    filterStr += ` concat=n=${sources.length}:v=1 [v]`;
    args.push(filterStr);
    args.push('-map', '[v]', dest);

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
        reject(`Failed to concatenate video sources: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to concat video sources: ${error}`);
  });
}

/**
 * Add audio to video.
 * @param {string} videoSrc Video source
 * @param {string} audioSrc Audio source
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function AddAudio(videoSrc, audioSrc, dest, truncateAtShortestTime) {
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
      let args = ['-i', videoSrc, '-i', audioSrc, '-codec', 'copy'];
      if (truncateAtShortestTime)
        args.push('-shortest');
      args.push(dest);

      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
        if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
          reject(`Failed to add audio: ${output.stderr}`);
          return;
        }
        resolve();
      }).catch(error => `Failed to add audio: ${error}`)
    });
  });
}

/**
 * Replace current audio source with another.
 * @param {string} videoSrc Video source
 * @param {string} audioSrc Audio source
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ReplaceAudio(videoSrc, audioSrc, dest, truncateAtShortestTime) {
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
    let args = ['-i', videoSrc, '-i', audioSrc, '-c:v', 'copy', '-map', '0:v:0', '-map', '1:a:0'];
    if (truncateAtShortestTime)
      args.push('-shortest');
    args.push(dest);

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
        reject(`Failed to replace audio: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to replace audio: ${error}`)
  }).catch(error => `Failed to replace audio: ${error}`);
}

/**
 * Extract audio from video.
 * @param {string} src Source
 * @param {string} dest Destination
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function ExtractAudio(src, dest) {
  return CONVERT.Convert(src, dest);
}

/**
 * Extract video without audio.
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
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
        reject(`Failed to extract video: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to extract video: ${error}`);
  });
}

/**
 * Extract image sequence from video.
 * @param {string} src Source
 * @param {string} destformatStr Destination format string (Example: name_1001.png => name_%04d.png)
 * @param {number} frameStartNumber Frame number starts here.
 * @param {number} fps Frames per second.
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
    args.push('-vf', `fps=${fps}`, destFormatStr);

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
        reject(`Failed to extract images: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to extract images: ${error}`);
  });
}

/**
 * Create a video.
 * @param {number} fps Frames per second
 * @param {string} imgSeqFormatStr Image sequence format string (Example: name_1001.png => name_%04d.png)
 * @param {Array<string>} audioPaths List of audio sources
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Create(fps, imgSeqFormatStr, audioPaths, dest, truncateAtShortestTime) {
  let error = SourcesValidator(audioPaths);
  if (error)
    return Promise.reject(`Failed to create video: ${error}`);

  error = StringValidator(dest);
  if (error)
    return Promise.reject(`Failed to create video: destination is ${error}`);

  if (isNaN(fps))
    return Promise.reject(`Failed to create video: fps is not a number`);

  return new Promise((resolve, reject) => {
    if (audioPaths.length == 1) { // ADD SINGLE AUDIO SOURCE
      let args = ['-r', fps, '-i', imgSeqFormatStr, '-i', audioPaths[0], '-vcodec', 'libx264'];
      if (truncateAtShortestTime)
        args.push('-shortest');
      args.push('-y', dest);

      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
        if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
          reject(`Failed to create video: ${output.stderr}`);
          return;
        }
        resolve();
      }).catch(error => `Failed to create video: ${error}`);
    }
    else if (audioPaths.length > 1) { // ADD MULTIPLE AUDIO SOURCES
      let currDir = LINUX.Path.ParentDir(dest);
      let tempFilepath = path.join(currDir, 'video_input_list.txt');

      let lines = [];
      audioPaths.forEach(path => lines.push(`file '${path}'`));

      LINUX.File.Create(tempFilepath, lines.join('\n'), LOCAL_COMMAND).then(success => {
        let args = ['-r', fps, '-i', imgSeqFormatStr, '-f', 'concat', '-safe', 0, '-i', tempFilepath, '-vcodec', 'libx264']; //'-r', fps];
        if (truncateAtShortestTime)
          args.push('-shortest');
        args.push('-y', dest);

        LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
          let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
          if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
            reject(`Failed to create video: ${output.stderr}`);
            return;
          }
          resolve();

          // Clean up temp file
          LINUX.File.Remove(tempFilepath, LOCAL_COMMAND).then(success => {
            // Do nothing.
          }).catch(error => `Failed to create video: ${error}`);
        }).catch(error => `Failed to create video: ${error}`);
      }).catch(error => `Failed to create video: ${error}`);
    }
    else { // NO AUDIO
      let args = ['-r', fps, '-i', imgSeqFormatStr, '-vcodec', 'libx264', '-y', dest];
      LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
        let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
        if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
          reject(`Failed to create video: ${output.stderr}`);
          return;
        }
        resolve();
      }).catch(error => `Failed to create video: ${error}`);
    }
  });
}

/**
 * Change video speed.
 * @param {string} src Source
 * @param {number} speed Speed for both audio and video. Values between 0.5 and 1.0 (non-inclusive) will slow both down. Values between 1.0 (non-inclusive) and 2.0 (inclusive) will speed both up. Assign as 1 to leave as is.
 * @param {boolean} avoidDroppingFrames Assign as true if you wish to avoid dropping frames after changing speed. (Gives a smoother look).
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

  error = NumberValidator(speed);
  if (error)
    return Promise.reject(`Failed to change speed: speed is ${error}`);

  return new Promise((resolve, reject) => {
    let audioSpeed = speed;
    let videoSpeed = parseFloat((1 / speed).toFixed(2));

    let args = ['-i', src];

    if (avoidDroppingFrames)
      args.push('-r', 120);

    args.push('-filter_complex', `[0:v]setpts=${videoSpeed}*PTS[v];[0:a]atempo=${audioSpeed}[a]`, '-map', '[v]', '-map', '[a]', dest);

    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
        reject(`Failed to change speed: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to change speed: ${error}`);
  });

}

/**
 * Smoothe out slow/fast video (using "motion interpolation" or "optical flow").
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
    let args = ['-i', src, '-filter:v', 'minterpolate', '-r', 120, dest];

    console.log(`CMD: ffmpeg ${args.join(' ')}`);
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) { // FFMPEG sends all its output to stderr.
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
exports.AddAudio = AddAudio;
exports.ReplaceAudio = ReplaceAudio;
exports.Create = Create;
exports.ExtractAudio = ExtractAudio;
exports.ExtractVideo = ExtractVideo;
exports.ExtractImages = ExtractImages;
exports.ChangeSpeed = ChangeSpeed;
exports.SmoothOut = SmoothOut;