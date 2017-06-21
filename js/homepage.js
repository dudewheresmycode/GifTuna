$(document).ready(function () {
    GetLatestReleaseInfo();
});

function GetLatestReleaseInfo() {

    var user_os = navigator.platform || navigator.oscpu;
    var isMac = /mac/gi.test(user_os);
    var isWindows = /win/gi.test(user_os);
    var isLinux = /linux/gi.test(user_os);
    var cl = false;
    var lbl = false;
    // if(isMac){ cl = 'fa-apple'; lbl='Mac OS'; }
    // if(isWindows){ cl = 'fa-windows'; lbl='Windows'; }
    // if(isLinux){ cl = 'fa-linux'; lbl='Linux'; }
    $("#dynamic-dl").hide();
    var isValidOS=false;
    $.getJSON("https://api.github.com/repos/dudewheresmycode/GifTuna/releases/latest").done(function (release) {
      var win = release.assets.find(function(it){ return /win32/gi.test(it.name); });
      var mac = release.assets.find(function(it){ return /mac/gi.test(it.name); });
      var linux = release.assets.find(function(it){ return /linux/gi.test(it.name); });

      if(win){
        $("#dl-button-win").attr('href', win.browser_download_url).css('display','block');
      }
      if(mac){
        $("#dl-button-mac").attr('href', mac.browser_download_url).css('display','block');
      }
      if(linux){
        $("#dl-button-linux").attr('href', linux.browser_download_url).css('display','block');
      }
      var size = 0;
      //main dl button
      if(isMac){
        cl = 'fa-apple';
        lbl='Mac OS X';
        href=mac.browser_download_url;
        isValidOS=true;
        size = mac.size;
      }else if(isWindows){
        cl = 'fa-windows';
        lbl='Windows';
        href=win.browser_download_url;
        isValidOS=true;
        size = win.size;
      }else if(isLinux){
        cl = 'fa-linux';
        lbl='Linux';
        href=linux.browser_download_url;
        isValidOS=true;
        size = linux.size;

      }

      if(isValidOS){
        $("#dl-main").html('<i class="fa fa-fw '+cl+'"></i> Download for '+lbl).attr('href', href).css('display','block');
        $("#version .version").text(release.tag_name);
        $("#version .size").text(humanFileSize(size));
      }else{
        $("#dl-main").hide();
      }
      $("#dynamic-dl").show();

    });
}


function humanFileSize(bytes) {
    var thresh = 1000;
    if(Math.abs(bytes) < thresh) {
      return bytes + ' B';
    }
    var units = ['kB','MB','GB','TB','PB','EB','ZB','YB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while(Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1)+' '+units[u];
}
