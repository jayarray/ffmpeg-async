
let LINUX = require('linux-commands-async');
let LOCAL_COMMAND = LINUX.Command.LOCAL;

//---------------------------------------
// ERROR

function SrcDestValidator(src) {
  if (src === undefined)
    return 'undefined';
  else if (src == null)
    return 'null';
  else if (src == '')
    return 'empty';
  else if (src.trim() == '')
    return 'whitespace';
  else
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
// CONVERT

/**
 * Convert a file from one format to another.
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Convert(src, dest) {
  let srcError = SrcDestValidator(src);
  if (srcError)
    return Promise.reject(`Failed to convert: Source is ${srcError}`);

  let destError = SrcDestValidator(dest);
  if (destError)
    return Promise.reject(`Failed to convert: Destination is ${destError}`);

  return new Promise((resolve, reject) => {
    let args = ['-i', src, dest];
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      let containsErrorKeyword = ContainsErrorKeyword(output.stderr);
      if (output.stderr && containsErrorKeyword) {
        reject(`Failed to convert: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to convert: ${error}`);
  });
}

//--------------------------------
// EXPORTS

exports.Convert = Convert;