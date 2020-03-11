//------------------------------
// HELPERS

const MIN_HOURS = 0;
const MIN_MINUTES = 0;
const MAX_MINUTES = 59;
const MIN_SECONDS = 0;
const MAX_SECONDS = 59;
const MIN_NANOSECONDS = 0;
const MAX_NANOSECONDS = 999999;
const NANOSECONDS_PER_SECOND = 1000000000;


function HoursToString(hours) {
  let hStr = hours.toString();
  if (hours < 10)
    return `0${hours}`;
  return hours.toString();
}

function HoursValidator(hoursStr) {
  if (isNaN(hoursStr))
    return 'Hours are invalid. Must be a number type.';

  let hoursValue = parseInt(hoursStr);
  if (hoursValue < MIN_HOURS)
    return `Hours are invalid. Must be an integer equal to or greater than ${MIN_HOURS}`;
  return null;
}

function MinutesToString(minutes) {
  if (minutes < 10)
    return `0${minutes}`;
  return minutes.toString();
}

function MinutesValidator(minutesStr) {
  if (isNaN(minutesStr))
    return 'Minutes are invalid. Must be a number type.';

  let minutesValue = parseInt(minutesStr);

  let length = minutesValue.toString().length;
  if (length > 2)
    return 'Minutes are invalid. Can go up to 2 digits max.';

  if (minutesValue < MIN_HOURS || minutesValue > MAX_MINUTES)
    return `Minutes are invalid. Must be an integer between ${MIN_MINUTES} and ${MAX_MINUTES}`;
  return null;
}

function SecondsToString(seconds) {
  if (seconds < 10)
    return `0${seconds}`;
  return seconds.toString();
}

function SecondsValidator(secondsStr) {
  if (isNaN(secondsStr))
    return 'Seconds are invalid. Must be a number type.';

  let secondsValue = parseInt(secondsStr);

  let length = secondsValue.toString().length;
  if (length > 2)
    return 'Seconds are invalid. Can go up to 2 digits max.';

  if (secondsValue < MIN_SECONDS || secondsValue > MAX_SECONDS)
    return `Seconds are invalid. Must be an integer between ${MIN_SECONDS} and ${MAX_SECONDS}`;
  return null;
}

function NanosecondsToString(nanoseconds) {
  let nStr = nanoseconds.toString();

  let formattedStr = null;
  if (nStr.length < 6)
    return `000000${nanoseconds}`.split(-6);
  else
    return nanoseconds.toString();
}

function NanoSecondsValidator(nanosecondsStr) {
  if (isNaN(nanosecondsStr))
    return 'Nanoseconds are invalid. Must be a number type.';

  let nanoValue = parseInt(nanosecondsStr);

  let length = nanoValue.toString().length;
  if (length > 6)
    return 'Nanoseconds are invalid. Can go up to 6 digits max.';

  if (nanoValue < MIN_NANOSECONDS || nanoValue > MAX_NANOSECONDS)
    return `Nanoseconds are invalid. Must be an integer between ${MIN_NANOSECONDS} and ${MAX_NANOSECONDS}`;
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

/**
 * Validates a timestamp string.
 * @param {string} string Timestamp string
 * @returns {string} Returns an error string if timestamp is not valid. Otherwise, it returns null if no errors are found.
 */
function TimestampValidator(string) {
  let error = StringValidator(string);
  if (error)
    return `Timestamp is ${error}`;

  let sTrimmed = string.trim();
  let parts = sTrimmed.split(':');

  if (parts.length == 3) {
    let hours = parts[0].trim();

    // Check hours
    let hoursError = HoursValidator(hours);
    if (!hoursError) {
      let minutes = parts[1].trim();

      // Check minutes
      let minutesError = MinutesValidator(minutes);
      if (!minutesError) {
        let secondsStr = parts[2].trim();

        // Check seconds
        let seconds = null;
        let nanoseconds = null;

        let containsMantissa = secondsStr.includes('.');
        if (containsMantissa) {
          let moreParts = secondsStr.split('.');
          seconds = moreParts[0];
          nanoseconds = moreParts[1];
        }
        else
          seconds = secondsStr;

        let secondsError = SecondsValidator(seconds);
        if (!secondsError) {
          if (containsMantissa) {
            let nanoError = NanoSecondsValidator(nanoseconds);
            if (!nanoError)
              return null; // OK (No errors!)
          }
          return null;  // OK (No errors!)
        }
      }
    }
    return 'Time string is not formatted correctly. Must follow one of two formats: HH:MM:SS or HH:MM:SS.nnnnnn';
  }
}

//---------------------------------

class Timestamp {
  constructor(string) {
    let parts = string.split(':');

    // HOURS
    this.hours_ = parseInt(parts[0]);
    this.hoursStr_ = HoursToString(this.hours_);

    // MINUTES
    this.minutes_ = parseInt(parts[1]);
    this.minutesStr_ = MinutesToString(this.minutes_);

    // SECONDS & NANOSECONDS
    this.seconds_ = 0;
    this.secondsStr_ = '00';

    this.nanoseconds_ = 0;
    this.nanosecondsStr_ = '000000';

    let secNanoParts = parts[2];
    if (secNanoParts.includes('.')) {
      let moreParts = secNanoParts.split('.');

      this.seconds_ = parseInt(moreParts[0]);
      this.secondsStr_ = SecondsToString(this.seconds_);

      this.nanoseconds_ = parseInt(moreParts[1]);
      this.nanosecondsStr_ = NanosecondsToString(this.nanoseconds_);
    }
    else {
      this.seconds_ = parseInt(secNanoParts);
      this.secondsStr_ = SecondsToString(this.seconds_);
    }
  }

  toSeconds() {
    return (this.hours_ * 3600) + (this.minutes_ * 60) + this.seconds_;
  }

  toNanoseconds() {
    return (this.toSeconds() * NANOSECONDS_PER_SECOND) + this.nanoseconds_;
  }

  string() {
    let str = `${this.hoursStr_}:${this.minutesStr_}:${this.secondsStr_}`;
    if (this.nanoseconds_ > 0)
      str += `.${this.nanosecondsStr_}`;
    return str;
  }
}

function Difference(t1, t2) {
  // Convert to nanoseconds
  let t1Nanoseconds = t1.toNanoseconds();
  let t2Nanoseconds = t2.toNanoseconds();

  let diff = 0;
  if (t1Nanoseconds > t2Nanoseconds)
    diff = t1Nanoseconds - t2Nanoseconds;
  else
    diff = t2Nanoseconds - t1Nanoseconds;

  // Convert to hours
  let nanosPerHour = 3600 * NANOSECONDS_PER_SECOND;
  let hours = Math.floor(diff / nanosPerHour);
  let hoursStr = HoursToString(hours);
  let remainder = diff % nanosPerHour;

  // Convert to minutes
  let nanosPerMinute = 60 * NANOSECONDS_PER_SECOND;
  let minutes = Math.floor(remainder / nanosPerMinute);
  let minutesStr = MinutesToString(minutes);
  remainder = remainder % nanosPerMinute;

  // Convert to seconds
  let seconds = Math.floor(remainder / NANOSECONDS_PER_SECOND);
  let secondsStr = SecondsToString(seconds);
  remainder = remainder % NANOSECONDS_PER_SECOND;

  // Convert to nanoseconds
  let nanoseconds = remainder;
  let nanosecondsStr = NanosecondsToString(nanoseconds);


  // Return timestamp object
  let timestampStr = `${hoursStr}:${minutesStr}:${secondsStr}`;
  if (nanoseconds > 0)
    timestampStr += `.${nanosecondsStr}`;

  return new Timestamp(timestampStr);
}

//--------------------------------------
// EXPORTS

exports.TimestampValidator = TimestampValidator;
exports.Timestamp = Timestamp;
exports.Difference = Difference;