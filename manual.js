
let LOCAL_COMMAND = require('linux-commands-async').Command.LOCAL;

//-----------------------------

/**
 * Execute FFMPEG command using the provided args in the order listed.
 * @param {Array<string|number>} args
 * @returns {Promise} Returns a promise that resolves if successful. Otherwise, it returns an error.
 */
function Manual(args) {
  return new Promise((resolve, reject) => {
    LOCAL_COMMAND.Execute('ffmpeg', args).then(output => {
      if (output.stderr) {
        reject(`Failed to smooth out video: ${output.stderr}`);
        return;
      }
      resolve();
    }).catch(error => `Failed to smooth out video: ${error}`);
  });
}

//-----------------------------------
// EXPORTS

exports.Manual = Manual;