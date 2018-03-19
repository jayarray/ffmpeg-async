
let LINUX = require('linux-commands-async.js');
let FFPROBE = require('ffprobe-async.js');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

//------------------------------------
// TIME

function TimeStringError(string) {
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
  let error = TimeStringError(string);
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
// SOURCE

function SourceValidator(src) {
  if (src === undefined)
    return 'Source is undefined';
  else if (src == null)
    return 'Source is null';
  else if (src == '')
    return 'Source is empty';
  else if (src.trim() == '')
    return 'Source is whitespace';
  else
    return null;
}

function SourcesValidator(sources) {
  if (sources === undefined)
    return 'Source list is undefined';

  if (sources == null)
    return 'Source list is null';

  if (!Array.isArray(sources))
    return 'Source list is not an array';

  if (sources.length == 0)
    return 'Source list is empty';

  // Validate sources
  let validation_errors = [];
  sources.forEach(src => {
    let error = SourceValidator(src);
    if (error)
      validation_errors.push(`${error}: ${src}`);
  });

  if (validation_errors.length > 0)
    return validation_errors;

  return null;
}


//-----------------------------------
// EXPORTS

exports.Video = Video;

//-------------------------------------
// TEST

formats().then(results => {
  console.log(`FORMATS:\n\n${JSON.stringify(results.formats)}`);
});