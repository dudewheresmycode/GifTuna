const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const util = require('util');
const fs = require('fs');
const http = require('http'), querystring = require('querystring');
var ffmpeg = require('fluent-ffmpeg');
var streamBuffers = require('stream-buffers');
// var ffmpeg = new FfmpegCommand();

const {ipcMain} = require('electron');

require('fix-path')();

var ffmpeg_path = null;
var ffprobe_path = null;


function check_ffmpeg(callback){
  var appData = app.getPath('userData');
  var custom_path = path.join(appData, "GifTuna", "ffmpeg");

  if(fs.existsSync(custom_path)){
    callback(null, {ffmpeg:path.join(custom_path, "ffmpeg"), ffprobe:path.join(custom_path, "ffmpeg")});
    return;
  }
  var missing = [];
  ffmpeg()._getFfmpegPath(function(err, ffmpegPath){
    if(err){
      //check in appData
      console.log('ffmpeg not found!', ffmpegPath);
      missing.push('ffmpeg');
    }else{
      console.log('found ffmpeg!', ffmpegPath);
    }
    ffmpeg()._getFfprobePath(function(err, ffprobePath){
      if(err){
        console.log('ffprobe not found!', ffprobePath);
        missing.push('ffprobe');
      }else{
        console.log('found ffprobe!', ffprobePath);
      }

      callback(missing.length > 0 ? missing : null, {ffmpeg:ffmpegPath, ffprobe:ffprobePath});
    });
  });
}

function download_ffmpeg(){
  var ffbinaries = require('ffbinaries');
  var platform = ffbinaries.detectPlatform();
  var dest = __dirname + '/binaries';

  ffbinaries.downloadFiles({components: ['ffprobe'], quiet: true, destination: dest}, function () {
    console.log('Downloaded binaries for ' + platform + '.');
  })
}


// //find location on mac
// exec("type -P ffmpeg", function(e,so,se){
//   if(so.length > 0){ ffmpeg_path = so.trim(); }
//   exec("type -P ffprobe", function(e,so,se){
//     if(so.length > 0){ ffprobe_path = so.trim(); }
//   });
// })



var port = 3136;
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 950, height: 600, minWidth:800, minHeight:600, titleBarStyle:"hidden-inset"})

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){
  createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
ipcMain.on('ffmpegCheck', (event, input) => {
  check_ffmpeg(function(err, paths){
    if(!err){
      ffmpeg.setFfmpegPath(paths.ffmpeg);
      ffmpeg.setFfprobePath(paths.ffprobe);
    }
    event.sender.send('ffmpegResult', {error:err, paths:paths});
  })
})


ipcMain.on('probeInput', (event, input) => {
  ffmpeg.ffprobe(input,function(err, metadata) {
    event.sender.send('probeResult', metadata);
  });
});
//
// http.createServer(function(req,res){
//   var parts = url.parse(req.url,true);
//   console.log("GET", parts);
//   if(parts.query.type=='png'){
//     res.writeHead(200, {"Content-type":"image/png"});
//     res.end(fs.readFileSync(parts.query.fp));
//   }else if(parts.query.type=='gif'){
//     res.writeHead(200, {"Content-type":"image/gif"});
//     res.end(fs.readFileSync(parts.query.fp));
//   }else{
//     res.writeHead(404, {"Content-type":"text/plain"});
//     res.end("Nope. Nope... Nope.");
//   }
//
//
// }).listen(port);

ipcMain.on('getRawThumbnail', (event, input, seconds) => {
  getRawThumbnail(input, seconds, function(err,url){
    event.sender.send('rawThumbnail', url);
  });
});

ipcMain.on('getGifThumbnail', (event, input, seconds, prefs, paletteData) => {
  console.log("PREFS", prefs);
  getGifThumbnail(input, seconds, prefs, paletteData, function(err, data){
    event.sender.send('gifThumbnail', {data:data});
  });
});
ipcMain.on('getGifPalette', (event, input, prefs) => {
  generateGifPalette(input, prefs, function(err, data){
    event.sender.send('gifPalette', {data:data});
  });
});

var ffcmd;

ipcMain.on('killProcess',function(){
  console.log("kill?");
  if(ffcmd && typeof ffcmd.kill=='function'){
    console.log('kill');
    ffcmd.kill();
  }
})


ipcMain.on('exportGif', (event, input, output, palette, prefs) => {
  // var palettePath = path.join(app.getPath("temp"), "gif_palette.png");
  // fs.writeFileSync(palettePath, palette.split('base64,')[1], 'base64');

  exportGif(
    input,
    output,
    palette,
    prefs,
    function(frame){
      console.log('export progress', frame);
      event.sender.send('exportProgress', frame);
    },
    function(){
      event.sender.send('exportComplete', output);
    }
  );

});

function getRawThumbnail(input,seconds,callback){

  // var ff = spawn(ffmpeg_path, ["-ss", (seconds||0), "-i", input,  "-frames:v", 1, "-c:v", "png", "-f", "image2", "pipe:1"]);

  // var data = new Buffer();
  var data = [];
  ffmpeg(input)
  .seekInput(seconds||0).frames(1).videoCodec('png').outputFormat('image2').pipe({end:true})
  .on('data',function(d){
    data.push(d);
  })
  // ff.stderr.on('data',function(d){
  //   console.log(d.toString());
  // });
  .on('end', function(){
    callback(null, Buffer.concat(data).toString('base64'));
  });
}



function generateGifPalette(input, prefs, callback){
  // var palette = path.join(app.getPath("temp"), "gif_palette.png");
  var stats = prefs.stats_mode || 'full';
  var colors = prefs.colors || 256;
  var w = prefs.width || 320;
  var h = prefs.height || 240;
  var fps = prefs.fps || 10;
  var transparency = (prefs.transparency?1:0) || 0;
  //var scaleCmd = "scale=iw*min("+w+"/iw\,"+h+"/ih):ih*min("+w+"/iw\,"+h+"/ih),pad="+w+":"+h+":("+w+"-iw)/2:("+h+"-ih)/2";
  var scaleCmd = "scale="+w+":"+h;
  // var cmd = util.format("ffmpeg -i \"%s\" -vf \"fps=%s,%s:flags=lanczos,palettegen=stats_mode=%s:max_colors=%s\" pipe:1", input, fps, scaleCmd, stats, colors);
  var vf = util.format("fps=%s,%s:flags=lanczos,palettegen=stats_mode=%s:max_colors=%s:reserve_transparent=%s", fps, scaleCmd, stats, colors, transparency);
  // console.log("------");
  // console.log("VIDEO FILTER", vf);
  // console.log("------");
  // var read = fs.createReadStream(input);
  // var ff = spawn(ffmpeg_path, [
  //   "-i", input,
  //   "-vf", vf,
  //   // '-loglevel', 'debug',
  //   "-c:v", "png",
  //   "-f", "image2",
  //   "pipe:1"
  // ]);
  var data = [];
  ffcmd = ffmpeg(input)
    .videoFilters(vf).videoCodec("png").outputFormat("image2").pipe({end:true})
    .on('data',function(d){
      data.push(d);
    })
    .on('end', function(){
      callback(null, Buffer.concat(data).toString('base64'));
    });
    // ff.stderr.on('data',function(d){
    //   var matches = data.toString().match(/frame=(\s+\d+)/i);
    //   var frame = matches && matches.length > 1 ? matches[1].trim() : -1;
    //   console.log(d.toString());
    //   console.log(frame);
    //
    // });
  // read.on('data',function(){
  //   console.log('read data');
  // });
  // read.on('end',function(){
  //   console.log('read done');
  // });
  // read.pipe(ff.stdin);

  // exec(cmd, function(e, so, se){
  //   callback(null, fs.readFileSync(palette).toString('base64'));
  // });
}



function getGifThumbnail(input, seconds, prefs, paletteData, callback){


  var dither = prefs.dither_mode || 'none';
  var w = prefs.width || 320;
  var h = prefs.height || 240;
  var fps = prefs.fps || 30;

  // Initialize stream
  var aReadableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
    frequency: 10,      // in milliseconds.
    chunkSize: 2048     // in bytes.
  });
  var scaleCmd = "scale="+w+":"+h;

  var data = [];

  ffcmd = ffmpeg()
    .input(input)
    .seekInput(seconds||0)
    .input(aReadableStreamBuffer)
    .frames(1)
    .duration(1)
    .complexFilter("fps="+fps+","+scaleCmd+":flags=lanczos[x];[x][1:v]paletteuse=dither="+dither)
    .outputFormat("gif")
    .on('start', function(commandLine) {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
    })
    .on('codecData', function(data) {
      console.log('Input is ' + data.audio + ' audio ' + 'with ' + data.video + ' video');
    })
    // .on('end', function() {
    //   console.log('Finished processing');
    // })
    .on('error', function(err, stdout, stderr) {
      console.log(err, stdout, stderr);
    }).pipe({end:true});

  ffcmd
    .on('data',function(d){
      data.push(d);
    })
    .on('end', function(){
      console.log("GIF");
      callback(null, Buffer.concat(data).toString('base64'));
    });

    aReadableStreamBuffer.put(Buffer.from(paletteData, 'base64'));
    aReadableStreamBuffer.stop();

  // var ff = spawn(ffmpeg_path, [
  //   "-ss", (seconds||0),
  //   "-i", input,
  //   "-i", "pipe:0",
  //   "-frames:v", 1,
  //   "-t", 1,
  //   "-lavfi",
  //   "fps="+fps+","+scaleCmd+":flags=lanczos[x];[x][1:v]paletteuse=dither="+dither,
  //   "-f","gif",
  //   "pipe:1"
  // ]);
  //

  // ff.stderr.on('data',function(d){
  //   // console.log(d.toString());
  // });
  //write palette to stdin
  // ff.stdin.write(Buffer.from(paletteData, 'base64'));
  // ff.stdin.end();

}


function exportGif(input, output, paletteData, prefs, progress, callback){
  // var palette = path.join(app.getPath("temp"), "gif_palette.png");
  // var preview = path.join(app.getPath("temp"), "gif_preview.gif");
  var stats = prefs.stats_mode || 'full';
  var dither = prefs.dither_mode || 'none';
  var colors = prefs.colors || 256;
  var fps = prefs.fps || 10;
  var w = prefs.width || 320;
  var h = prefs.height || 240;
  var scaleCmd = "scale="+w+":"+h;

  var filters = util.format("fps=%s,%s:flags=lanczos[x];[x][1:v]paletteuse=dither=%s", fps, scaleCmd, dither);

  // Initialize stream
  var aReadableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
    frequency: 10,      // in milliseconds.
    chunkSize: 2048     // in bytes.
  });

  // var opts = [
  //   "-i", input, "-i", "pipe:0",
  //   "-lavfi", filters,
  //   "-y", output
  // ];
  console.log("Export", input, output);
  ffcmd = ffmpeg()
    .input(input)
    .input(aReadableStreamBuffer)
    .complexFilter(filters)
    .outputFormat("gif")
    .on('start', function(commandLine) {
      console.log('Spawned Ffmpeg with command: ' + commandLine);
    })
    .on('codecData', function(data) {
      console.log('Input is ' + data.audio + ' audio ' + 'with ' + data.video + ' video');
    })
    .on('end', function() {
      console.log('Finished processing');
      console.log("export done");
      callback();
    })
    .on('progress',function(p){
      console.log("progress", p.frames);
      progress(p.frames);
    })
    .on('error', function(err, stdout, stderr) {
      console.log(err, stdout, stderr);
    })
    .save(output);

    aReadableStreamBuffer.put(Buffer.from(paletteData, 'base64'));
    aReadableStreamBuffer.stop();

  // //input, palette, scaleCmd, dither, preview
  // var ff = spawn(ffmpeg_path, opts);
  // // ff.stdout.on('data',function(data){
  // //   // console.log('stdout');
  // // });
  // ff.stderr.on('data',function(data){
  //   var matches = data.toString().match(/frame=(\s+\d+)/i);
  //   var frame = matches && matches.length > 1 ? matches[1].trim() : -1;
  //   progress(frame);
  //   // console.log("STDERR", data.toString(), matches, frame);
  // });
  // ff.on('exit',function(code){
  //   console.log("export done");
  //   callback();
  // });
  //write palette to stdin
  // ff.stdin.write(Buffer.from(palette, 'base64'));
  // ff.stdin.end();


}
