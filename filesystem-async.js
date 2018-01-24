var OS = require('os'); //
var PATH = require('path');
var FS = require('fs-extra'); //
var MKDIRP = require('mkdirp'); //
var CHILD_PROCESS = require('child_process');

//-----------------------------------
// ERROR CATCHING

function fatalFail(error) {
  console.log(error);
  process.exit(-1);
}

//-----------------------------------
// SAVING DATA (to string)
class SavedData {
  constructor(thing) {
    this.value = '';
    thing.on('data', this.callback_.bind(this));
  }

  callback_(data) {
    this.value += data.toString();
  }
}

//-----------------------------------
// EXECUTE
class Execute {
  static local(cmd, args) {
    let childProcess = CHILD_PROCESS.spawn(cmd, args);
    let errors = new SavedData(childProcess.stderr);
    let outputs = new SavedData(childProcess.stdout);

    return new Promise(resolve => {
      childProcess.on('close', exitCode => {
        resolve({
          stderr: errors.value,
          stdout: outputs.value,
          exitCode: exitCode
        });
      });
    });
  }

  static remote(user, host, cmd) {
    return new Promise(resolve => {
      let args = `${user}@${host} '${cmd}'`;
      let childProcess = CHILD_PROCESS.spawn('ssh', args);
      let errors = new SavedData(childProcess.stderr);
      let outputs = new SavedData(childProcess.stdout);

      return new Promise(resolve => {
        childProcess.on('close', exitCode => {
          resolve({
            stderr: errors.value,
            stdout: outputs.value,
            exitCode: exitCode
          });
        });
      });
    });
  }
}

//---------------------------------------
// TIMESTAMP
class Timestamp {
  static timestamp() {
    let d = new Date();

    // TIME
    let hours = d.getHours();  // 0-23
    let minutes = d.getMinutes();  // 0-59
    let seconds = d.getSeconds();  // 0-59
    let milliseconds = d.getMilliseconds();  // 0-999 

    let militaryTime = {  // 24-hour format
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      milliseconds: milliseconds,
      string: `${hours}:${minutes}:${seconds}`
    }

    let minutesStr = `00${minutes}`;
    minutesStr = minutesStr.slice(-2);

    let secondsStr = `00${seconds}`;
    secondsStr = secondsStr.slice(-2);

    let adjustHours = null;
    let timeStr = '';
    if (hours == 0) {
      adjustHours = 12;
      timeStr = `${adjustedHours}:${minutesStr}:${secondsStr} AM`;
    }
    else if (hours == 12) {
      adjustHours = 12;
      timeStr = `${adjustedHours}:${minutesStr}:${secondsStr} PM`;
    }
    else if (hours > 12) {
      adjustHours = hours % 12;
      timeStr = `${adjustedHours}:${minutesStr}:${secondsStr} PM`;
    }
    else {
      adjustedHours = hours;
      timeStr = `${adjustedHours}:${minutesStr}:${secondsStr} AM`;
    }

    let meridiemTime = {  // 12-hour format (AM | PM)
      hours: adjustHours,
      minutes: minutes,
      seconds: seconds,
      milliseconds: milliseconds,
      string: timeStr
    }

    // DATE
    let year = d.getFullYear();  // yyyy

    let monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let monthNumber = d.getMonth(); // 0-11;
    let monthName = monthNames[monthNumber];
    let dayOfMonth = d.getDate(); // 1-31

    let weekDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let dayOfWeekNumber = d.getDay();  // 0-6
    let dayOfWeekName = weekDayNames[dayOfWeekNumber];

    return {
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      milliseconds: milliseconds,
      militaryTime: militaryTime,
      meridiemTime: meridiemTime,
      year: year,
      monthNumber: monthNumber,
      monthName: monthName,
      dayOfMonth: dayOfMonth,
      dayOfWeekNumber: dayOfWeekNumber,
      dayOfWeekName: dayOfWeekName
    };
  }

  static military_to_meridiem_time(militaryTime) {
    let parts = militaryTime.split(':');

    let hoursStr = parts[0];
    let hoursVal = parseInt(hoursStr);

    let minutesStr = parts[1];
    let minutesVal = parseInt(minutesStr);

    let secondsStr = parts[2];
    let secondsVal = parseInt(secondsStr);

    let adjustedHours = null;
    if (hoursVal == 0 || hoursVal == 12) {
      adjustedHours = 12;
    }
    else if (hoursVal > 12) {
      adjustedHours = hoursVal % 12;
    }
    else {
      adjustedHours = hoursVal;
    }

    let timeStr = `${adjustedHours}:${minutesStr}:${secondsStr}`;
    if (hoursVal < 12) {
      timeStr += ' AM';
    }
    else {
      timeStr += ' PM';
    }
    return timeStr;
  }

  static meridiem_to_military_time(meridiemTime) {
    let parts = militaryTime.split(':');

    let hoursStr = parts[0];
    let hoursVal = parseInt(hoursStr);

    let minutesStr = parts[1];
    let minutesVal = parseInt(minutesStr);

    let secondsStr = parts[2];
    let secondsVal = parseInt(secondsStr);

    let adjustedhours = null;
    if (meridiemTime.includes('AM') && hoursVal == 12) {
      adjustedhours = 0;
    }
    else if (meridiemTime.includes('PM') && hoursVal < 12) {
      adjustedhours = hoursVal + 12;
    }
    else {
      adjustedhours = hours;
    }
    return `${adjustedHours}:${minutesStr}:${secondsStr}`;
  }

  static difference(d1, d2) {
    let date1 = new Date(d1.year, d1.month_number, d1.day_of_month, 0, 0, 0, 0);
    let date2 = new Date(d2.year, d2.month_number, d2.day_of_month, 0, 0, 0, 0);
    let diff = t1.getTime() - t2.getTime();

    let secondsFromD1ToD2 = diff / 1000;
    return secondsFromD1ToD2;
  }
}

//-------------------------------------------
// STATS
class Stats {
  static stats(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ stats: null, error: error });
        return;
      }

      FS.lstat(path, (err, stats) => {
        if (err)
          resolve({ stats: null, error: err });
        else {
          resolve({
            stats: {
              size: stats.size,  // bytes
              mode: stats.mode,
              uid: stats.uid,
              gid: stats.gid,
              others_x: stats.mode & 1 ? 'x' : '-',
              others_w: stats.mode & 2 ? 'w' : '-',
              others_r: stats.mode & 4 ? 'r' : '-',
              group_x: stats.mode & 8 ? 'x' : '-',
              group_w: stats.mode & 16 ? 'w' : '-',
              group_r: stats.mode & 32 ? 'r' : '-',
              owner_x: stats.mode & 64 ? 'x' : '-',
              owner_w: stats.mode & 128 ? 'w' : '-',
              owner_r: stats.mode & 256 ? 'r' : '-',
              is_dir: stats.isDirectory(),
              is_symlink: stats.isSymbolicLink()
            },
            error: null
          });
        }
      });
    });
  }
}

//-------------------------------------------
// PATH
class Path {
  static exists(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ exists: null, error: error });
        return;
      }

      FS.access(path, FS.F_OK, (err) => {
        if (err)
          resolve({ exists: false, error: null });
        else
          resolve({ exists: true, error: null });
      });
    });
  }

  static is_file(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ isFile: null, error: error });
        return;
      }

      FS.lstat(path, (err, stats) => {
        if (err)
          resolve({ isFile: null, error: err });
        else
          resolve({ isFile: stats.isFile() && !stats.isDirectory(), error: null });
      });
    });
  }

  static is_dir(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ isDir: null, error: error });
        return;
      }

      FS.lstat(path, (err, stats) => {
        if (err)
          resolve({ isDir: null, error: err });
        else
          resolve({ isDir: stats.isDirectory(), error: null });
      });
    });
  }

  static filename(path) {
    let error = Path.error(path);
    if (error)
      return { name: null, error: error };
    return { name: PATH.basename(path.trim()), error: null };
  }

  static extension(path) {
    let error = Path.error(path);
    if (error)
      return { extension: null, error: error };
    return { extension: PATH.extname(p.trim()), error: null };
  }

  static parent_dir_name(path) {
    let error = Path.error(path);
    if (error)
      return { dir: null, error: error };
    return { dir: PATH.dirname(path.trim()).split(PATH.sep).pop(), error: null };
  }

  static parent_dir(path) {
    let error = Path.error(path);
    if (error)
      return { dir: null, error: error };
    return { dir: PATH.dirname(p.trim()), error: null }; // Full path to parent dir
  }

  static is_valid(path) {
    return path != null && path != undefined && path != '' && path.trim() != '';
  }

  static get_invalid_type(p) {
    if (path == null)
      return 'null';
    else if (path == undefined)
      return 'undefined';
    else if (path == '')
      return 'empty string';
    else if (path.trim() == '')
      return 'whitespace';
    else
      return typeof path;
  }

  static error(path) {
    if (!Path.is_valid(path)) {
      if (!path)
        return `Path is ${Path.get_invalid_type(path)}`;

      let pTrimmed = path.trim();
      if (!Path.exists(pTrimmed))
        return 'No such file or directory';
    }
    return null;
  }

  static escape(path) {
    let error = Path.error(path);
    if (error)
      return { string: null, error: error };
    return { string: escape(path), error: null };
  }

  static containsWhiteSpace(path) {
    let error = Path.error(path);
    if (error)
      return { hasWhitespace: null, error: error };

    path.forEach(char => {
      if (char.trim() == '')
        return { hasWhitespace: true, error: null };
    });
    return { hasWhitespace: false, error: null };
  }
}

//-------------------------------------------
// PERMISSIONS
class Permissions {
  static permissions(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ permissions: null, error: error });
        return;
      }

      FS.lstat(path, (err, stats) => {
        if (err)
          resolve({ permissions: null, error: err });
        else {
          let others = {
            x: stats.mode & 1 ? 'x' : '-',
            w: stats.mode & 2 ? 'w' : '-',
            r: stats.mode & 4 ? 'r' : '-',
          };
          let others_string = `${others.r}${others.w}${others.x}`;

          let group = {
            x: stats.mode & 8 ? 'x' : '-',
            w: stats.mode & 16 ? 'w' : '-',
            r: stats.mode & 32 ? 'r' : '-',
          };
          let group_string = `${group.r}${group.w}${group.x}`;

          let owner = {
            x: stats.mode & 64 ? 'x' : '-',
            w: stats.mode & 128 ? 'w' : '-',
            r: stats.mode & 256 ? 'r' : '-',
          };
          let owner_string = `${owner.r}${owner.w}${owner.x}`;

          resolve({
            permissions: {
              others: others,
              others_string: others_string,
              group: group,
              group_string: group_string,
              owner: owner,
              owner_string: owner_string
            },
            error: null
          });
        }
      });
    });
  }

  static equal(p1, p2) {
    return p1.owner.r == p2.owner.r &&
      p1.owner.w == p2.owner.w &&
      p1.owner.x == p2.owner.x &&
      p1.group.r == p2.group.r &&
      p1.group.w == p2.group.w &&
      p1.group.x == p2.group.x &&
      p1.others.r == p2.others.r &&
      p1.others.w == p2.others.w &&
      p1.others.x == p2.others.x;
  }

  static objToNumberString(obj) {
    let values = { r: 4, w: 2, x: 1, '-': 0 };
    let leftNum = values[obj.u.r] + values[obj.u.w] + values[obj.u.x];
    let middleNum = values[obj.g.r] + values[obj.g.w] + values[obj.g.x];
    let rightNum = values[obj.o.r] + values[obj.o.w] + values[obj.o.x];
    return `${leftNum}${middleNum}${rightNum}`;
  }

  static permStringToNumberString(permString) {
    let adjustedString = permString;
    if (permString.length > 9)
      adjustedString = permString.slice(1);

    let u = { r: adjustedString[0], w: adjustedString[1], x: adjustedString[2] };
    let g = { r: adjustedString[3], w: adjustedString[4], x: adjustedString[5] };
    let u = { r: adjustedString[6], w: adjustedString[7], x: adjustedString[8] };
    let obj = { u: u, g: g, o: o };
    return Permissions.objToNumberString(obj);
  }
}

//-------------------------------------------------
// COPY (cp)
class Copy {
  static copy(src, dest) {
    return new Promise(resolve => {
      FS.copy(src, dest, (err) => {
        if (err) {
          resolve({ success: false, error: err });
          return;
        }
        resolve({ success: true, error: null });
      });
    });
  }
}

//-------------------------------------------------
// REMOVE (rm)
class Remove {
  static file(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ success: false, error: error });
        return;
      }

      FS.unlink(path, (err) => {
        if (err) {
          resolve({ success: false, error: err });
          return;
        }
        resolve({ success: true, error: null });
      });
    });
  }

  static directory(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ success: false, error: error });
        return;
      }

      FS.rmdir(path, (err) => {
        if (err) {
          resolve({ success: false, error: err });
          return;
        }
        resolve({ success: true, error: null });
      });
    });
  }
}

//------------------------------------------------------
// MKDIR (mkdir)
class Mkdir {
  static mkdir(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ success: false, error: error });
        return;
      }

      FS.mkdir(path, (err) => {
        if (err) {
          resolve({ success: false, error: err });
          return;
        }
        resolve({ success: true, error: null });
      });
    });
  }

  static mkdirp(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ success: false, error: error });
        return;
      }

      MKDIRP(path, (err) => {
        if (err) {
          resolve({ success: false, error: err });
          return;
        }
        resolve({ success: true, error: null });
      });
    });
  }
}

//------------------------------------------------------
// MOVE 
class Move {
  static move(src, dest) {
    return new Promise(resolve => {
      FS.move(src, dest, (err) => {
        if (err) {
          resolve({ success: false, error: err });
          return;
        }
        resolve({ success: true, error: null });
      });
    });
  }
}

//------------------------------------------------------
// LIST (ls)
class List {
  static visible(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ files: null, error: error });
        return;
      }

      FS.readdir(path, (err, files) => {
        if (err) {
          resolve({ files: null, error: err });
          return;
        }
        resolve({ files: files.filter(x => !x.startsWith('.')), error: null });
      });
    });
  }

  static hidden(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ files: null, error: error });
        return;
      }

      FS.readdir(path, (err, files) => {
        if (err) {
          resolve({ files: null, error: err });
          return;
        }
        resolve({ files: files.filter(x => x.startsWith('.')), error: null });
      });
    });
  }

  static all(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ files: null, error: error });
        return;
      }

      FS.readdir(path, (err, files) => {
        if (err) {
          resolve({ files: null, error: err });
          return;
        }
        resolve({ files: files, error: null });
      });
    });
  }
}

//------------------------------------------------
// RSYNC
class Rsync {
  static rsync(user, host, src, dest) {
    return new Promise(resolve => {
      let argStr = `-a ${src} ${user}@${host}:${dest}`;
      Execute.local('rsync', argStr.split(' ')).then(output => {
        if (output.stderr) {
          resolve({
            success: false,
            stdout: output.stdout,
            stderr: output.stderr,
            exitCode: output.exitCode
          });
          return;
        }
        resolve({
          success: true,
          stdout: output.stdout,
          stderr: output.stderr,
          exitCode: output.exitCode
        });
      });
    });
  }

  static update(user, host, src, dest) { // Update dest if src was updated
    return new Promise(resolve => {
      let argStr = `-a --update ${src} ${user}@${host}:${dest}`;
      Execute.local('rsync', argStr.split(' ')).then(output => {
        if (output.stderr) {
          resolve({
            success: false,
            stdout: output.stdout,
            stderr: output.stderr,
            exitCode: output.exitCode
          });
          return;
        }
        resolve({
          success: true,
          stdout: output.stdout,
          stderr: output.stderr,
          exitCode: output.exitCode
        });
      });
    });
  }

  static match(user, host, src, dest) { // Copy files and then delete those NOT in src (Match dest to src)
    return new Promise(resolve => {
      let argStr = `-a --delete-after ${src} ${user}@${host}:${dest}`;
      Execute.local('rsync', argStr.split(' ')).then(output => {
        if (output.stderr) {
          resolve({
            success: false,
            stdout: output.stdout,
            stderr: output.stderr,
            exitCode: output.exitCode
          });
          return;
        }
        resolve({
          success: true,
          stdout: output.stdout,
          stderr: output.stderr,
          exitCode: output.exitCode
        });
      });
    });
  }

  static manual(user, host, src, dest, flags, options) {  // flags: [chars], options: [strings]
    return new Promise(resolve => {
      let flagStr = `-${flags.join('')}`; // Ex.: -av
      let optionStr = options.join(' ');  // Ex.: --ignore times, --size-only, --exclude <pattern>

      let argStr = `${flagStr} ${optionStr} ${src} ${user}@${host}:${dest}`;
      Execute.local('rsync', argStr.split(' ')).then(output => {
        if (output.stderr) {
          resolve({
            success: false,
            stdout: output.stdout,
            stderr: output.stderr,
            exitCode: output.exitCode
          });
          return;
        }
        resolve({
          success: true,
          stdout: output.stdout,
          stderr: output.stderr,
          exitCode: output.exitCode
        });
      });
    });
  }

  static dry_run(user, host, src, dest, flags, options) { // Will execute without making changes (for testing command)
    return new Promise(resolve => {
      let flagStr = `-${flags.join('')}`; // Ex.: -av
      let optionStr = options.join(' ');  // Ex.: --ignore times, --size-only, --exclude <pattern>

      let argStr = `${flagStr} --dry-run ${optionStr} ${src} ${user}@${host}:${dest}`;
      Execute.local('rsync', argStr.split(' ')).then(output => {
        if (output.stderr) {
          resolve({
            success: false,
            stdout: output.stdout,
            stderr: output.stderr,
            exitCode: output.exitCode
          });
          return;
        }
        resolve({
          success: true,
          stdout: output.stdout,
          stderr: output.stderr,
          exitCode: output.exitCode
        });
      });
    });
  }
}

//-----------------------------------------
// CHMOD
class Chmod {
  static chmod(op, who, types, path) {    // op = (- | + | =)  who = [u, g, o]  types = [r, w, x]
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ filepaths: null, error: error });
        return;
      }

      Permissions.permissions(path).then(results => {
        if (results.error) {
          resolve({ success: false, error: results.error });
          return;
        }

        let perms = results.permissions;
        let whoMapping = { u: 'owner', g: 'group', o: 'others' };
        who.forEach(w => {
          let whoString = whoMapping[w];

          if (op == '=') { // SET
            let typesList = ['r', 'w', 'x'];
            typesList.forEach(t => {
              if (types.includes(t))
                perms[whoString][t] = t;
              else
                perms[whoString][t] = '-';
            });
          }
          else {
            types.forEach(t => {
              if (op == '+')  // ADD
                perms[whoString][t] = t;
              else if (op == '-')  // REMOVE
                perms[whoString][t] = '-';
            });
          }
        });

        let obj = { u: perms.owner, g: perms.group, o: perms.others };
        let newPermNumStr = Permissions.objToNumberString(obj);
        FS.chmodSync(path, newPermNumStr, (err) => {
          if (err) {
            resolve({ success: false, error: err });
            return;
          }
          resolve({ success: true, error: null });
        }).catch(fatalFail);
      }).catch(fatalFail);
    });
  }
}

//-----------------------------------------------
// CHOWN
class Chown {
  static chown(path, uid, gid) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ success: false, error: error });
        return;
      }

      FS.chown(path, uid, gid, (err) => {
        if (err) {
          resolve({ success: false, error: err });
          return;
        }
        resolve({ success: true, error: null });
      }).catch(fatalFail);
    });
  }
}

//-----------------------------------------------
// USER
class UserInfo {
  static me() {
    let i = OS.userInfo();
    return { username: i.username, uid: i.uid, gid: i.gid };
  }

  static current() {
    return new Promise(resolve => {
      let username = OS.userInfo().username;
      Execute.local('id', [username]).then(output => {
        if (output.stderr) {
          resolve({ info: null, error: output.stderr });
          return;
        }

        let outStr = output.stdout.trim();
        let parts = outStr.split(' ');

        // UID
        let uidParts = parts[0].split('=')[1];
        let uid = uidParts.split('(')[0];

        // GID
        let gidParts = parts[1].split('=')[1];
        let gid = gidParts.split('(')[0];

        // GROUPS
        let groupsParts = parts[2].split('=')[1].split(',');

        let groups = [];
        groupsParts.forEach(gStr => {
          let groupId = gStr.split('(')[0];
          let groupName = gStr.split('(')[1].slice(0, -1);
          groups.push({ gid: groupId, name: groupName });
        });

        resolve({
          info: {
            username: username,
            uid: uid,
            gid: gid,
            groups: groups
          },
          error: null
        });
      }).catch(fatalFail);
    });
  }

  static other(username) {
    return new Promise(resolve => {
      Execute.local('id', [username]).then(output => {
        if (output.stderr) {
          resolve({ info: null, error: output.stderr });
          return;
        }

        let outStr = output.stdout.trim();
        let parts = outStr.split(' ');

        // UID
        let uidParts = parts[0].split('=')[1];
        let uid = uidParts.split('(')[0];

        // GID
        let gidParts = parts[1].split('=')[1];
        let gid = gidParts.split('(')[0];

        // GROUPS
        let groupsParts = parts[2].split('=')[1].split(',');

        let groups = [];
        groupsParts.forEach(gStr => {
          let groupId = gStr.split('(')[0];
          let groupName = gStr.split('(')[1].slice(0, -1);
          groups.push({ gid: groupId, name: groupName });
        });

        resolve({
          username: username,
          uid: uid,
          gid: gid,
          groups: groups
        });
      }).catch(fatalFail);
    });
  }
}

//-----------------------------------------------
// RENAME
class Rename {
  static rename(currPath, newName) {
    return new Promise(resolve => {
      let error = Path.error(currPath);
      if (error) {
        resolve({ success: false, error: error });
        return;
      }

      let parentDir = Path.parent_dir(currPath);
      let updatedPath = PATH.join(parentDir, newName);

      FS.rename(currPath, updatedPath, (err) => {
        if (err) {
          resolve({ success: false, error: err });
          return;
        }
        resolve({ success: true, error: null });
      }).catch(fatalFail);
    });
  }
}

//---------------------------------------------------
// FILE
class File {
  static exists(path) {
    return Path.exists(path);
  }

  static copy(src, dest) {
    return Copy.file(src, dest);
  }

  static remove(path) {
    return Remove.file(path);
  }

  static create(path, text) {
    return new Promise(resolve => {
      FS.writeFile(path, text, (err) => {
        if (err) {
          resolve({ success: false, error: err });
        }
        resolve({ success: true, error: null })
      }).then(results => {
        Path.exists(path).then(ex => {
          resolve({ success: ex.exists, error: ex.error });
        });
      });
    });
  }

  static move(src, dest) {
    return Move.file(src, dest);
  }

  static rename(path, newName) {
    return Rename.rename(path, newName);
  }

  static make_executable(path) {
    let op = '+';
    let who = ['u', 'g', 'o'];
    let types = ['x'];
    return Chmod.chmod(op, who, types, path);
  }

  static read(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ content: null, error: error });
        return;
      }

      FS.readFile(path, (err, data) => {
        if (err) {
          resolve({ content: null, error: err });
          return;
        }
        resolve({ content: data, error: null });
      });
    });
  }

  static read_lines(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ lines: null, error: error });
        return;
      }

      File.read(path).then(values => {
        if (values.error) {
          resolve({ lines: null, error: values.error });
          return;
        }
        resolve({ lines: values.content.toString().split('\n'), error: null });
      });
    });
  }
}

//-----------------------------------------
// DIRECTORY

class Directory {
  static exists(path) {
    return Path.exists(path);
  }

  static copy(src, dest) {
    return Copy.copy(src, dest);
  }

  static remove(path) {
    return Remove.directory(path);
  }

  static create(path) {
    return Mkdir.mkdirp(path);
  }

  static move(src, dest) {
    return Move.move(src, dest);
  }

  static rename(path, newName) {
    return Rename.rename(path, newName);
  }
}

//----------------------------------------
// BASH SCRIPT

class BashScript {
  static create(path, content) {
    return new Promise(resolve => {
      File.create(path, `#!/bin/bash\n${content}`).then(results => {
        if (results.err) {
          resolve({ success: false, error: results.err });
          return;
        }

        if (!results.success) {
          resolve({ success: false, error: null });
          return;
        }

        Chmod.chmod(op, who, types, path).then(values => {
          if (values.error) {
            resolve({ success: false, error: values.error });
            return;
          }
          resolve({ success: values.success, error: null });
        });
      });
    });
  }

  static execute(path, content) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ success: false, error: error });
        return;
      }

      BashScript.create(path, content).then(results => {
        if (results.error) {
          resolve({ success: false, error: results.error });
          return;
        }

        if (!results.success) {
          resolve({ success: false, error: null });
          return;
        }

        Execute.local(path).then(values => {
          if (values.stderr) {
            resolve({ success: false, error: values.stderr });
            return;
          }

          resolve({ success: true, error: null });
          File.remove(path).then(ret => { });
        }).catch(fatalFail);
      });
    });
  }
}

//------------------------------------
// FIND
class Find {
  static manual(path, options) {  // options = [ -option [value] ]
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ results: null, error: error });
        return;
      }

      let args = `${path}`;
      options.forEach(o => args += ` ${o}`);
      args = args.split(' ');

      Execute.local('find', args).then(output => {
        if (output.stderr) {
          resolve({ results: null, error: output.stderr });
          return;
        }

        let lines = output.stdout.split('\n').filter(line => line && line.trim() != '' && line != path);
        resolve({ results: output.stdout, error: null });
      }).catch(fatalFail);
    });
  }

  static files_by_pattern(path, pattern, maxdepth) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ filepaths: null, error: error });
        return;
      }

      let args = `${path}`;
      if (maxDepth && maxDepth > 0)
        args += ` -maxdepth ${maxDepth}`;
      args += ` -type f -name "${pattern}"`;
      args = args.split(' ');

      Execute.local('find', args).then(output => {
        if (output.stderr) {
          resolve({ filepaths: null, error: output.stderr });
          return;
        }

        let lines = output.stdout.split('\n').filter(line => line && line.trim() != '' && line != path);
        resolve({ filepaths: lines, error: null });
      }).catch(fatalFail);
    });
  }

  static files_by_content(path, text, maxDepth) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ filepaths: null, error: error });
        return;
      }

      let args = `${path}`;
      if (maxDepth && maxDepth > 0)
        args += ` -maxdepth ${maxDepth}`;
      args += ` -type f -exec grep -l "${text}" "{}" \;`;
      args = args.split(' ');

      Execute.local('find', args).then(output => {
        if (output.stderr) {
          resolve({ filepaths: null, error: output.stderr });
          return;
        }

        let lines = output.stdout.trim().split('\n').filter(line => line && line.trim() != '' && line != path);
        let filepaths = [];

        lines.forEach(line => {
          filepaths.push(PATH.filename(line.trim()));
        });
        resolve({ filepaths: filepaths, error: null });
      }).catch(fatalFail);
    });
  }

  static files_by_user(path, user, maxDepth) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ filepaths: null, error: error });
        return;
      }

      let args = `${path}`;
      if (maxDepth && maxDepth > 0)
        args += ` -maxdepth ${maxDepth}`;
      args += ` -type f -user ${user}`;
      args = args.split(' ');

      Execute.local('find', args).then(output => {
        if (output.stderr) {
          resolve({ filepaths: null, error: output.stderr });
          return;
        }

        let lines = output.stdout.split('\n').filter(line => line && line.trim() != '' && line != path);
        resolve({ filepaths: lines, error: null });
      }).catch(fatalFail);
    });
  }

  static dir_by_pattern(path, pattern, maxDepth) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ filepaths: null, error: error });
        return;
      }

      let args = `${path}`;
      if (maxDepth && maxDepth > 0)
        args += ` -maxdepth ${maxDepth}`;
      args += ` -type d -name "${pattern}"`;
      args = args.split(' ');

      Execute.local('find', args).then(output => {
        if (output.stderr) {
          resolve({ filepaths: null, error: output.stderr });
          return;
        }

        let lines = output.stdout.split('\n').filter(line => line && line.trim() != '' && line != path);
        resolve({ filepaths: lines, error: null });
      }).catch(fatalFail);
    });
  }

  static empty_files(path, maxDepth) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ filepaths: null, error: error });
        return;
      }

      let args = `${path}`;
      if (maxDepth && maxDepth > 0)
        args += ` -maxdepth ${maxDepth}`;
      args += ` -empty -type f`;
      args = args.split(' ');

      Execute.local('find', args).then(output => {
        if (output.stderr) {
          resolve({ filepaths: null, error: output.stderr });
          return;
        }

        let lines = output.stdout.split('\n').filter(line => line && line.trim() != '' && line != path);
        resolve({ filepaths: lines, error: null });
      }).catch(fatalFail);
    });
  }

  static empty_dirs(path) {
    return new Promise(resolve => {
      let error = Path.error(path);
      if (error) {
        resolve({ filepaths: null, error: error });
        return;
      }

      let args = `${path}`;
      if (maxDepth && maxDepth > 0)
        args += ` -maxdepth ${maxDepth}`;
      args += ` -empty -type d`;

      Execute.local('find', args).then(output => {
        if (output.stderr) {
          resolve({ filepaths: null, error: output.stderr });
          return;
        }

        let lines = output.stdout.split('\n').filter(line => line && line.trim() != '' && line != path);
        resolve({ filepaths: lines, error: null });
      }).catch(fatalFail);
    });
  }
}

//------------------------------------
// EXPORTS

exports.Execute = Execute;
exports.Timestamp = Timestamp;
exports.Path = Path;
exports.Stats = Stats;
exports.Permissions = Permissions;
exports.Copy = Copy;
exports.Remove = Remove;
exports.Mkdir = Mkdir;
exports.Move = Move;
exports.List = List;
exports.Rsync = Rsync;
exports.Chmod = Chmod;
exports.UserInfo = UserInfo;
exports.Chown = Chown;
exports.Rename = Rename;
exports.File = File;
exports.Directory = Directory;
exports.BashScript = BashScript;
exports.Find = Find;