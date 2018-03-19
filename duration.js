let FFPROBE = require('ffprobe-async.js');

//----------------------------------------
// DURATION

/**
 * @returns {Promise<number>} Returns a promise. If it resolves, it returns a number. Otherwise, it returns an error.
 */
function InSeconds(src) {
  return new Promise((resolve, reject) => {
    FFPROBE.DurationInSeconds(src).then(seconds => {
      resolve(seconds);
    }).catch(error => `Failed to get duration in seconds: ${error}`);
  });
}

/**
 * @returns {Promise<string>} Returns a promise. If it resolves, it returns a string. Otherwise, it returns an error.
 */
function AsString(src) {
  return new Promise((resolve, reject) => {
    FFPROBE.DurationString(src).then(string => {
      resolve(string);
    }).catch(error => `Failed to get duration string: ${error}`);
  });
}

/**
 * @returns {Promise<{hours: number, minutes: number, seconds: number}>} Returns a promise. If it resolves, it returns an object. Otherwise, it returns an error.
 */
function Units(src) {
  return new Promise((resolve, reject) => {
    FFPROBE.DurationTimeUnits(src).then(units => {
      resolve(units);
    }).catch(error => `Failed to get duration time units: ${error}`);
  });
}

//---------------------------------------
// EXPORTS

exports.InSeconds = InSeconds;
exports.AsString = AsString;
exports.Units = Units;