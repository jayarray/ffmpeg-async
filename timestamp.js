//------------------------------
// HELPERS

const MIN_HOURS = 0;
const MIN_MINUTES = 0;
const MAX_MINUTES = 59;
const MIN_SECONDS = 0;
const MAX_SECONDS = 59;
const MIN_NANOSECONDS = 0;
const MAX_NANOSECONDS = 999999;


function HoursToString(hours) {
  let hStr = hours.toString();
  let startIndex = -hStr.length;
  return `0${hours}`.substring(startIndex);
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
  return `0${minutes}`.substring(-2);
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
  return `0${seconds}`.substring(-2);
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
  else if (nStr.length > 6)
    return nanoseconds.toString().substring(0, 6);
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
          let moreParts = seconds.split('.');
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

  string() {
    let str = `${this.hoursStr_}:${this.minutesStr_}:${this.secondsStr_}`;
    if (this.nanoseconds_ > 0)
      str += `${this.nanosecondsStr_}`;
    return str;
  }
}

//--------------------------------------
// EXPORTS

exports.TimestampValidator = TimestampValidator;
exports.Timestamp = Timestamp;